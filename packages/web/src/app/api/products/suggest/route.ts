import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeText, semanticSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

/**
 * GET /api/products/suggest?q=pienas&limit=10
 * Returns quick autocomplete suggestions for product names.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "8", 10);

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  // Try semantic search first
  const semanticResults = await semanticSearch(q, limit * 4);
  if (semanticResults && semanticResults.length > 0) {
    const rankedIds = semanticResults.map(r => r.id);
    const products = await prisma.product.findMany({
      where: { id: { in: rankedIds } },
      select: {
        id: true,
        nameLt: true,
        nameEn: true,
        brand: true,
        canonicalCategory: true,
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

    // Sort by embedding score
    const scoreMap = new Map(semanticResults.map(r => [r.id, r.score]));
    products.sort((a, b) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0));

    // Deduplicate by productGroupId (if available), fallback to normalized name, keeping cheapest
    const seenGroups = new Set<number>();
    const seen = new Map<string, typeof products[0]>();
    for (const p of products) {
      // If product has a group, deduplicate by group
      if (p.productGroupId) {
        if (seenGroups.has(p.productGroupId)) {
          continue;
        }
        seenGroups.add(p.productGroupId);
        const key = `group:${p.productGroupId}`;
        seen.set(key, p);
        continue;
      }
      const key = normalizeText(p.nameLt);
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, p);
      } else {
        const existingPrice = existing.priceRecords[0]?.salePrice ?? existing.priceRecords[0]?.regularPrice ?? Infinity;
        const newPrice = p.priceRecords[0]?.salePrice ?? p.priceRecords[0]?.regularPrice ?? Infinity;
        if (newPrice < existingPrice) {
          seen.set(key, p);
        }
      }
    }

    // Detect dominant category among results (for brand picker)
    const catCounts = new Map<string, number>();
    for (const p of [...seen.values()]) {
      if (p.canonicalCategory) catCounts.set(p.canonicalCategory, (catCounts.get(p.canonicalCategory) || 0) + 1);
    }
    const dominantCategory = catCounts.size > 0
      ? [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;

    const suggestions = [...seen.values()].slice(0, limit).map(p => ({
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
    }));

    return NextResponse.json({ suggestions, dominantCategory });
  }

  // Fallback: keyword search
  const normalized = normalizeText(q);
  const words = normalized.split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return NextResponse.json({ suggestions: [], dominantCategory: null });

  // Search by normalized index (diacritics-insensitive) and both name fields
  const products = await prisma.product.findMany({
    where: {
      AND: words.map(word => ({
        OR: [
          { searchIndex: { contains: word } },
          { nameLt: { contains: word } },
          { nameEn: { contains: word } },
        ]
      }))
    },
    select: {
      id: true,
      nameLt: true,
      nameEn: true,
      brand: true,
      canonicalCategory: true,
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

  // Deduplicate by productGroupId (if available), fallback to normalized name, keeping cheapest
  const seenGroups2 = new Set<number>();
  const seen2 = new Map<string, typeof products[0]>();
  for (const p of products) {
    if (p.productGroupId) {
      if (seenGroups2.has(p.productGroupId)) continue;
      seenGroups2.add(p.productGroupId);
      seen2.set(`group:${p.productGroupId}`, p);
      continue;
    }
    const key = normalizeText(p.nameLt);
    const existing = seen2.get(key);
    if (!existing) {
      seen2.set(key, p);
    } else {
      const existingPrice = existing.priceRecords[0]?.salePrice ?? existing.priceRecords[0]?.regularPrice ?? Infinity;
      const newPrice = p.priceRecords[0]?.salePrice ?? p.priceRecords[0]?.regularPrice ?? Infinity;
      if (newPrice < existingPrice) {
        seen2.set(key, p);
      }
    }
  }

  const catCounts2 = new Map<string, number>();
  for (const p of [...seen2.values()]) {
    if (p.canonicalCategory) catCounts2.set(p.canonicalCategory, (catCounts2.get(p.canonicalCategory) || 0) + 1);
  }
  const dominantCategory2 = catCounts2.size > 0
    ? [...catCounts2.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const suggestions2 = [...seen2.values()].slice(0, limit).map(p => ({
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
  }));

  return NextResponse.json({ suggestions: suggestions2, dominantCategory: dominantCategory2 });
}
