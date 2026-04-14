import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const batchSize = Math.max(1, parseInt(searchParams.get("batchSize") || "10", 10));
  const storeId = searchParams.get("storeId");
  const mode = searchParams.get("mode") || "unenriched"; // "unenriched" | "all"
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (mode === "unenriched") {
    where.enrichment = null;
  }

  if (storeId) {
    where.storeId = parseInt(storeId, 10);
  }

  const [products, totalUnenriched, totalAll] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        nameLt: true,
        nameEn: true,
        categoryLt: true,
        brand: true,
        canonicalCategory: true,
        enrichedAt: true,
        enrichment: true,
        enrichmentSource: true,
        imageUrl: true,
        store: { select: { id: true, name: true, chain: true } },
        priceRecords: {
          orderBy: { scrapedAt: "desc" },
          take: 1,
          select: { regularPrice: true, salePrice: true },
        },
      },
      skip: offset,
      take: batchSize,
      orderBy: { createdAt: "asc" },
    }),
    prisma.product.count({ where: { enrichment: null } }),
    prisma.product.count(),
  ]);

  return NextResponse.json({
    products: products.map((p) => ({
      ...p,
      enrichedAt: p.enrichedAt?.toISOString() ?? null,
      latestPrice: p.priceRecords[0] ?? null,
      priceRecords: undefined,
    })),
    batchSize,
    offset,
    totalUnenriched,
    totalAll,
  });
}
