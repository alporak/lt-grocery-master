import { prisma } from "./db";
import { normalizeText, buildFlexibleConditions, scoreRelevance, semanticSearch } from "./search";
import { haversineDistance } from "./distance";
import { computeLineCost } from "./cost";
export { computeLineCost } from "./cost";

interface CompareItem {
  itemName: string;
  quantity: number;
  unit?: string;
}

// Units where qty > 1 means "find a multi-pack, not N single items"
const PACK_UNITS = new Set(["pack", "bottle", "pcs"]);

interface StoreMatch {
  productId: number;
  productName: string;
  price: number;
  unitPrice?: number;
  salePrice?: number;
  loyaltyPrice?: number;
  brand?: string;
  weightValue?: number;
  weightUnit?: string;
  imageUrl?: string;
  nameLt?: string;
  nameEn?: string;
  categoryLt?: string;
  score?: number;
  /** "pack" = this product already covers the full quantity (a multi-pack).
   *  "unit" = single item, line cost = price × quantity. */
  matchType?: "pack" | "unit";
}

interface StoreResult {
  storeId: number;
  storeName: string;
  storeChain: string;
  items: Array<{
    itemName: string;
    match: StoreMatch | null;
    candidates: StoreMatch[];
    lineCost: number;
  }>;
  totalCost: number;
  matchedCount: number;
}

interface SmartRecommendation {
  storeId: number;
  storeName: string;
  storeChain: string;
  totalCost: number;
  distanceKm: number | null;
  travelPenalty: number;
  missingPenalty: number;
  smartScore: number;
  matchedCount: number;
  totalItems: number;
}

export interface CompareResult {
  storeResults: StoreResult[];
  cheapestStoreId: number | null;
  cheapestTotal: number;
  splitResult: {
    items: Array<{
      itemName: string;
      bestStoreId: number;
      bestStoreName: string;
      bestPrice: number;
      productName: string;
    }>;
    totalCost: number;
  };
  smartRecommendation?: SmartRecommendation[];
}

/**
 * Compare grocery list items across all stores.
 * Uses fuzzy matching by normalized name.
 */
export async function compareGroceryList(
  items: CompareItem[],
  language: string = "lt",
  userLat?: number,
  userLng?: number
): Promise<CompareResult> {
  const stores = await prisma.store.findMany({ where: { enabled: true } });

  const storeResults: StoreResult[] = [];

  for (const store of stores) {
    const storeItems: StoreResult["items"] = [];

    for (const item of items) {
      const candidates = await findCandidates(store.id, item.itemName, language, 5, item.quantity, item.unit);
      const match = candidates.length > 0 ? candidates[0] : null;
      const lineCost = match ? computeLineCost(match, item.quantity) : 0;

      storeItems.push({
        itemName: item.itemName,
        match,
        candidates,
        lineCost,
      });
    }

    const matchedCount = storeItems.filter((i) => i.match !== null).length;
    const totalCost = storeItems.reduce((sum, i) => sum + i.lineCost, 0);

    storeResults.push({
      storeId: store.id,
      storeName: store.name,
      storeChain: store.chain,
      items: storeItems,
      totalCost,
      matchedCount,
    });
  }

  // Find cheapest single store (only among those that matched all items)
  const fullMatches = storeResults.filter(
    (s) => s.matchedCount === items.length
  );
  const cheapest =
    fullMatches.length > 0
      ? fullMatches.reduce((best, s) =>
          s.totalCost < best.totalCost ? s : best
        )
      : storeResults.reduce(
          (best, s) =>
            s.matchedCount > best.matchedCount ||
            (s.matchedCount === best.matchedCount &&
              s.totalCost < best.totalCost)
              ? s
              : best,
          storeResults[0]
        );

  // Split shopping: cheapest per item across stores
  const splitItems = items.map((item) => {
    let bestPrice = Infinity;
    let bestStoreId = 0;
    let bestStoreName = "";
    let bestProductName = "";

    for (const sr of storeResults) {
      const si = sr.items.find((i) => i.itemName === item.itemName);
      if (si?.match && si.lineCost > 0 && si.lineCost < bestPrice) {
        bestPrice = si.lineCost;
        bestStoreId = sr.storeId;
        bestStoreName = sr.storeName;
        bestProductName = si.match.productName;
      }
    }

    return {
      itemName: item.itemName,
      bestStoreId,
      bestStoreName,
      bestPrice: bestPrice === Infinity ? 0 : bestPrice,
      productName: bestProductName,
    };
  });

  const result: CompareResult = {
    storeResults,
    cheapestStoreId: cheapest?.storeId ?? null,
    cheapestTotal: cheapest?.totalCost ?? 0,
    splitResult: {
      items: splitItems,
      totalCost: splitItems.reduce((sum, i) => sum + i.bestPrice, 0),
    },
  };

  // Smart recommendation: distance-aware scoring
  if (userLat && userLng) {
    const storeIds = stores.map((s) => s.id);
    const locations = await prisma.storeLocation.findMany({
      where: { storeId: { in: storeIds }, lat: { not: null }, lng: { not: null } },
      select: { storeId: true, lat: true, lng: true },
    });

    // Travel cost per km walked (time + effort equivalent in €)
    const TRAVEL_COST_PER_KM = 1.0;
    // Penalty multiplier for each missing item (need another trip)
    const MISSING_PENALTY_MULT = 3.0;
    // Average item cost estimate for missing penalty
    const avgItemCost =
      storeResults.reduce((s, r) => s + r.totalCost, 0) /
        Math.max(storeResults.filter((r) => r.totalCost > 0).length, 1) /
        Math.max(items.length, 1) || 2.0;

    result.smartRecommendation = storeResults.map((sr) => {
      // Find nearest location for this store's chain
      const chainLocations = locations.filter((l) => l.storeId === sr.storeId);
      let distanceKm: number | null = null;
      if (chainLocations.length > 0) {
        distanceKm = Math.min(
          ...chainLocations.map((l) =>
            haversineDistance(userLat, userLng, l.lat!, l.lng!)
          )
        );
        distanceKm = Math.round(distanceKm * 100) / 100;
      }

      const travelPenalty = distanceKm !== null ? distanceKm * TRAVEL_COST_PER_KM : 0;
      const missingItems = items.length - sr.matchedCount;
      const missingPenalty = missingItems * avgItemCost * MISSING_PENALTY_MULT;

      // Dynamic distance weight: for cheap lists, distance matters more
      // For expensive lists (>€30), distance impact is proportionally smaller
      const listValueFactor = Math.max(1, 10 / Math.max(sr.totalCost, 1));
      const adjustedTravelPenalty = travelPenalty * Math.min(listValueFactor, 3);

      const smartScore = sr.totalCost + adjustedTravelPenalty + missingPenalty;

      return {
        storeId: sr.storeId,
        storeName: sr.storeName,
        storeChain: sr.storeChain,
        totalCost: Math.round(sr.totalCost * 100) / 100,
        distanceKm,
        travelPenalty: Math.round(adjustedTravelPenalty * 100) / 100,
        missingPenalty: Math.round(missingPenalty * 100) / 100,
        smartScore: Math.round(smartScore * 100) / 100,
        matchedCount: sr.matchedCount,
        totalItems: items.length,
      };
    });

    result.smartRecommendation.sort((a, b) => a.smartScore - b.smartScore);
  }

  return result;
}

// computeLineCost is re-exported from ./cost (browser-safe)

/**
 * Find multiple candidate product matches for a grocery item in a specific store.
 * Uses semantic search first, falls back to keyword matching.
 *
 * When the item has a pack-type unit (pack, bottle, pcs) and quantity > 1,
 * runs a dual-search strategy:
 *   1. Search for "{name} {qty}-pack" / "{name} {qty} {unit}" → multi-pack matches (matchType: "pack")
 *   2. Search for "{name}" → single-unit matches (matchType: "unit")
 * Candidates are sorted by effective line cost so the cheapest option wins.
 */
async function findCandidates(
  storeId: number,
  itemName: string,
  language: string,
  limit: number = 5,
  quantity: number = 1,
  unit?: string,
): Promise<StoreMatch[]> {
  const isPackSearch = quantity > 1 && !!unit && PACK_UNITS.has(unit);

  // Run both pack-specific and base searches when applicable
  const packCandidates: StoreMatch[] = [];
  const unitCandidates: StoreMatch[] = [];
  const seenIds = new Set<number>();

  const toMatch = (product: any, pr: any, score?: number, matchType?: "pack" | "unit"): StoreMatch => ({
    productId: product.id,
    productName: language === "en" ? product.nameEn || product.nameLt : product.nameLt,
    price: pr.regularPrice,
    unitPrice: pr.unitPrice ?? undefined,
    salePrice: pr.salePrice ?? undefined,
    loyaltyPrice: pr.loyaltyPrice ?? undefined,
    brand: product.brand ?? undefined,
    weightValue: product.weightValue ?? undefined,
    weightUnit: product.weightUnit ?? undefined,
    imageUrl: product.imageUrl ?? undefined,
    nameLt: product.nameLt,
    nameEn: product.nameEn ?? undefined,
    categoryLt: product.categoryLt ?? undefined,
    score,
    matchType,
  });

  if (isPackSearch) {
    // Search 1: pack-specific queries  (e.g., "water 6 pack", "water 6-pack")
    const packQueries = [
      `${itemName} ${quantity} ${unit}`,
      `${itemName} ${quantity}`,
    ];

    for (const pq of packQueries) {
      const results = await semanticSearch(pq, limit, [storeId]);
      if (results && results.length > 0) {
        const valid = results.filter((r) => r.score >= 0.45);
        if (valid.length > 0) {
          const products = await prisma.product.findMany({
            where: { id: { in: valid.map((r) => r.id) } },
            include: { priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 } },
          });
          const productMap = new Map(products.map((p) => [p.id, p]));
          for (const sr of valid) {
            if (seenIds.has(sr.id)) continue;
            const product = productMap.get(sr.id);
            if (product && product.priceRecords[0]) {
              // Verify it actually looks like a multi-pack (has quantity-like indicator in name)
              const nameCheck = (product.nameLt + " " + (product.nameEn || "")).toLowerCase();
              const qtyStr = String(Math.round(quantity));
              const looksLikePack =
                nameCheck.includes(`${qtyStr} `) ||
                nameCheck.includes(`${qtyStr}x`) ||
                nameCheck.includes(`x${qtyStr}`) ||
                nameCheck.includes(`${qtyStr}-`) ||
                nameCheck.includes(`${qtyStr}vnt`) ||
                nameCheck.includes(`${qtyStr}pak`);

              if (looksLikePack) {
                packCandidates.push(toMatch(product, product.priceRecords[0], sr.score, "pack"));
                seenIds.add(product.id);
              }
            }
          }
        }
      }
      if (packCandidates.length >= limit) break;
    }
  }

  // Search 2 (or only search): base item name
  const baseCandidates = await _searchByName(storeId, itemName, language, limit * 2, seenIds);
  for (const c of baseCandidates) {
    unitCandidates.push({ ...c, matchType: isPackSearch ? "unit" : undefined });
  }

  // Merge and sort by effective line cost
  const all = [...packCandidates, ...unitCandidates];
  all.sort((a, b) => {
    const costA = computeLineCost(a, quantity);
    const costB = computeLineCost(b, quantity);
    // Prefer matches with a cost > 0 (found products) over zero-cost
    if (costA === 0 && costB > 0) return 1;
    if (costB === 0 && costA > 0) return -1;
    return costA - costB;
  });

  return all.slice(0, limit);
}

/**
 * Core name-based search (semantic + keyword fallback).
 */
async function _searchByName(
  storeId: number,
  itemName: string,
  language: string,
  limit: number,
  seenIds: Set<number>,
): Promise<StoreMatch[]> {
  const candidates: StoreMatch[] = [];

  const toMatch = (product: any, pr: any, score?: number): StoreMatch => ({
    productId: product.id,
    productName: language === "en" ? product.nameEn || product.nameLt : product.nameLt,
    price: pr.regularPrice,
    unitPrice: pr.unitPrice ?? undefined,
    salePrice: pr.salePrice ?? undefined,
    loyaltyPrice: pr.loyaltyPrice ?? undefined,
    brand: product.brand ?? undefined,
    weightValue: product.weightValue ?? undefined,
    weightUnit: product.weightUnit ?? undefined,
    imageUrl: product.imageUrl ?? undefined,
    nameLt: product.nameLt,
    nameEn: product.nameEn ?? undefined,
    categoryLt: product.categoryLt ?? undefined,
    score,
  });

  // Try semantic search first
  const semanticResults = await semanticSearch(itemName, limit * 3, [storeId]);
  if (semanticResults && semanticResults.length > 0) {
    const validResults = semanticResults.filter((r) => r.score >= 0.4);
    if (validResults.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: validResults.map((r) => r.id) } },
        include: { priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      // Combined score: embedding (60%) + keyword relevance (40%)
      const combinedScored: Array<{ id: number; combined: number }> = [];
      for (const sr of validResults) {
        const product = productMap.get(sr.id);
        if (!product) continue;
        const kw = scoreRelevance(itemName, {
          nameLt: product.nameLt,
          nameEn: product.nameEn,
          searchIndex: product.searchIndex,
          categoryLt: product.categoryLt,
          brand: product.brand,
        });
        // Normalize kw score (typical max ~200) to 0–1
        const kwNorm = Math.min(kw / 200, 1);
        const combined = sr.score * 0.6 + kwNorm * 0.4;
        combinedScored.push({ id: sr.id, combined });
      }
      combinedScored.sort((a, b) => b.combined - a.combined);

      for (const { id, combined } of combinedScored) {
        if (seenIds.has(id)) continue;
        const product = productMap.get(id);
        if (product && product.priceRecords[0]) {
          candidates.push(toMatch(product, product.priceRecords[0], combined));
          seenIds.add(product.id);
        }
      }
    }
  }

  // Keyword fallback — uses synonym-expanded per-word OR conditions
  if (candidates.length < limit) {
    const flexConditions = buildFlexibleConditions(itemName);
    if (flexConditions.length > 0) {
      const products = await prisma.product.findMany({
        where: {
          storeId,
          id: { notIn: Array.from(seenIds) },
          AND: flexConditions,
        },
        include: {
          priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
        },
        take: limit * 2,
      });

      const scored = products.map((p) => ({
        product: p,
        score: scoreRelevance(itemName, {
          nameLt: p.nameLt,
          nameEn: p.nameEn,
          searchIndex: p.searchIndex,
          categoryLt: p.categoryLt,
          brand: p.brand,
        }),
      }));
      scored.sort((a, b) => b.score - a.score);

      for (const { product, score } of scored) {
        if (candidates.length >= limit) break;
        if (seenIds.has(product.id)) continue;
        const pr = product.priceRecords[0];
        if (!pr) continue;
        candidates.push(toMatch(product, pr, score / 200));
        seenIds.add(product.id);
      }
    }

    // Single-word fallback (last resort)
    if (candidates.length === 0) {
      const normalized = normalizeText(itemName);
      const words = normalized.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0) {
        const fallback = await prisma.product.findMany({
          where: {
            storeId,
            OR: [
              { searchIndex: { contains: words[0] } },
              { nameLt: { contains: words[0] } },
              { nameEn: { contains: words[0] } },
            ],
          },
          include: {
            priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
          },
          take: limit,
        });

        for (const product of fallback) {
          if (candidates.length >= limit) break;
          if (seenIds.has(product.id)) continue;
          const pr = product.priceRecords[0];
          if (!pr) continue;
          candidates.push(toMatch(product, pr));
          seenIds.add(product.id);
        }
      }
    }
  }

  return candidates.slice(0, limit);
}

/**
 * Legacy single-match wrapper.
 */
async function findBestMatch(
  storeId: number,
  itemName: string,
  language: string
): Promise<StoreMatch | null> {
  const candidates = await findCandidates(storeId, itemName, language, 1);
  return candidates[0] || null;
}

/**
 * Given a reference product (already chosen in one store),
 * find the best matching products in all other enabled stores,
 * filtered by canonicalCategory to prevent cross-category contamination.
 */
export async function findSimilarByProduct(
  productId: number,
  language: string = "lt",
): Promise<Record<number, StoreMatch[]>> {
  const refProduct = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      store: true,
      priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
    },
  });
  if (!refProduct) return {};

  const otherStores = await prisma.store.findMany({
    where: { enabled: true, id: { not: refProduct.storeId } },
  });

  // Build a rich search query from the reference product
  const searchQuery = [refProduct.brand, refProduct.nameLt]
    .filter(Boolean)
    .join(" ");

  const results: Record<number, StoreMatch[]> = {};

  const toMatch = (product: any, pr: any, score?: number): StoreMatch => ({
    productId: product.id,
    productName: language === "en" ? product.nameEn || product.nameLt : product.nameLt,
    price: pr.regularPrice,
    unitPrice: pr.unitPrice ?? undefined,
    salePrice: pr.salePrice ?? undefined,
    loyaltyPrice: pr.loyaltyPrice ?? undefined,
    brand: product.brand ?? undefined,
    weightValue: product.weightValue ?? undefined,
    weightUnit: product.weightUnit ?? undefined,
    imageUrl: product.imageUrl ?? undefined,
    nameLt: product.nameLt,
    nameEn: product.nameEn ?? undefined,
    categoryLt: product.categoryLt ?? undefined,
    score,
  });

  await Promise.all(
    otherStores.map(async (store) => {
      const semanticResults = await semanticSearch(searchQuery, 30, [store.id]);
      const storeMatches: StoreMatch[] = [];

      if (semanticResults && semanticResults.length > 0) {
        const validResults = semanticResults.filter((r) => r.score >= 0.45);
        if (validResults.length > 0) {
          const products = await prisma.product.findMany({
            where: {
              id: { in: validResults.map((r) => r.id) },
              // Filter by same category to avoid cross-category contamination
              ...(refProduct.canonicalCategory
                ? { canonicalCategory: refProduct.canonicalCategory }
                : {}),
            },
            include: { priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 } },
          });

          const productMap = new Map(products.map((p) => [p.id, p]));
          const combinedScored: Array<{ id: number; combined: number }> = [];

          for (const sr of validResults) {
            const product = productMap.get(sr.id);
            if (!product) continue;

            let combined = sr.score;
            // Bonus: same weight/size
            if (
              refProduct.weightValue &&
              product.weightValue === refProduct.weightValue &&
              product.weightUnit === refProduct.weightUnit
            ) {
              combined += 0.15;
            }
            // Bonus: same brand
            if (
              refProduct.brand &&
              product.brand &&
              normalizeText(product.brand) === normalizeText(refProduct.brand)
            ) {
              combined += 0.2;
            }
            combinedScored.push({ id: sr.id, combined });
          }

          combinedScored.sort((a, b) => b.combined - a.combined);
          for (const { id, combined } of combinedScored.slice(0, 5)) {
            const product = productMap.get(id);
            if (!product?.priceRecords[0]) continue;
            storeMatches.push(toMatch(product, product.priceRecords[0], combined));
          }
        }
      }

      // Keyword fallback if semantic found nothing
      if (storeMatches.length === 0) {
        const flexConditions = buildFlexibleConditions(refProduct.nameLt);
        if (flexConditions.length > 0) {
          const products = await prisma.product.findMany({
            where: {
              storeId: store.id,
              AND: flexConditions,
              ...(refProduct.canonicalCategory
                ? { canonicalCategory: refProduct.canonicalCategory }
                : {}),
            },
            include: { priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 } },
            take: 5,
          });
          for (const product of products) {
            if (!product.priceRecords[0]) continue;
            storeMatches.push(toMatch(product, product.priceRecords[0]));
          }
        }
      }

      if (storeMatches.length > 0) {
        results[store.id] = storeMatches;
      }
    })
  );

  return results;
}

function calculateSimilarity(a: string, b: string): number {
  const aWords = new Set(a.split(/\s+/));
  const bWords = new Set(b.split(/\s+/));
  let matches = 0;
  for (const w of aWords) {
    if (bWords.has(w)) matches++;
  }
  return matches / Math.max(aWords.size, 1);
}
