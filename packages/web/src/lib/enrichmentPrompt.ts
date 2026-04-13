import { CATEGORY_LABELS } from "@/lib/categoryLabels";

// Must match ENRICH_VERSION in packages/embedder/main.py
export const ENRICH_VERSION = 2;

const CATEGORY_IDS = Object.keys(CATEGORY_LABELS).join(", ");

export const SYSTEM_PROMPT = `You are an expert grocery product analyst specializing in Lithuanian grocery stores (IKI, RIMI, Barbora, Promo Cash & Carry).

For EACH product, return a JSON object. Return all products as: {"results": [{...}, {...}]}

Each object MUST have these fields:
- name_clean: Clean English product name. Format: "[Brand] [Description] [Size]". Example: "Rokiškio Fresh Milk 2.5% 1L"
- name_lt_clean: Same format but in clean Lithuanian. Example: "Rokiškio Šviežias Pienas 2.5% 1L"
- brand: Extracted brand name (string or null). Rules:
    * "Rokiškio pienas" → "Rokiškio"
    * "IKI vištiena" → "IKI"
    * "RIMI sultys" → "RIMI"
    * "Žemaitijos sviestas" → "Žemaitijos"
    * "Dvaro grietinėlė" → "Dvaro"
    * "Coca-Cola" → "Coca-Cola", "Pepsi" → "Pepsi", "Danone" → "Danone"
    * Leading ALLCAPS words are usually brands: "ALMA vanduo" → "Alma"
    * If truly no brand, return null
- canonical_category: MUST be one of these exact IDs: ${CATEGORY_IDS}
    Key rules:
    * Still/sparkling/mineral water → "water"
    * Flavored water with sugar, lemonade, cola, energy drinks → "soda-soft-drinks"
    * Fresh/UHT/plant milk → "milk", kefir/yogurt → "yogurt"
    * Any beer (incl. non-alcoholic) → "beer", wine → "wine", spirits/vodka → "spirits"
    * Cleaning sprays/powders → "cleaning", laundry detergent/softener → "laundry"
    * Toilet paper/tissues/napkins → "paper-products"
    * Shampoo/soap/deodorant → "personal-care"
    * Dog/cat food → "pet-food"
    * Deli meats/sausages/ham → "deli-meat", minced/ground meat → "minced-meat"
- subcategory: More specific type within category (string). Examples:
    * water: "still", "sparkling", "flavored", "mineral"
    * milk: "fresh", "UHT", "oat milk", "lactose-free", "plant-based"
    * cheese: "hard", "soft", "fresh", "blue", "cream cheese"
    * meat/poultry: "breast", "drumsticks", "thighs", "whole", "marinated", "smoked"
    * juice: "100% juice", "nectar", "smoothie", "concentrate"
    * beer: "lager", "ale", "wheat beer", "non-alcoholic", "dark"
    * bread: "white", "rye", "whole grain", "sourdough", "toast"
    * yogurt: "plain", "fruit", "drinking", "Greek-style", "kefir"
    * If no meaningful subcategory, use the canonical_category en name
- is_food: boolean (false for cleaning, laundry, pet-food, paper-products, personal-care, health)
- tags_en: 6-8 English search terms a shopper would use (include brand, product type, variants)
- tags_lt: 6-8 Lithuanian search terms
- attributes: object with filterable properties relevant to this product type:
    * water: {"type": "still|sparkling|flavored", "flavor": "lemon|plain|...", "size_ml": 500}
    * milk: {"fat_percent": 2.5, "type": "fresh|UHT|lactose-free|oat"}
    * cheese: {"type": "hard|soft|fresh", "milk_source": "cow|goat|sheep"}
    * meat: {"cut": "breast|drumstick|...", "state": "raw|marinated|smoked|frozen"}
    * beer: {"type": "lager|ale|...", "alcohol_percent": 5.0, "non_alcoholic": false}
    * Other products: include the most useful 1-3 filterable attributes

CRITICAL: Return ONLY valid JSON. No markdown. No explanations. Exactly one object per input product in "results" array.`;

export interface ProductForPrompt {
  id: number;
  nameLt: string;
  nameEn: string | null;
  categoryLt: string | null;
  brand: string | null;
}

/** Replicates Python's _build_product_text() */
export function buildProductText(p: ProductForPrompt): string {
  const parts = [p.nameLt];
  if (p.nameEn) parts.push(p.nameEn);
  if (p.categoryLt) parts.push(p.categoryLt);
  if (p.brand) parts.push(p.brand);
  return parts.join(" | ");
}

/** Build the full prompt to send to the LLM (system + user message combined for easy copy-paste) */
export function buildFullPrompt(products: ProductForPrompt[]): string {
  const userLines = products.map((p, i) => `Product ${i + 1}: ${buildProductText(p)}`).join("\n");
  return `[SYSTEM]\n${SYSTEM_PROMPT}\n\n[USER]\n${userLines}`;
}

/** Build just the user message (for UIs that show system/user separately) */
export function buildUserMessage(products: ProductForPrompt[]): string {
  return products.map((p, i) => `Product ${i + 1}: ${buildProductText(p)}`).join("\n");
}

// ── Response types ────────────────────────────────────────────────────────

export interface EnrichmentItem {
  name_clean: string;
  name_lt_clean?: string;
  brand: string | null;
  canonical_category: string;
  subcategory: string;
  is_food: boolean;
  tags_en?: string[];
  tags_lt?: string[];
  attributes?: Record<string, unknown>;
}

export interface ParsedResult {
  ok: boolean;
  items: (EnrichmentItem | null)[];
  rawResults: unknown[];
  error?: string;
  warnings: string[];
}

/** Strip markdown code fences from LLM output */
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
}

/** Replicate Python's _normalize_brand() */
export function normalizeBrand(brand: string | null | undefined): string | null {
  if (!brand) return null;
  const b = brand.trim();
  if (!b || b.toLowerCase() === "null") return null;
  // Short all-caps keep as-is (IKI, RIMI, etc.)
  if (b === b.toUpperCase() && b.length <= 6) return b;
  // Long all-caps → title-case each word
  if (b === b.toUpperCase()) {
    return b.split(/\s+/).map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
  }
  return b;
}

/** Validate category against known IDs */
export function validateCategory(cat: string | null | undefined): string | null {
  if (cat && cat in CATEGORY_LABELS) return cat;
  return null;
}

/** Parse LLM response text into structured results */
export function parseEnrichmentResponse(text: string, expectedCount: number): ParsedResult {
  const warnings: string[] = [];
  const clean = stripCodeFences(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    return { ok: false, items: [], rawResults: [], error: `Invalid JSON: ${e}`, warnings };
  }

  // Extract the results array
  let rawResults: unknown[] = [];
  if (Array.isArray(parsed)) {
    rawResults = parsed;
  } else if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.results)) {
      rawResults = obj.results;
    } else {
      // Single object — wrap it
      if ("name_clean" in obj) {
        rawResults = [obj];
        warnings.push("LLM returned a single object instead of {results:[...]}. Wrapped automatically.");
      } else {
        return { ok: false, items: [], rawResults: [], error: 'Response missing "results" array', warnings };
      }
    }
  } else {
    return { ok: false, items: [], rawResults: [], error: "Unexpected response format", warnings };
  }

  if (rawResults.length !== expectedCount) {
    warnings.push(`Expected ${expectedCount} results, got ${rawResults.length}. Extra/missing entries will be handled.`);
  }

  // Validate each item
  const items: (EnrichmentItem | null)[] = [];
  for (let i = 0; i < expectedCount; i++) {
    const raw = rawResults[i];
    if (!raw || typeof raw !== "object") {
      warnings.push(`Product ${i + 1}: missing result from LLM`);
      items.push(null);
      continue;
    }
    const r = raw as Record<string, unknown>;
    if (!r.name_clean) {
      warnings.push(`Product ${i + 1}: missing name_clean`);
      items.push(null);
      continue;
    }
    const validCat = validateCategory(r.canonical_category as string);
    if (!validCat) {
      warnings.push(`Product ${i + 1}: invalid canonical_category "${r.canonical_category}" — will be saved as null`);
    }
    items.push({
      name_clean: String(r.name_clean),
      name_lt_clean: r.name_lt_clean ? String(r.name_lt_clean) : undefined,
      brand: normalizeBrand(r.brand as string),
      canonical_category: validCat ?? "",
      subcategory: r.subcategory ? String(r.subcategory) : "",
      is_food: r.is_food !== false,
      tags_en: Array.isArray(r.tags_en) ? (r.tags_en as string[]) : undefined,
      tags_lt: Array.isArray(r.tags_lt) ? (r.tags_lt as string[]) : undefined,
      attributes: typeof r.attributes === "object" && r.attributes !== null
        ? (r.attributes as Record<string, unknown>)
        : undefined,
    });
  }

  const validCount = items.filter(Boolean).length;
  return {
    ok: validCount > 0,
    items,
    rawResults,
    warnings,
  };
}
