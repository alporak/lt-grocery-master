import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeText, semanticSearch, scoreRelevance, buildFlexibleConditions } from "@/lib/search";

export const dynamic = "force-dynamic";

/**
 * GET /api/products/suggest?q=pienas&limit=10&category=Dairy
 * Returns quick autocomplete suggestions for product names.
 * Optional ?category= restricts results to that canonicalCategory.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "8", 10);
  const categoryFilter = searchParams.get("category") || null;

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  // ── Semantic search ──────────────────────────────────────────────────────────
  const semanticResults = await semanticSearch(q, limit * 6);
  const aboveThreshold = semanticResults
    ? semanticResults.filter((r) => r.score >= 0.45)
    : [];

  if (aboveThreshold.length > 0) {
    const products = await prisma.product.findMany({
      where: {
        id: { in: aboveThreshold.map((r) => r.id) },
        ...(categoryFilter ? { canonicalCategory: categoryFilter } : {}),
      },
      select: {
        id: true,
        nameLt: true,
        nameEn: true,
        brand: true,
        canonicalCategory: true,
        searchIndex: true,
        weightValue: true,
        weightUnit: true,
        productGroupId: true,
        store: { select: { name: true, chain: true } },
        priceRecords: {
          orderBy: { scrapedAt: "desc" },
          take: 1,
          select: { regularPrice: true, salePrice: true, unitPrice: true, unitLabel: true },
        },
      },
    });

    // Combined ranking: embedding score (60%) + keyword relevance (40%)
    const embeddingScoreMap = new Map(aboveThreshold.map((r) => [r.id, r.score]));
    const combinedMap = new Map<number, number>();
    for (const p of products) {
      const embScore = embeddingScoreMap.get(p.id) ?? 0;
      const kwScore = scoreRelevance(q, {
        nameLt: p.nameLt,
        nameEn: p.nameEn,
        searchIndex: p.searchIndex,
        brand: p.brand,
      });
      combinedMap.set(p.id, embScore * 0.6 + Math.min(kwScore / 200, 1) * 0.4);
    }
    products.sort((a, b) => (combinedMap.get(b.id) ?? 0) - (combinedMap.get(a.id) ?? 0));

    const { deduped, dominantCategory } = deduplicateAndGetCategory(products);
    const suggestions = deduped.slice(0, limit).map((p) => toSuggestion(p));
    return NextResponse.json({ suggestions, dominantCategory });
  }

  // ── Keyword fallback with synonym expansion ──────────────────────────────────
  const flexConditions = buildFlexibleConditions(q);
  if (flexConditions.length === 0) {
    return NextResponse.json({ suggestions: [], dominantCategory: null });
  }

  const products = await prisma.product.findMany({
    where: {
      AND: flexConditions,
      ...(categoryFilter ? { canonicalCategory: categoryFilter } : {}),
    },
    select: {
      id: true,
      nameLt: true,
      nameEn: true,
      brand: true,
      canonicalCategory: true,
      searchIndex: true,
      weightValue: true,
      weightUnit: true,
      productGroupId: true,
      store: { select: { name: true, chain: true } },
      priceRecords: {
        orderBy: { scrapedAt: "desc" },
        take: 1,
        select: { regularPrice: true, salePrice: true, unitPrice: true, unitLabel: true },
      },
    },
    take: limit * 4,
    orderBy: { updatedAt: "desc" },
  });

  // Re-rank keyword results by relevance score
  const scored = products.map((p) => ({
    ...p,
    _score: scoreRelevance(q, { nameLt: p.nameLt, nameEn: p.nameEn, searchIndex: p.searchIndex, brand: p.brand }),
  }));
  scored.sort((a, b) => b._score - a._score);

  const { deduped, dominantCategory } = deduplicateAndGetCategory(scored);
  const suggestions = deduped.slice(0, limit).map((p) => toSuggestion(p));
  return NextResponse.json({ suggestions, dominantCategory });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type ProductRow = {
  id: number;
  nameLt: string;
  nameEn: string | null;
  brand: string | null;
  canonicalCategory: string | null;
  searchIndex?: string | null;
  weightValue: number | null;
  weightUnit: string | null;
  productGroupId: number | null;
  store: { name: string; chain: string };
  priceRecords: Array<{
    regularPrice: number;
    salePrice: number | null;
    unitPrice: number | null;
    unitLabel: string | null;
  }>;
};

function deduplicateAndGetCategory(products: ProductRow[]): {
  deduped: ProductRow[];
  dominantCategory: string | null;
} {
  const seenGroups = new Set<number>();
  const seen = new Map<string, ProductRow>();

  for (const p of products) {
    if (p.productGroupId) {
      if (seenGroups.has(p.productGroupId)) continue;
      seenGroups.add(p.productGroupId);
      seen.set(`group:${p.productGroupId}`, p);
      continue;
    }
    const key = normalizeText(p.nameLt);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, p);
    } else {
      const existingPrice =
        existing.priceRecords[0]?.salePrice ?? existing.priceRecords[0]?.regularPrice ?? Infinity;
      const newPrice =
        p.priceRecords[0]?.salePrice ?? p.priceRecords[0]?.regularPrice ?? Infinity;
      if (newPrice < existingPrice) seen.set(key, p);
    }
  }

  const catCounts = new Map<string, number>();
  for (const p of seen.values()) {
    if (p.canonicalCategory)
      catCounts.set(p.canonicalCategory, (catCounts.get(p.canonicalCategory) ?? 0) + 1);
  }
  const dominantCategory =
    catCounts.size > 0
      ? [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return { deduped: [...seen.values()], dominantCategory };
}

function toSuggestion(p: ProductRow) {
  return {
    id: p.id,
    name: p.nameLt,
    nameEn: p.nameEn,
    brand: p.brand,
    canonicalCategory: p.canonicalCategory,
    store: p.store.name,
    chain: p.store.chain,
    price: p.priceRecords[0]?.salePrice ?? p.priceRecords[0]?.regularPrice ?? null,
    unitPrice: p.priceRecords[0]?.unitPrice ?? null,
    unitLabel: p.priceRecords[0]?.unitLabel ?? null,
    weightValue: p.weightValue,
    weightUnit: p.weightUnit,
  };
}
