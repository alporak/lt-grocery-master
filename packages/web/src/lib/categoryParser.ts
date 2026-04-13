import type { PrismaClient } from "@prisma/client";

export interface EnrichmentBlob {
  name_clean?: string;
  brand?: string;
  canonical_category?: string;
  subcategory?: string;
  is_food?: boolean;
  tags_en?: string[];
  tags_lt?: string[];
  attributes?: Record<string, unknown>;
  // Written by the learning algorithm:
  suggested_brand?: string;
  suggested_category?: string;
  suggested_subcategory?: string;
  suggestion_confidence?: number;
  suggestion_source?: "brand_rule" | "category_rule" | "jaccard";
}

export interface LearnResult {
  updated: number;
  rules_brand: number;
  rules_category: number;
  elapsed_ms: number;
}

// Lithuanian diacritic normalization map (matches lib/search.ts pattern)
const LT_MAP: Record<string, string> = {
  ą: "a", č: "c", ę: "e", ė: "e", į: "i",
  š: "s", ų: "u", ū: "u", ž: "z",
};

function normalizeToken(text: string): string {
  let r = text.toLowerCase();
  for (const [f, t] of Object.entries(LT_MAP)) {
    r = r.replaceAll(f, t);
  }
  return r
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s,.()\[\]\/\\+\-&]+/)
    .map(normalizeToken)
    .filter((t) => t.length >= 3);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function runLearningAlgorithm(
  prisma: PrismaClient
): Promise<LearnResult> {
  const start = Date.now();
  let updated = 0;

  // ── Phase 1: Load all reviewed products ──────────────────────────────────
  const reviewed = await prisma.product.findMany({
    where: { reviewedAt: { not: null }, enrichedAt: { not: null } },
    select: {
      id: true,
      nameLt: true,
      brand: true,
      canonicalCategory: true,
      subcategory: true,
    },
  });

  if (reviewed.length === 0) {
    return { updated: 0, rules_brand: 0, rules_category: 0, elapsed_ms: Date.now() - start };
  }

  // ── Phase 2: Build brand rules ────────────────────────────────────────────
  // brandTokenMap: token → Map<brand, count>
  const brandTokenMap = new Map<string, Map<string, number>>();
  const brandFrequency = new Map<string, number>();

  for (const p of reviewed) {
    if (!p.brand) continue;
    const brand = p.brand.trim();
    brandFrequency.set(brand, (brandFrequency.get(brand) ?? 0) + 1);

    const tokens = tokenize(p.nameLt);
    const brandTokens = tokenize(brand);
    const brandNorm = normalizeToken(brand);

    for (const tok of tokens) {
      // Match: token is part of brand or brand is part of token
      const isMatch =
        brandNorm.includes(tok) ||
        tok.includes(brandNorm) ||
        brandTokens.some((bt) => bt === tok || bt.includes(tok) || tok.includes(bt));

      if (isMatch) {
        if (!brandTokenMap.has(tok)) brandTokenMap.set(tok, new Map());
        const bMap = brandTokenMap.get(tok)!;
        bMap.set(brand, (bMap.get(brand) ?? 0) + 1);
      }
    }
  }

  // Prune: keep token→brand if seen ≥ 2 times OR brand frequency ≥ 3
  const brandRules = new Map<string, string>(); // token → brand
  for (const [tok, bMap] of brandTokenMap) {
    let bestBrand = "";
    let bestScore = 0;
    for (const [brand, count] of bMap) {
      const freq = brandFrequency.get(brand) ?? 0;
      if (count >= 2 || freq >= 3) {
        if (count > bestScore) {
          bestScore = count;
          bestBrand = brand;
        }
      }
    }
    if (bestBrand) brandRules.set(tok, bestBrand);
  }

  // ── Phase 3: Build category word bags ────────────────────────────────────
  // categoryWordBags: category → Map<token, count>
  const categoryWordBags = new Map<string, Map<string, number>>();
  // subcategoryWordBags: category → Map<subcategory, Map<token, count>>
  const subcategoryWordBags = new Map<string, Map<string, Map<string, number>>>();

  for (const p of reviewed) {
    if (!p.canonicalCategory) continue;
    if (!categoryWordBags.has(p.canonicalCategory)) {
      categoryWordBags.set(p.canonicalCategory, new Map());
    }
    const bag = categoryWordBags.get(p.canonicalCategory)!;
    for (const tok of tokenize(p.nameLt)) {
      bag.set(tok, (bag.get(tok) ?? 0) + 1);
    }

    if (p.subcategory) {
      if (!subcategoryWordBags.has(p.canonicalCategory)) {
        subcategoryWordBags.set(p.canonicalCategory, new Map());
      }
      const subMap = subcategoryWordBags.get(p.canonicalCategory)!;
      if (!subMap.has(p.subcategory)) subMap.set(p.subcategory, new Map());
      const subBag = subMap.get(p.subcategory)!;
      for (const tok of tokenize(p.nameLt)) {
        subBag.set(tok, (subBag.get(tok) ?? 0) + 1);
      }
    }
  }

  // Pre-compute reviewed token sets for Jaccard
  const reviewedTokenSets = reviewed.map((p) => ({
    tokens: new Set(tokenize(p.nameLt)),
    canonicalCategory: p.canonicalCategory,
    subcategory: p.subcategory,
    brand: p.brand,
  }));

  // ── Phase 4: Score unreviewed products in batches ────────────────────────
  const BATCH_SIZE = 500;
  let skip = 0;
  const BRAND_CONFIDENCE_THRESHOLD = 0.6;
  const CATEGORY_SCORE_THRESHOLD = 2.5;
  const JACCARD_THRESHOLD = 0.25;

  while (true) {
    const batch = await prisma.product.findMany({
      where: { reviewedAt: null, enrichedAt: { not: null } },
      select: {
        id: true,
        nameLt: true,
        brand: true,
        canonicalCategory: true,
        subcategory: true,
        enrichment: true,
      },
      skip,
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;
    skip += BATCH_SIZE;

    const updates: Promise<unknown>[] = [];

    for (const product of batch) {
      const tokens = tokenize(product.nameLt);
      const tokenSet = new Set(tokens);

      // Parse existing enrichment
      let enrichment: EnrichmentBlob = {};
      try {
        if (product.enrichment) enrichment = JSON.parse(product.enrichment);
      } catch {
        /* ignore parse errors */
      }

      let suggestedBrand: string | undefined;
      let brandConfidence = 0;
      let suggestedCategory: string | undefined;
      let categoryConfidence = 0;
      let suggestedSubcategory: string | undefined;
      let suggestionSource: EnrichmentBlob["suggestion_source"];

      // Brand suggestion
      if (!product.brand) {
        const brandVotes = new Map<string, number>();
        for (const tok of tokens) {
          const brand = brandRules.get(tok);
          if (brand) brandVotes.set(brand, (brandVotes.get(brand) ?? 0) + 1);
        }
        let bestBrand = "";
        let bestVotes = 0;
        for (const [brand, votes] of brandVotes) {
          if (votes > bestVotes) {
            bestVotes = votes;
            bestBrand = brand;
          }
        }
        if (bestBrand && tokens.length > 0) {
          brandConfidence = bestVotes / Math.max(tokens.length, 1);
          if (brandConfidence > BRAND_CONFIDENCE_THRESHOLD) {
            suggestedBrand = bestBrand;
          }
        }
      }

      // Category suggestion via word bag
      let bestCatScore = 0;
      let bestCat = "";
      for (const [cat, bag] of categoryWordBags) {
        let score = 0;
        for (const tok of tokenSet) {
          score += bag.get(tok) ?? 0;
        }
        if (score > bestCatScore) {
          bestCatScore = score;
          bestCat = cat;
        }
      }

      if (bestCatScore >= CATEGORY_SCORE_THRESHOLD) {
        suggestedCategory = bestCat;
        categoryConfidence = Math.min(bestCatScore / 10, 1);
        suggestionSource = "category_rule";

        // Subcategory suggestion
        const subMap = subcategoryWordBags.get(bestCat);
        if (subMap) {
          let bestSubScore = 0;
          let bestSub = "";
          for (const [sub, subBag] of subMap) {
            let score = 0;
            for (const tok of tokenSet) score += subBag.get(tok) ?? 0;
            if (score > bestSubScore) {
              bestSubScore = score;
              bestSub = sub;
            }
          }
          if (bestSubScore >= 1) suggestedSubcategory = bestSub;
        }
      } else {
        // Jaccard fallback
        let bestJaccard = 0;
        let bestMatch: typeof reviewedTokenSets[0] | null = null;
        for (const r of reviewedTokenSets) {
          const j = jaccardSimilarity(tokenSet, r.tokens);
          if (j > bestJaccard) {
            bestJaccard = j;
            bestMatch = r;
          }
        }
        if (bestJaccard >= JACCARD_THRESHOLD && bestMatch?.canonicalCategory) {
          suggestedCategory = bestMatch.canonicalCategory;
          categoryConfidence = bestJaccard;
          suggestionSource = "jaccard";
          if (bestMatch.subcategory) suggestedSubcategory = bestMatch.subcategory;
        }
      }

      if (!suggestionSource && suggestedBrand) suggestionSource = "brand_rule";

      // Only write if we have something new to suggest
      const hasBrandSuggestion = suggestedBrand && suggestedBrand !== enrichment.suggested_brand;
      const hasCatSuggestion = suggestedCategory && suggestedCategory !== enrichment.suggested_category;

      if (!hasBrandSuggestion && !hasCatSuggestion) continue;

      const newEnrichment: EnrichmentBlob = { ...enrichment };
      if (suggestedBrand) {
        newEnrichment.suggested_brand = suggestedBrand;
        newEnrichment.suggestion_source = suggestionSource ?? "brand_rule";
      }
      if (suggestedCategory) {
        newEnrichment.suggested_category = suggestedCategory;
        newEnrichment.suggestion_confidence = categoryConfidence;
        newEnrichment.suggestion_source = suggestionSource ?? "category_rule";
      }
      if (suggestedSubcategory) {
        newEnrichment.suggested_subcategory = suggestedSubcategory;
      }

      updates.push(
        prisma.product.update({
          where: { id: product.id },
          data: { enrichment: JSON.stringify(newEnrichment) },
        })
      );
      updated++;
    }

    await Promise.all(updates);
  }

  return {
    updated,
    rules_brand: brandRules.size,
    rules_category: categoryWordBags.size,
    elapsed_ms: Date.now() - start,
  };
}
