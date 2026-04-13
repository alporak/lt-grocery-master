import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { EnrichmentBlob } from "@/lib/categoryParser";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = parseInt(id, 10);
  if (isNaN(productId)) {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  const body = await req.json() as {
    approve?: boolean;
    nameEn?: string;
    brand?: string | null;
    canonicalCategory?: string | null;
    subcategory?: string | null;
    isFood?: boolean;
  };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, enrichment: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Parse existing enrichment
  let enrichment: EnrichmentBlob = {};
  try {
    if (product.enrichment) enrichment = JSON.parse(product.enrichment) as EnrichmentBlob;
  } catch { /* ignore */ }

  // Apply isFood to enrichment blob
  if (body.isFood !== undefined) {
    enrichment.is_food = body.isFood;
  }

  // If approving, clear all suggestion fields from enrichment
  if (body.approve) {
    delete enrichment.suggested_brand;
    delete enrichment.suggested_category;
    delete enrichment.suggested_subcategory;
    delete enrichment.suggestion_confidence;
    delete enrichment.suggestion_source;
  }

  // Build update data — only set fields that were explicitly provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    enrichment: JSON.stringify(enrichment),
  };

  if (body.nameEn !== undefined) updateData.nameEn = body.nameEn || null;
  if (body.brand !== undefined) updateData.brand = body.brand || null;
  if (body.canonicalCategory !== undefined) updateData.canonicalCategory = body.canonicalCategory || null;
  if (body.subcategory !== undefined) updateData.subcategory = body.subcategory || null;
  if (body.approve) updateData.reviewedAt = new Date();

  try {
    const updated = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      select: {
        id: true,
        nameLt: true,
        nameEn: true,
        brand: true,
        canonicalCategory: true,
        subcategory: true,
        enrichment: true,
        reviewedAt: true,
      },
    });

    let parsedEnrichment: EnrichmentBlob | null = null;
    try {
      if (updated.enrichment) parsedEnrichment = JSON.parse(updated.enrichment) as EnrichmentBlob;
    } catch { /* ignore */ }

    return NextResponse.json({
      ...updated,
      enrichment: parsedEnrichment,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
