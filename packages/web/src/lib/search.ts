/**
 * Intelligent product search with Lithuanian/Russian/Ukrainian/Polish synonym expansion,
 * diacritics normalization, Cyrillic transliteration, and cross-language matching.
 */

// Cyrillic → Latin transliteration for Russian/Ukrainian grocery searches
const CYRILLIC_MAP: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  // Ukrainian extras
  'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g',
};

// Polish diacritics → Latin
const POLISH_MAP: Record<string, string> = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
};

// ── Category taxonomy ────────────────────────────────────────────────────────
// Used by buildIntentFromText() to infer what type of product the user wants.
// When intent is known, productMatchesIntent() filters out wrong-category results
// (e.g. "beef shoulder" must never match dog treats or bouillon cubes).

export interface QueryIntent {
  category: string | null;     // e.g. "meat/beef-cuts", "dairy/milk"
  confidence: "high" | "low";  // high = at least one token mapped to a category
  excludes: string[];           // category slugs that are incompatible with this intent
  keywords: string[];           // normalized tokens from the original query
}

interface SynonymGroupDef {
  terms: string[];
  category: string;
}

// Lithuanian grocery synonym groups — searching any term finds all related products.
// Each group includes: Lithuanian, English, Russian (transliterated), Ukrainian (transliterated), Polish terms.
const SYNONYM_GROUP_DEFS: SynonymGroupDef[] = [
  // ── Poultry ──────────────────────────────────────────────────────────────────
  { category: "meat/poultry", terms: ["vistiena", "visciena", "broileris", "broiler", "chicken", "paukstiena", "vist",
    "kuritsa", "kurица", "kuryatina", "ptitsa"] },
  { category: "meat/poultry/breast", terms: ["vistienos krut", "vistienos krutine", "chicken breast", "broilerio krutinele",
    "broileriu krutinele", "krutineles file", "fileja",
    "kurinaya grud", "filje"] },
  { category: "meat/poultry/thigh", terms: ["vistienos saunel", "chicken thigh", "saunelis", "paukstienos saunel", "bedryshko"] },
  { category: "meat/poultry/wing", terms: ["vistienos sparn", "chicken wing", "sparnelis", "sparnel", "krilishko"] },
  { category: "meat/poultry/turkey", terms: ["kalakutiena", "turkey", "indikas", "indeika", "indeyka"] },

  // ── Meat ─────────────────────────────────────────────────────────────────────
  { category: "meat/pork-cuts", terms: ["kiauliena", "pork", "kiaul", "svinina", "wieprzowina"] },
  { category: "meat/beef-cuts", terms: ["jautiena", "beef", "jaut", "govyadina", "wolowina", "wołowina"] },
  { category: "meat/lamb-cuts", terms: ["aviena", "lamb", "baranina"] },
  { category: "meat/veal", terms: ["veršiena", "verstiena", "veal", "telyatina"] },
  { category: "meat/rabbit", terms: ["triušiena", "rabbit", "krolik"] },
  { category: "meat/ground", terms: ["malta mesa", "farsas", "minced", "mince", "ground meat", "malti",
    "farsh", "mielone"] },
  { category: "meat/processed", terms: ["desra", "desrele", "sausage", "desr", "kolbasa", "kielbasa"] },
  { category: "meat/processed", terms: ["kumpi", "ham", "kumpis", "vetschina", "szynka"] },
  { category: "meat/processed", terms: ["slanine", "sonine", "bacon", "bekon"] },
  { category: "meat/organs", terms: ["kepenys", "liver", "pecheн", "pechen", "watrobka"] },
  { category: "meat", terms: ["mesa", "meat", "myaso", "mieso"] },

  // ── Fish & Seafood ────────────────────────────────────────────────────────────
  { category: "seafood/salmon", terms: ["lazda", "lasis", "lasisa", "salmon", "losos"] },
  { category: "seafood/herring", terms: ["silke", "herring", "seledka"] },
  { category: "seafood/fish", terms: ["menkė", "menke", "cod", "treska"] },
  { category: "seafood/tuna", terms: ["tunas", "tuna", "tunets"] },
  { category: "seafood/shrimp", terms: ["krevetes", "krevetės", "shrimp", "prawn", "krevetki"] },
  { category: "seafood/fish", terms: ["zuvis", "fish", "ryba", "ryby"] },

  // ── Dairy ─────────────────────────────────────────────────────────────────────
  { category: "dairy/milk", terms: ["pienas", "milk", "pien", "moloko", "mleko"] },
  { category: "dairy/butter", terms: ["sviestas", "butter", "sviest", "maslo"] },
  { category: "dairy/cheese", terms: ["suris", "cheese", "sur", "syr", "ser"] },
  { category: "dairy/cottage-cheese", terms: ["varske", "cottage cheese", "varsk", "tvorog", "twarog"] },
  { category: "dairy/yogurt", terms: ["jogurtas", "yogurt", "yoghurt", "jogurt"] },
  { category: "dairy/sour-cream", terms: ["grietine", "sour cream", "grietin", "grietinele",
    "smetana", "smietana"] },
  { category: "dairy/cream", terms: ["grietinėlė", "grietinele", "heavy cream", "whipping cream", "slivki"] },
  { category: "dairy/kefir", terms: ["kefyras", "kefir", "kefyr"] },
  { category: "dairy/eggs", terms: ["kiausiniai", "eggs", "egg", "kiausini", "yaytsa", "yayco", "jajka", "jajko"] },

  // ── Bread / Bakery ────────────────────────────────────────────────────────────
  { category: "bakery/bread", terms: ["duona", "bread", "duon", "khleb", "hleb", "chleb"] },
  { category: "bakery/baguette", terms: ["batonas", "baguette", "baton"] },
  { category: "bakery/bun", terms: ["bandele", "bun", "bandel", "bulochka", "bulka"] },
  { category: "bakery/cake", terms: ["pyragas", "cake", "pyrag", "pirog", "tort"] },
  { category: "bakery/cookie", terms: ["sausainis", "biscuit", "cookie", "pechenie"] },
  { category: "bakery/croissant", terms: ["kruasanas", "croissant"] },

  // ── Produce — Vegetables ──────────────────────────────────────────────────────
  { category: "produce/potato", terms: ["bulve", "potato", "bulves", "potatoes", "bulv",
    "kartoshka", "kartofel", "ziemniaki"] },
  { category: "produce/garlic", terms: ["česnakas", "cesnakas", "garlic", "chesnok", "czosnek"] },
  { category: "produce/onion", terms: ["svogūnas", "svogunas", "onion", "svoguna", "svogan",
    "luk", "cebula"] },
  { category: "produce/carrot", terms: ["morka", "carrot", "mork", "morkov", "marchew"] },
  { category: "produce/tomato", terms: ["pomidoras", "pomidorai", "tomato", "pomidor"] },
  { category: "produce/cucumber", terms: ["agurkas", "agurkai", "cucumber", "agurk", "ogurtsy", "ogurets", "ogurek"] },
  { category: "produce/cabbage", terms: ["kopūstas", "kopustas", "cabbage", "kopust", "kapusta"] },
  { category: "produce/broccoli", terms: ["brokoliai", "broccoli", "brokoli"] },
  { category: "produce/cauliflower", terms: ["žiedinis kopūstas", "ziedinis kopustas", "cauliflower", "tsvetнaya kapusta", "kalafior"] },
  { category: "produce/spinach", terms: ["špinatai", "spinatai", "spinach", "shpinat", "szpinak"] },
  { category: "produce/mushroom", terms: ["grybai", "mushroom", "griby", "grzyby"] },
  { category: "produce/pepper", terms: ["paprika", "pepper", "perts", "pieprz"] },
  { category: "produce/zucchini", terms: ["cukinija", "zucchini", "courgette", "kabachok"] },
  { category: "produce/eggplant", terms: ["baklažanas", "baklazan", "eggplant", "aubergine"] },
  { category: "produce/lettuce", terms: ["salotos", "lettuce", "salad", "salot", "salat", "salata"] },
  { category: "produce/olive", terms: ["alyvuogiu", "alyvuogiai", "olive", "alyv", "oliwki"] },
  { category: "produce/corn", terms: ["kukurūzai", "kukurukai", "corn", "kukuruza", "kukurydza"] },
  { category: "produce/peas", terms: ["žirneliai", "zirneliai", "peas", "goroshek", "groszek"] },
  { category: "produce/beans", terms: ["pupelės", "pupeles", "beans", "fasol", "fasola"] },
  { category: "produce/spring-onion", terms: ["svogūnlaiškiai", "svogunlaiskai", "spring onion", "green onion", "zelyony luk"] },

  // ── Produce — Fruit ───────────────────────────────────────────────────────────
  { category: "produce/apple", terms: ["obuolys", "obuoliai", "apple", "obuol", "yabloko", "jablko"] },
  { category: "produce/pear", terms: ["kriaušė", "kriause", "pear", "grusha", "gruszka"] },
  { category: "produce/banana", terms: ["bananas", "bananai", "banana", "banan"] },
  { category: "produce/orange", terms: ["apelsinas", "apelsinai", "orange", "apelsin", "pomarantscha", "pomarancza"] },
  { category: "produce/lemon", terms: ["citrina", "citrinos", "lemon", "citrin", "limon"] },
  { category: "produce/mandarin", terms: ["mandarinas", "mandarins", "mandarin", "tangerine"] },
  { category: "produce/strawberry", terms: ["braškė", "braske", "braskes", "strawberry", "brask", "klubnika", "truskawka"] },
  { category: "produce/cherry", terms: ["vyšnia", "visnia", "cherry", "vishnya", "wisnia"] },
  { category: "produce/grape", terms: ["vynuogės", "vynuoges", "grape", "vinograd", "winogrona"] },
  { category: "produce/watermelon", terms: ["arbūzas", "arbuzas", "watermelon", "arbuz"] },
  { category: "produce/melon", terms: ["melionas", "melon"] },
  { category: "produce/pineapple", terms: ["ananasas", "pineapple", "ananas"] },
  { category: "produce/avocado", terms: ["avokadas", "avocado"] },
  { category: "produce/mango", terms: ["mango"] },
  { category: "produce/raspberry", terms: ["avietė", "aviete", "raspberry", "malina", "maliny"] },
  { category: "produce/blueberry", terms: ["mėlynė", "melyne", "blueberry", "golubika", "borowka"] },

  // ── Beverages ─────────────────────────────────────────────────────────────────
  { category: "beverages/water", terms: ["vanduo", "water", "vand", "voda", "woda"] },
  { category: "beverages/sparkling-water", terms: ["gazuotas vanduo", "sparkling water", "mineral water", "mineralka", "mineralnaya voda", "woda gazowana"] },
  { category: "beverages/juice", terms: ["sultys", "juice", "sult", "sok"] },
  { category: "beverages/beer", terms: ["alus", "beer", "pivo", "piwo"] },
  { category: "beverages/wine", terms: ["vynas", "wine", "vyn", "vino", "wino"] },
  { category: "beverages/coffee", terms: ["kava", "coffee", "kav", "kofe", "kawa"] },
  { category: "beverages/tea", terms: ["arbata", "tea", "arbat", "chay", "herbata"] },
  { category: "beverages/lemonade", terms: ["limonadas", "lemonade", "limonad"] },
  { category: "beverages/energy-drink", terms: ["energetik", "energetikas", "energy drink"] },
  { category: "beverages/hot-chocolate", terms: ["pienas kakava", "hot chocolate", "kakao"] },

  // ── Staples ───────────────────────────────────────────────────────────────────
  { category: "pantry/rice", terms: ["ryžiai", "ryziai", "rice", "ryzi", "ris", "ryz"] },
  { category: "pantry/pasta", terms: ["makaronai", "pasta", "makaron", "makarony"] },
  { category: "pantry/flour", terms: ["miltai", "flour", "milt", "muka", "maka"] },
  { category: "pantry/sugar", terms: ["cukrus", "sugar", "cukr", "sakhar", "cukier"] },
  { category: "pantry/salt", terms: ["druska", "salt", "drusk", "sol"] },
  { category: "pantry/oil", terms: ["aliejus", "oil", "aliej", "olej"] },
  { category: "pantry/vinegar", terms: ["actas", "vinegar", "uksus", "ocet"] },
  { category: "pantry/tomato-sauce", terms: ["pomidorų padažas", "pomidoru padazas", "tomato sauce", "tomatniy sous", "sos pomidorowy"] },
  { category: "pantry/ketchup", terms: ["kečupas", "ketchup"] },
  { category: "pantry/mayo", terms: ["majonezas", "mayonnaise", "mayo", "mayonez", "majonez"] },
  { category: "pantry/honey", terms: ["medus", "honey", "myod", "miod"] },
  { category: "pantry/jam", terms: ["uogienė", "uogiene", "jam", "varene", "dzem"] },
  { category: "pantry/chocolate", terms: ["šokoladas", "sokoladas", "chocolate", "shokolad", "czekolada"] },
  { category: "pantry/oats", terms: ["avižos", "avizos", "oats", "oatmeal", "ovsyanka", "owsianka", "porridge"] },
  { category: "pantry/cereal", terms: ["dribsniai", "cereal", "cornflakes", "lopya"] },
  { category: "pantry/yeast", terms: ["mielės", "mieles", "yeast", "drozhzhi"] },
  { category: "pantry/baking-powder", terms: ["kepimo milteliai", "baking powder", "razrikhitel"] },
  { category: "pantry/starch", terms: ["krakmolas", "starch", "krakmal", "skrobia"] },
  { category: "pantry/spices", terms: ["zeldiniai", "spices", "herbs", "spetsii", "przyprawy"] },
  { category: "pantry/spices", terms: ["pipiras", "black pepper", "chyorny perts", "pieprz czarny"] },
  { category: "pantry/spices", terms: ["lauro lapai", "lauro lapas", "bay leaf", "lavroviy list", "listek laurowy"] },

  // ── Bouillon / Broth — MUST stay in pantry, NOT meat ─────────────────────────
  { category: "pantry/bouillon", terms: ["sultinys", "bouillon", "buljona", "broth", "buljons", "bujons"] },

  // ── Frozen / Convenience ──────────────────────────────────────────────────────
  { category: "frozen/vegetables", terms: ["šaldytos daržovės", "saldytos darzoves", "frozen vegetables", "zamorozhennye ovoschi"] },
  { category: "frozen/pizza", terms: ["pica", "pizza"] },
  { category: "frozen/dumplings", terms: ["pelmenys", "dumplings", "pelmeni", "pierogi"] },
  { category: "frozen/pancakes", terms: ["blyneliai", "pancakes", "bliny"] },

  // ── Dairy extras ─────────────────────────────────────────────────────────────
  { category: "dairy/cheese-snack", terms: ["sūrelis", "surelis", "cheese snack", "glazirovaniy syrok"] },
  { category: "dairy/milk", terms: ["gėrimas su pienu", "gerimas su pienu", "milk drink", "molochniy napitok"] },

  // ── Household ─────────────────────────────────────────────────────────────────
  { category: "household/detergent", terms: ["skalbimo", "detergent", "skalb", "skalbiklis", "stiralnoye sredstvo", "proszek do prania"] },
  { category: "household/dishwasher", terms: ["indaplovių", "indaploviu", "dishwasher", "indaplov", "posudomoechnoe"] },
  { category: "household/toilet-paper", terms: ["tualetinis popierius", "toilet paper", "tualetini", "tualetnaya bumaga", "papier toaletowy"] },
  { category: "household/napkins", terms: ["servetėlės", "servietkes", "napkins", "tissues", "salfetki", "serwetki"] },
  { category: "household/cleaner", terms: ["ploviklis", "cleaning spray", "cleaner", "chistyaszcheye"] },

  // ── Personal care ─────────────────────────────────────────────────────────────
  { category: "personal-care/shampoo", terms: ["šampūnas", "sampunas", "shampoo", "shampun", "szampon"] },
  { category: "personal-care/soap", terms: ["muilas", "soap", "mylo", "mydlo"] },
  { category: "personal-care/toothpaste", terms: ["dantų pasta", "dantu pasta", "toothpaste", "zubnaya pasta", "pasta do zebow"] },
  { category: "personal-care/deodorant", terms: ["dezodorantas", "deodorant", "dezodorant"] },
  { category: "personal-care/razor", terms: ["skutimosi", "razor", "britva"] },
  { category: "personal-care/diaper", terms: ["sauskelnės", "sauskelines", "diapers", "nappies", "pampersy", "pieluchy"] },
];

// Derived for backward compatibility — all code using SYNONYM_GROUPS or SYNONYM_MAP still works unchanged.
const SYNONYM_GROUPS: string[][] = SYNONYM_GROUP_DEFS.map((g) => g.terms);

// Map each term to its synonym group for O(1) lookup (unchanged from before).

// Map each term to its synonym group for O(1) lookup
export const SYNONYM_MAP = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    SYNONYM_MAP.set(term.toLowerCase(), group);
  }
}

// Map each term → its category definition (for intent extraction)
const TERM_CATEGORY_MAP = new Map<string, SynonymGroupDef>();
for (const def of SYNONYM_GROUP_DEFS) {
  for (const term of def.terms) {
    TERM_CATEGORY_MAP.set(term.toLowerCase(), def);
  }
}

// Categories whose presence in a product makes it incompatible with fresh-food intents.
// Keyed by the problematic category prefix.
const FOOD_INCOMPATIBLE_CATEGORIES = ["pet-food", "household", "personal-care"];

// When intent is a fresh-food family, also exclude these pantry sub-categories
// (e.g. "beef" should never match "Gallina Blanca Beef Bouillon").
const FRESH_MEAT_EXCLUDES = ["pantry/bouillon", "pantry/sauce", "snacks", "pet-food", "household", "personal-care"];
const FRESH_FOOD_EXCLUDES = ["pet-food", "household", "personal-care"];

function buildExcludes(category: string): string[] {
  const family = category.split("/")[0];
  if (family === "meat" || family === "seafood") return [...FRESH_MEAT_EXCLUDES];
  if (["dairy", "produce", "bakery"].includes(family)) return [...FRESH_FOOD_EXCLUDES];
  if (family === "beverages") return [...FOOD_INCOMPATIBLE_CATEGORIES];
  return [];
}

/**
 * Derive search intent from free-text query (rule-based, deterministic).
 * Returns the dominant category + exclusion list so callers can filter results.
 */
export function buildIntentFromText(itemName: string): QueryIntent {
  const normalized = normalizeText(itemName);
  const words = normalized.split(/\s+/).filter((w) => w.length >= 2);
  const keywords = words;

  const matchedDefs: SynonymGroupDef[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const bigram = i < words.length - 1 ? `${word} ${words[i + 1]}` : null;

    // Bigram first (more specific)
    if (bigram && TERM_CATEGORY_MAP.has(bigram)) {
      matchedDefs.push(TERM_CATEGORY_MAP.get(bigram)!);
      i++;
      continue;
    }

    // Direct match
    if (TERM_CATEGORY_MAP.has(word)) {
      matchedDefs.push(TERM_CATEGORY_MAP.get(word)!);
      continue;
    }

    // Prefix match (e.g. "bulv" → "bulve/potato")
    for (const [key, def] of TERM_CATEGORY_MAP) {
      if (key.startsWith(word) && word.length >= 4) {
        matchedDefs.push(def);
        break;
      }
    }
  }

  if (matchedDefs.length === 0) {
    return { category: null, confidence: "low", excludes: [], keywords };
  }

  // Pick the most specific (longest) category from matched defs
  const sorted = [...matchedDefs].sort((a, b) => b.category.length - a.category.length);
  const topCategory = sorted[0].category;
  const excludes = buildExcludes(topCategory);

  return { category: topCategory, confidence: "high", excludes, keywords };
}

/**
 * Returns false if the product's category text signals it belongs to an excluded category.
 * Used to filter semantic search results that are technically "similar" (e.g. beef bouillon
 * when the user searched for beef shoulder).
 */
export function productMatchesIntent(
  product: {
    canonicalCategory?: string | null;
    categoryLt?: string | null;
    nameLt: string;
    nameEn?: string | null;
    brand?: string | null;
  },
  intent: QueryIntent,
): boolean {
  if (intent.excludes.length === 0) return true;

  const haystack = [
    product.canonicalCategory,
    product.categoryLt,
    product.nameEn,
    product.brand,
  ].filter(Boolean).join(" ").toLowerCase();

  const nameLower = product.nameLt.toLowerCase();

  for (const excl of intent.excludes) {
    const exclFamily = excl.split("/")[0];
    switch (exclFamily) {
      case "pet-food":
        if (
          haystack.includes("augintini") ||
          haystack.includes("gyvunams") ||
          haystack.includes("pet food") ||
          haystack.includes("dog") ||
          haystack.includes("cat food") ||
          haystack.includes("bird food") ||
          nameLower.includes("pedigree") ||
          nameLower.includes("whiskas") ||
          nameLower.includes("friskies") ||
          nameLower.includes("purina") ||
          nameLower.includes("dreamies") ||
          nameLower.includes("sheba") ||
          nameLower.includes("felix") ||
          (haystack.includes("dog") && haystack.includes("treat"))
        ) return false;
        break;
      case "pantry":
        if (excl === "pantry/bouillon") {
          if (
            haystack.includes("buljona") ||
            haystack.includes("sultinys") ||
            haystack.includes("bouillon") ||
            haystack.includes("buljons") ||
            nameLower.includes("bouillon") ||
            nameLower.includes("gallina blanca") ||
            (nameLower.includes("knorr") && haystack.includes("broth"))
          ) return false;
        }
        break;
      case "snacks":
        if (
          (haystack.includes("snack") || haystack.includes("chip") || haystack.includes("uzkan")) &&
          !haystack.includes("meat") && !haystack.includes("mesa")
        ) return false;
        break;
      case "household":
        if (
          haystack.includes("household") ||
          haystack.includes("detergent") ||
          haystack.includes("namų apyvoka") ||
          haystack.includes("skalbim")
        ) return false;
        break;
      case "personal-care":
        if (
          haystack.includes("hygiene") ||
          haystack.includes("higiena") ||
          haystack.includes("personal care") ||
          haystack.includes("šampūnas") ||
          haystack.includes("shampoo")
        ) return false;
        break;
    }
  }
  return true;
}

/**
 * Category match bonus for scoreRelevance — products that explicitly sit in the
 * expected category family score higher than off-category products that merely
 * contain a shared keyword (e.g. "beef shoulder" → +30 for a product in Mėsa/Jautiena
 * vs 0 for a product in Augintiniai/Šunys).
 */
export function categoryBonus(
  intent: QueryIntent,
  product: { canonicalCategory?: string | null; categoryLt?: string | null },
): number {
  if (!intent.category) return 0;
  const family = intent.category.split("/")[0];
  const catText = [product.canonicalCategory, product.categoryLt].filter(Boolean).join(" ").toLowerCase();

  const FAMILY_SIGNALS: Record<string, string[]> = {
    meat: ["mesa", "jautiena", "kiauliena", "paukstiena", "meat", "mėsa"],
    seafood: ["zuvis", "fish", "seafood", "žuvis"],
    dairy: ["pienas", "dairy", "milk", "suris", "jogurt"],
    produce: ["darzeoves", "vaisiai", "produce", "darzoves", "fresh"],
    bakery: ["duona", "kepin", "bakery", "bread"],
    pantry: ["pantry", "bakalea", "staples"],
    beverages: ["gerimai", "beverage", "drink"],
    frozen: ["saldyt", "frozen", "saldyti"],
    household: ["household", "namų"],
    "personal-care": ["higiena", "hygiene"],
  };

  const signals = FAMILY_SIGNALS[family] ?? [];
  if (signals.some((s) => catText.includes(s))) return 30;
  return 0;
}

/**
 * Remove Lithuanian diacritics and normalize text for search.
 * Also handles Cyrillic (RU/UA) via transliteration and Polish diacritics.
 */
export function normalizeText(text: string): string {
  let result = text.toLowerCase();

  // Transliterate Cyrillic → Latin (Russian / Ukrainian)
  let cyrillicResult = "";
  for (const ch of result) {
    cyrillicResult += CYRILLIC_MAP[ch] ?? ch;
  }
  result = cyrillicResult;

  // Polish diacritics → Latin
  for (const [from, to] of Object.entries(POLISH_MAP)) {
    result = result.replaceAll(from, to);
  }

  // Lithuanian-specific character replacements
  const LT_MAP: Record<string, string> = {
    'ą': 'a', 'č': 'c', 'ę': 'e', 'ė': 'e', 'į': 'i',
    'š': 's', 'ų': 'u', 'ū': 'u', 'ž': 'z',
  };
  for (const [from, to] of Object.entries(LT_MAP)) {
    result = result.replaceAll(from, to);
  }

  // NFD normalize for any remaining diacritics
  result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Remove non-alphanumeric except spaces
  result = result.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return result;
}

/**
 * Simple Levenshtein edit distance between two strings.
 * Used for fuzzy fallback matching on short words.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[b.length];
}

/**
 * Find the closest synonym group key for a query word, tolerating typos.
 * Returns the group if the best match has edit distance ≤ maxDist.
 */
export function fuzzyFindSynonymGroup(word: string, maxDist = 2): string[] | null {
  if (word.length < 4) return null;
  let best: string[] | null = null;
  let bestDist = maxDist + 1;
  for (const [key, group] of SYNONYM_MAP) {
    if (Math.abs(key.length - word.length) > maxDist) continue;
    const d = levenshtein(word, key);
    if (d <= maxDist && d < bestDist) {
      bestDist = d;
      best = group;
    }
  }
  return best;
}

/**
 * Expand a search query with synonyms.
 * Returns an array of alternative search terms.
 */
export function expandSynonyms(query: string): string[] {
  const normalized = normalizeText(query);
  const words = normalized.split(/\s+/);
  const expansions = new Set<string>();
  expansions.add(normalized);

  // Check each word and bigram against synonym map
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const bigram = i < words.length - 1 ? `${word} ${words[i + 1]}` : "";
    
    // Check bigram first (more specific)
    if (bigram) {
      const bigramGroup = SYNONYM_MAP.get(bigram);
      if (bigramGroup) {
        for (const syn of bigramGroup) {
          expansions.add(syn);
        }
      }
    }
    
    // Then individual word
    const group = SYNONYM_MAP.get(word);
    if (group) {
      for (const syn of group) {
        expansions.add(syn);
      }
    }
    
    // Also check partial matches (prefix)
    for (const [key, grp] of SYNONYM_MAP) {
      if (key.startsWith(word) && word.length >= 3) {
        for (const syn of grp) {
          expansions.add(syn);
        }
        break; // Only match first prefix group
      }
    }

    // Fuzzy fallback: tolerate 1 typo for words >= 5 chars
    if (!group && word.length >= 5) {
      const fuzzyGroup = fuzzyFindSynonymGroup(word, 1);
      if (fuzzyGroup) {
        for (const syn of fuzzyGroup) expansions.add(syn);
      }
    }
  }

  return [...expansions];
}

/**
 * Build search conditions for Prisma that search both LT and EN names
 * with diacritics normalization and synonym expansion.
 */
export function buildSearchConditions(query: string): Record<string, unknown>[] {
  const normalized = normalizeText(query);
  const synonyms = expandSynonyms(query);
  
  // Each synonym becomes a LIKE condition on both name fields
  const conditions: Record<string, unknown>[] = [];
  
  // Primary: all words of the original query must appear in the name
  const words = normalized.split(/\s+/).filter(w => w.length >= 2);
  if (words.length > 0) {
    conditions.push({
      AND: words.map(word => ({
        OR: [
          { nameLt: { contains: word } },
          { nameEn: { contains: word } },
          { searchIndex: { contains: word } },
        ]
      }))
    });
  }
  
  // Secondary: synonym-expanded searches (any synonym match)
  for (const syn of synonyms) {
    if (syn === normalized) continue; // Skip the original
    const synWords = syn.split(/\s+/).filter(w => w.length >= 2);
    if (synWords.length === 0) continue;
    conditions.push({
      AND: synWords.map(word => ({
        OR: [
          { nameLt: { contains: word } },
          { nameEn: { contains: word } },
          { searchIndex: { contains: word } },
        ]
      }))
    });
  }
  
  return conditions;
}

/**
 * Score a product's relevance to a search query.
 * Higher score = better match.
 */
export function scoreRelevance(
  query: string,
  product: { nameLt: string; nameEn?: string | null; searchIndex?: string | null; categoryLt?: string | null; brand?: string | null }
): number {
  const q = normalizeText(query);
  const qWords = q.split(/\s+/).filter(w => w.length >= 2);
  if (qWords.length === 0) return 0;

  const nameLt = normalizeText(product.nameLt);
  const nameEn = product.nameEn ? normalizeText(product.nameEn) : "";
  const idx = product.searchIndex || "";
  const cat = product.categoryLt ? normalizeText(product.categoryLt) : "";
  const brand = product.brand ? normalizeText(product.brand) : "";

  let score = 0;

  // If ANY query word has a known LT synonym, it's a grocery-category query.
  // Reduce the raw English-word match bonus to prevent products that merely
  // contain the English word in their Lithuanian name (e.g. "SUGAR LADY body scrub",
  // "Milka", "šaltyje džiovinti" matching "salt") from outranking the actual
  // grocery product (Cukrus, Pienas, Druska).
  const qHasSynonyms = qWords.some(w => SYNONYM_MAP.has(w));
  // When query has synonyms, full-string bonus must stay below the regular synonym
  // match score (15) so that e.g. "Sugar Baby Arbūzai" (contains "sugar") doesn't
  // outscore "Cukrus CLEVER" (has LT synonym, no English word in name).
  const fullMatchBonus = qHasSynonyms ? 3 : 100;

  // Exact full-query match in name.
  // For synonym-known grocery queries, skip nameEn full-match bonus entirely —
  // "Sugar Cane Bowls" (nameEn) should not boost tableware for "sugar" query.
  if (nameLt.includes(q)) score += fullMatchBonus;
  if (!qHasSynonyms && nameEn.includes(q)) score += fullMatchBonus;

  // Word-level matching in name vs category vs brand
  for (const w of qWords) {
    const synGroup = SYNONYM_MAP.get(w);
    const wHasSyn = !!synGroup;

    // Reduce per-word direct match when a LT synonym exists — the English word
    // appearing inside a product name is noisy (e.g. "milka" contains "milk").
    // For wHasSyn words, nameEn match gives 0 — "Sugar Cane Bowls" nameEn should
    // not score for "sugar" query. Non-synonym words (e.g. "breast") still get +20.
    if (nameLt.includes(w)) score += wHasSyn ? 5 : 20;
    if (nameEn.includes(w)) score += wHasSyn ? 0 : 20;
    if (cat.includes(w)) score += 5;
    if (brand.includes(w)) score += 5;
    if (idx.includes(w) && !nameLt.includes(w)) score += 3;

    // Synonym boost: if the product name contains a synonym of this query word
    if (synGroup) {
      let synMatched = false;

      // High-priority: product name STARTS WITH the LT synonym → this product
      // IS the category (e.g. "Sviestas DVARO" starts with "sviestas" for query "butter").
      // Require length >= 7 to skip ambiguous 5-6 char stubs like "sviest" (6) that
      // would match "Sviest. kąsneliai" (snack abbreviation) and outscore actual butter.
      // 6-char words like "pienas"/"cukrus" fall through to regular synonym match (+15)
      // which still beats English-word-in-name matches (+5) so ranking stays correct.
      for (const syn of synGroup) {
        const synNorm = normalizeText(syn);
        if (synNorm !== w && synNorm.length >= 7) {
          if (nameLt.startsWith(synNorm + " ") || nameLt === synNorm) {
            score += 120;
            synMatched = true;
            break;
          }
        }
      }

      // Regular synonym match (synonym appears anywhere in name)
      if (!synMatched) {
        for (const syn of synGroup) {
          const synNorm = normalizeText(syn);
          if ((nameLt.includes(synNorm) || nameEn.includes(synNorm)) && synNorm !== w) {
            score += 15;
            synMatched = true;
            break;
          }
        }
      }

      // Prefix-based synonym lookup (e.g. query "sviest" matches group containing "sviestas")
      if (!synMatched) {
        for (const [key, group] of SYNONYM_MAP) {
          if (key.startsWith(w) && w.length >= 4 && key !== w) {
            for (const syn of group) {
              const synNorm = normalizeText(syn);
              if (nameLt.includes(synNorm) || nameEn.includes(synNorm)) {
                score += 10;
                break;
              }
            }
            break;
          }
        }
      }
    }
  }

  // Word coverage: what fraction of query words matched the name.
  // For synonym-known grocery terms, check whether any LT synonym appears as a
  // FULL WORD in nameLt (word-boundary match). This prevents "cukr" (prefix stub)
  // from matching inside "cukranendriu" (sugarcane), and "sugar" from matching in
  // "Arbūzai Sugar Baby 2" via the English cultivar name.
  // Non-synonym words (e.g. "breast" in "chicken breast") still use both fields.
  const paddedLt = ` ${nameLt} `;
  const paddedNameWords = ` ${nameLt} ${nameEn} `;
  const matchedWords = qWords.filter(w => {
    if (SYNONYM_MAP.has(w)) {
      const synGroup = SYNONYM_MAP.get(w)!;
      return synGroup.some(syn => {
        const synNorm = normalizeText(syn);
        if (synNorm === w) return false; // skip the query word itself (English)
        return paddedLt.includes(` ${synNorm} `) || nameLt === synNorm;
      });
    }
    return paddedNameWords.includes(` ${w} `) || nameLt === w || nameEn === w;
  }).length;
  score += (matchedWords / qWords.length) * 30;

  // Name starts with query — only for non-synonym queries (when query is the LT
  // product name itself). For English grocery terms, the LT product ("Cukrus")
  // starts with its LT name, not "sugar", so this bonus is irrelevant and would
  // incorrectly boost "Sugar Cane Bowls" (nameEn.startsWith("sugar")).
  if (!qHasSynonyms && (nameLt.startsWith(q) || nameEn.startsWith(q))) score += 50;

  // Penalize very long names (likely compound/unrelated products)
  const nameWordCount = nameLt.split(/\s+/).length;
  if (nameWordCount > 8) score -= (nameWordCount - 8) * 2;

  return score;
}

/**
 * Build per-word AND conditions where each word's OR includes its synonyms.
 * Fixes cases like "linguine pasta" → AND[contains(linguine), OR(contains(pasta), contains(makaronai), contains(makaron))]
 * which matches "Makaronai LINGUINE" in the database.
 *
 * Returns Prisma AND-array ready to use as `{ AND: buildFlexibleConditions(...) }`.
 */
export function buildFlexibleConditions(itemName: string): Record<string, unknown>[] {
  const normalized = normalizeText(itemName);
  const words = normalized.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return [];

  return words.map((word) => {
    // Collect all alternative terms for this word
    const alternatives = new Set<string>([word]);

    // Direct match in synonym map
    const directGroup = SYNONYM_MAP.get(word);
    if (directGroup) {
      for (const syn of directGroup) {
        const synNorm = normalizeText(syn);
        // Add each word of the synonym phrase individually
        for (const part of synNorm.split(/\s+/).filter((p) => p.length >= 2)) {
          alternatives.add(part);
        }
      }
    }

    // Prefix match (e.g. "makaron" → matches "makaronai" group key)
    let foundGroup = !!directGroup;
    if (!directGroup && word.length >= 4) {
      for (const [key, group] of SYNONYM_MAP) {
        if (key.startsWith(word)) {
          foundGroup = true;
          for (const syn of group) {
            const synNorm = normalizeText(syn);
            for (const part of synNorm.split(/\s+/).filter((p) => p.length >= 2)) {
              alternatives.add(part);
            }
          }
          break;
        }
      }
    }

    // Fuzzy fallback: tolerate 1 typo for words >= 5 chars with no exact/prefix match
    if (!foundGroup && word.length >= 5) {
      const fuzzyGroup = fuzzyFindSynonymGroup(word, 1);
      if (fuzzyGroup) {
        for (const syn of fuzzyGroup) {
          const synNorm = normalizeText(syn);
          for (const part of synNorm.split(/\s+/).filter((p) => p.length >= 2)) {
            alternatives.add(part);
          }
        }
      }
    }

    const termConditions = [...alternatives].flatMap((term) => [
      { searchIndex: { contains: term } },
      { nameLt: { contains: term } },
      { nameEn: { contains: term } },
    ]);

    return { OR: termConditions };
  });
}

const EMBEDDER_URL = process.env.EMBEDDER_URL || "http://embedder:8000";

/**
 * Search products using the embedder service's semantic search.
 * Returns ranked product IDs with similarity scores.
 * Returns null if embedder is unavailable (caller should fall back to keyword search).
 */
export async function semanticSearch(
  query: string,
  limit: number = 100,
  storeIds?: number[],
): Promise<{ id: number; score: number }[] | null> {
  try {
    const body: Record<string, unknown> = { query, limit };
    if (storeIds && storeIds.length > 0) body.store_ids = storeIds;
    const res = await fetch(`${EMBEDDER_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results || null;
  } catch {
    return null;
  }
}
