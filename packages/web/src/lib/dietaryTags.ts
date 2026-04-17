export type DietaryFilter = "vegan" | "vegetarian" | "gluten-free" | "lactose-free";

// Categories that contain animal products (not vegan/vegetarian)
const MEAT_CATEGORIES = new Set([
  "poultry", "beef", "pork", "lamb", "minced-meat", "deli-meat", "fish-seafood",
]);

// Categories that contain dairy/eggs (not vegan, ok for vegetarian)
const DAIRY_EGG_CATEGORIES = new Set([
  "milk", "cheese", "yogurt", "butter-cream", "cottage-cheese", "eggs",
]);

// Categories that always contain gluten
const ALWAYS_GLUTEN_CATEGORIES = new Set([
  "bread", "bakery", "pasta", "flour-baking",
]);

// Category hints that suggest gluten presence (need name check too)
const LIKELY_GLUTEN_CATEGORIES = new Set([
  "cereals", "snacks", "sweets-chocolate",
]);

// Categories naturally gluten-free (no name check needed)
const ALWAYS_GF_CATEGORIES = new Set([
  "poultry", "beef", "pork", "lamb", "minced-meat", "fish-seafood",
  "milk", "cheese", "yogurt", "butter-cream", "cottage-cheese", "eggs",
  "fruits", "vegetables", "salads-herbs", "mushrooms",
  "rice-grains", "oil-vinegar", "tea", "coffee", "juice", "water",
  "soda-soft-drinks", "wine", "spirits", "spices", "honey-jam",
]);

// Plant-based milk signals — vegan even though category is "milk"
const PLANT_MILK_KEYWORDS = [
  "oat", "soy", "soya", "almond", "rice milk", "coconut milk", "hemp", "plant",
  "avižų", "sojos", "migdolų", "augalinė", "augalinis",
];

// Gluten-free label signals in name
const GF_POSITIVE = [
  "gluten-free", "gluten free", "be gliuteno", "gf ", " gf",
];

// Gluten-containing signals in name for mixed categories
const GLUTEN_SIGNALS = [
  "wheat", "barley", "rye", "oat", "kvietinė", "miežių", "rugių", "avižų",
  "flour", "miltai", "biscuit", "cookie", "cracker", "muesli", "granola",
];

// Lactose-free signals
const LF_SIGNALS = [
  "lactose-free", "lactose free", "bez laktozy", "be laktozės", "laktozės",
  "laktozė laisvos", "lf ", "0% laktozės",
];

// Dairy signals (for lactose-free filter: exclude these unless LF signal present)
const DAIRY_SIGNALS = [
  "milk", "pienas", "cheese", "sūris", "yogurt", "jogurtas", "butter", "sviestas",
  "cream", "grietinė", "varškė", "kefir", "kefyras",
];

function haystack(product: { name: string; nameEn?: string | null; subcategory?: string | null }): string {
  return `${product.name} ${product.nameEn ?? ""} ${product.subcategory ?? ""}`.toLowerCase();
}

export function matchesDietaryFilter(
  filter: DietaryFilter,
  product: {
    name: string;
    nameEn?: string | null;
    canonicalCategory?: string | null;
    subcategory?: string | null;
  }
): boolean {
  const cat = product.canonicalCategory ?? "";
  const hay = haystack(product);

  switch (filter) {
    case "vegan": {
      if (MEAT_CATEGORIES.has(cat)) return false;
      if (DAIRY_EGG_CATEGORIES.has(cat)) {
        // Allow plant-based milk alternatives
        return cat === "milk" && PLANT_MILK_KEYWORDS.some((k) => hay.includes(k));
      }
      if (cat === "honey-jam") {
        // Jam is vegan, honey is not
        return hay.includes("jam") || hay.includes("džemas") || hay.includes("marmalade");
      }
      if (cat === "baby-food") return false;
      return true;
    }

    case "vegetarian": {
      if (MEAT_CATEGORIES.has(cat)) return false;
      if (cat === "baby-food") return false;
      return true;
    }

    case "gluten-free": {
      if (ALWAYS_GF_CATEGORIES.has(cat)) return true;
      if (ALWAYS_GLUTEN_CATEGORIES.has(cat)) {
        // Allow if product explicitly labelled GF
        return GF_POSITIVE.some((k) => hay.includes(k));
      }
      // Mixed categories: check for GF label first, then gluten signals
      if (GF_POSITIVE.some((k) => hay.includes(k))) return true;
      if (LIKELY_GLUTEN_CATEGORIES.has(cat) && GLUTEN_SIGNALS.some((k) => hay.includes(k))) return false;
      // Frozen food / ready meals / canned: lean towards excluding unless labelled
      if (["frozen-food", "ready-meals"].includes(cat) && GLUTEN_SIGNALS.some((k) => hay.includes(k))) return false;
      return true;
    }

    case "lactose-free": {
      // Non-dairy → naturally lactose-free
      if (!DAIRY_EGG_CATEGORIES.has(cat) && !DAIRY_SIGNALS.some((k) => hay.includes(k))) return true;
      // Dairy category or dairy name → require explicit LF label
      return LF_SIGNALS.some((k) => hay.includes(k));
    }
  }
}
