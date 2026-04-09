import { prisma } from "./db";

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
}

/**
 * Compare grocery list items across all stores.
 * Uses fuzzy matching by normalized name.
 */
export async function compareGroceryList(
  items: CompareItem[],
  language: string = "lt"
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

  return {
    storeResults,
    cheapestStoreId: cheapest?.storeId ?? null,
    cheapestTotal: cheapest?.totalCost ?? 0,
    splitResult: {
      items: splitItems,
      totalCost: splitItems.reduce((sum, i) => sum + i.bestPrice, 0),
    },
  };
}

/**
 * Fuzzy-match a grocery item name against products in a specific store.
 * Returns the best matching product with its latest price.
 */
async function findBestMatch(
  storeId: number,
  itemName: string,
  language: string
): Promise<StoreMatch | null> {
  const normalized = normalizeForSearch(itemName);
  const searchField = language === "en" ? "nameEn" : "nameLt";

  // Search with LIKE for the main term
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return null;

  // Build a search: all words must appear somewhere in the name
  const products = await prisma.product.findMany({
    where: {
      storeId,
      AND: words.map((word) => ({
        [searchField]: { contains: word },
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
        [searchField]: { contains: words[0] },
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

    // Pick the one with best name similarity
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
    const name = (
      language === "en" ? p.nameEn || p.nameLt : p.nameLt
    ).toLowerCase();
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

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
