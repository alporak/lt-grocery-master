import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { EnrichmentBlob } from "@/lib/categoryParser";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return await handleGet(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[category-parser] GET error:", message);
    return NextResponse.json({ error: message, items: [], total: 0, totalPages: 0, page: 1, pageSize: 20, stats: { total: 0, reviewed: 0, pending: 0, suggested: 0 } }, { status: 500 });
  }
}

async function handleGet(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "pending";
  const storeIdParam = searchParams.get("storeId");
  const category = searchParams.get("category");
  const search = searchParams.get("search") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10));

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    enrichedAt: { not: null },
  };

  if (status === "pending" || status === "suggested") {
    where.reviewedAt = null;
  } else if (status === "reviewed") {
    where.reviewedAt = { not: null };
  }
  // "all" — no reviewedAt filter

  if (storeIdParam) {
    where.storeId = parseInt(storeIdParam, 10);
  }

  if (category) {
    where.canonicalCategory = category;
  }

  if (search.length >= 2) {
    where.OR = [
      { nameLt: { contains: search } },
      { nameEn: { contains: search } },
    ];
  }

  // For "suggested" status, we need to over-fetch and post-filter
  const isSuggested = status === "suggested";
  const fetchPageSize = isSuggested ? pageSize * 5 : pageSize;
  const fetchSkip = isSuggested ? 0 : (page - 1) * pageSize;

  const [rawItems, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        nameLt: true,
        nameEn: true,
        categoryLt: true,
        brand: true,
        canonicalCategory: true,
        subcategory: true,
        imageUrl: true,
        productUrl: true,
        enrichment: true,
        reviewedAt: true,
        weightValue: true,
        weightUnit: true,
        barcode: true,
        store: { select: { id: true, name: true, chain: true } },
        priceRecords: {
          orderBy: { scrapedAt: "desc" },
          take: 1,
          select: {
            regularPrice: true,
            salePrice: true,
            unitPrice: true,
            unitLabel: true,
          },
        },
      },
      skip: isSuggested ? 0 : fetchSkip,
      take: fetchPageSize,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.product.count({ where }),
  ]);

  // Parse enrichment blobs and filter for "suggested"
  let items = rawItems.map((p) => {
    let enrichment: EnrichmentBlob | null = null;
    try {
      if (p.enrichment) enrichment = JSON.parse(p.enrichment) as EnrichmentBlob;
    } catch { /* ignore */ }
    return {
      ...p,
      enrichment,
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
      latestPrice: p.priceRecords[0] ?? null,
      priceRecords: undefined,
    };
  });

  if (isSuggested) {
    items = items.filter((p) => p.enrichment?.suggested_category !== undefined);
    // Paginate after filtering
    const offset = (page - 1) * pageSize;
    items = items.slice(offset, offset + pageSize);
  }

  // Stats (always fresh counts)
  const [totalEnriched, reviewedCount, pendingCount] = await Promise.all([
    prisma.product.count({ where: { enrichedAt: { not: null } } }),
    prisma.product.count({ where: { enrichedAt: { not: null }, reviewedAt: { not: null } } }),
    prisma.product.count({ where: { enrichedAt: { not: null }, reviewedAt: null } }),
  ]);

  // Suggested count via raw SQL (Prisma SQLite has no JSON field operators)
  let suggestedCount = 0;
  try {
    const rows = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM Product
      WHERE reviewedAt IS NULL
      AND enrichedAt IS NOT NULL
      AND enrichment LIKE '%"suggested_category"%'
    `;
    suggestedCount = Number(rows[0]?.count ?? 0);
  } catch { /* ignore if raw query fails */ }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages,
    stats: {
      total: totalEnriched,
      reviewed: reviewedCount,
      pending: pendingCount,
      suggested: suggestedCount,
    },
  });
}
