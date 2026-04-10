import { prisma } from "./db";
import { normalizeText, buildSearchConditions, semanticSearch } from "./search";
import { haversineDistance } from "./distance";

interface CompareItem {
  itemName: string;
  quantity: number;
}

interface StoreMatch {
  productId: number;
  productName: string;
  price: number;
  unitPrice?: number;
  salePrice?: number;
  loyaltyPrice?: number;
}

interface StoreResult {
  storeId: number;
  storeName: string;
  storeChain: string;
  items: Array<{
    itemName: string;
    match: StoreMatch | null;
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
      const match = await findBestMatch(store.id, item.itemName, language);
      const bestPrice = match
        ? Math.min(
            match.price,
            match.salePrice ?? Infinity,
            match.loyaltyPrice ?? Infinity
          )
        : 0;

      storeItems.push({
        itemName: item.itemName,
        match,
        lineCost: match ? bestPrice * item.quantity : 0,
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

/**
 * Fuzzy-match a grocery item name against products in a specific store.
 * Uses semantic search first, falls back to keyword matching.
 */
async function findBestMatch(
  storeId: number,
  itemName: string,
  language: string
): Promise<StoreMatch | null> {
  // Try semantic search first
  const semanticResults = await semanticSearch(itemName, 5, [storeId]);
  if (semanticResults && semanticResults.length > 0) {
    // Pick the best match above a similarity threshold
    const best = semanticResults[0];
    if (best.score >= 0.4) {
      const product = await prisma.product.findUnique({
        where: { id: best.id },
        include: { priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 } },
      });
      if (product && product.priceRecords[0]) {
        const pr = product.priceRecords[0];
        return {
          productId: product.id,
          productName: language === "en" ? product.nameEn || product.nameLt : product.nameLt,
          price: pr.regularPrice,
          unitPrice: pr.unitPrice ?? undefined,
          salePrice: pr.salePrice ?? undefined,
          loyaltyPrice: pr.loyaltyPrice ?? undefined,
        };
      }
    }
  }

  // Fallback: keyword matching
  const normalized = normalizeText(itemName);
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return null;

  // Use searchIndex (diacritics-normalized) + name fields for matching
  const products = await prisma.product.findMany({
    where: {
      storeId,
      AND: words.map((word) => ({
        OR: [
          { searchIndex: { contains: word } },
          { nameLt: { contains: word } },
          { nameEn: { contains: word } },
        ],
      })),
    },
    include: {
      priceRecords: {
        orderBy: { scrapedAt: "desc" },
        take: 1,
      },
    },
    take: 10,
  });

  if (products.length === 0) {
    // Fallback: try with just the first significant word
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
        priceRecords: {
          orderBy: { scrapedAt: "desc" },
          take: 1,
        },
      },
      take: 5,
    });

    if (fallback.length === 0) return null;

    const best = fallback[0];
    const pr = best.priceRecords[0];
    if (!pr) return null;

    return {
      productId: best.id,
      productName: language === "en" ? best.nameEn || best.nameLt : best.nameLt,
      price: pr.regularPrice,
      unitPrice: pr.unitPrice ?? undefined,
      salePrice: pr.salePrice ?? undefined,
      loyaltyPrice: pr.loyaltyPrice ?? undefined,
    };
  }

  // Pick the product whose name is closest to the search term
  const scored = products.map((p) => {
    const name = normalizeText(
      language === "en" ? p.nameEn || p.nameLt : p.nameLt
    );
    const similarity = calculateSimilarity(normalized, name);
    return { product: p, similarity };
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  const best = scored[0].product;
  const pr = best.priceRecords[0];
  if (!pr) return null;

  return {
    productId: best.id,
    productName: language === "en" ? best.nameEn || best.nameLt : best.nameLt,
    price: pr.regularPrice,
    unitPrice: pr.unitPrice ?? undefined,
    salePrice: pr.salePrice ?? undefined,
    loyaltyPrice: pr.loyaltyPrice ?? undefined,
  };
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
