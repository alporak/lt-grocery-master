import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeText, semanticSearch, scoreRelevance, buildFlexibleConditions, SYNONYM_MAP } from "@/lib/search";

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
  // When true, skip productGroupId deduplication so all stores are returned
  const nodedupe = searchParams.get("nodedupe") === "1";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  // ── Semantic search ──────────────────────────────────────────────────────────
  const semanticResults = await semanticSearch(q, limit * 6);
  // Raise threshold to 0.60 so low-confidence semantic results fall through to
  // keyword search, which is more reliable for common grocery terms.
  const aboveThreshold = semanticResults
    ? semanticResults.filter((r) => r.score >= 0.60)
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
        subcategory: true,
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

    const { deduped, dominantCategory } = deduplicateAndGetCategory(products, nodedupe);
    const suggestions = deduped.slice(0, limit).map((p) => toSuggestion(p));
    return NextResponse.json({ suggestions, dominantCategory });
  }

  // ── Keyword fallback with synonym expansion ──────────────────────────────────
  const flexConditions = buildFlexibleConditions(q);
  if (flexConditions.length === 0) {
    return NextResponse.json({ suggestions: [], dominantCategory: null });
  }

  const productSelect = {
    id: true,
    nameLt: true,
    nameEn: true,
    brand: true,
    canonicalCategory: true,
    subcategory: true,
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
  } as const;

  // Collect long LT synonyms (>= 5 chars) for the query words so we can
  // anchor the candidate set on actual food products regardless of ordering.
  const longSynonyms = new Set<string>();
  for (const word of q.split(/\s+/).filter(w => w.length >= 2)) {
    const group = SYNONYM_MAP.get(word);
    if (group) {
      for (const syn of group) {
        const synNorm = normalizeText(syn);
        if (synNorm !== word && synNorm.length >= 5) longSynonyms.add(synNorm);
      }
    }
  }

  // Supplemental query: products whose nameLt STARTS WITH a long LT synonym.
  // This guarantees the actual food category products (Pienas, Sviestas, Cukrus…)
  // are always present in the candidate set regardless of recency or alphabetical
  // ordering. Run in parallel with the broad keyword query.
  const [products, anchorProducts] = await Promise.all([
    prisma.product.findMany({
      where: {
        AND: flexConditions,
        ...(categoryFilter ? { canonicalCategory: categoryFilter } : {}),
      },
      select: productSelect,
      take: limit * 6,
      orderBy: { nameLt: "asc" },
    }),
    longSynonyms.size > 0
      ? prisma.product.findMany({
          where: {
            // Use searchIndex (pre-normalized, diacritics stripped) so e.g.
            // "Bulvės" (ė) is found by startsWith "bulves" — nameLt LIKE fails
            // on non-ASCII chars in SQLite.
            OR: [...longSynonyms].map(syn => ({ searchIndex: { startsWith: syn } })),
            ...(categoryFilter ? { canonicalCategory: categoryFilter } : {}),
          },
          select: productSelect,
          take: limit * 3,
          orderBy: { nameLt: "asc" },
        })
      : Promise.resolve([] as ProductRow[]),
  ]);

  // Merge: anchor products first (they score highest), then broad results.
  const seenIds = new Set<number>();
  const merged: ProductRow[] = [];
  for (const p of [...anchorProducts, ...products]) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      merged.push(p);
    }
  }

  // Re-rank keyword results by relevance score
  const scored = merged.map((p) => ({
    ...p,
    _score: scoreRelevance(q, { nameLt: p.nameLt, nameEn: p.nameEn, searchIndex: p.searchIndex, brand: p.brand }),
  }));
  scored.sort((a, b) => b._score - a._score);

  const { deduped, dominantCategory } = deduplicateAndGetCategory(scored, nodedupe);
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
  subcategory: string | null;
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

function deduplicateAndGetCategory(products: ProductRow[], nodedupe = false): {
  deduped: ProductRow[];
  dominantCategory: string | null;
} {
  // When nodedupe=true, skip cross-store deduplication so every store's product
  // is returned (used by the Products tab to show same item from all stores).
  if (nodedupe) {
    const catCounts = new Map<string, number>();
    for (const p of products) {
      if (p.canonicalCategory)
        catCounts.set(p.canonicalCategory, (catCounts.get(p.canonicalCategory) ?? 0) + 1);
    }
    const dominantCategory =
      catCounts.size > 0
        ? [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : null;
    return { deduped: products, dominantCategory };
  }

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
    subcategory: p.subcategory,
    store: p.store.name,
    chain: p.store.chain,
    price: p.priceRecords[0]?.salePrice ?? p.priceRecords[0]?.regularPrice ?? null,
    unitPrice: p.priceRecords[0]?.unitPrice ?? null,
    unitLabel: p.priceRecords[0]?.unitLabel ?? null,
    weightValue: p.weightValue,
    weightUnit: p.weightUnit,
  };
}
