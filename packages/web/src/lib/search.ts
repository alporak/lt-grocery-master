/**
 * Intelligent product search with Lithuanian synonym expansion,
 * diacritics normalization, and cross-language matching.
 */

// Lithuanian grocery synonym groups — searching any term finds all related products
const SYNONYM_GROUPS: string[][] = [
  // Poultry
  ["vistiena", "visciena", "broileris", "broiler", "chicken", "paukstiena", "vist"],
  ["vistienos krut", "vistienos krutine", "chicken breast", "broilerio krutinele", "broileriu krutinele", "krutineles file", "fileja"],
  ["vistienos saunel", "chicken thigh", "saunelis", "paukstienos saunel"],
  ["vistienos sparn", "chicken wing", "sparnelis", "sparnel"],
  
  // Meat
  ["kiauliena", "pork", "kiaul"],
  ["jautiena", "beef", "jaut"],
  ["aviena", "lamb"],
  ["malta mesa", "faršas", "farsas", "minced", "mince", "ground meat", "malti"],
  ["desra", "desrele", "sausage", "desr"],
  ["kumpi", "ham", "kumpis"],
  ["slanine", "sonine", "bacon"],
  ["mesa", "meat"],
  
  // Dairy
  ["pienas", "milk", "pien"],
  ["sviestas", "butter", "sviest"],
  ["suris", "cheese", "sur"],
  ["varske", "cottage cheese", "varsk"],
  ["jogurtas", "yogurt", "yoghurt", "jogurt"],
  ["grietine", "sour cream", "grietin", "grietinele", "cream"],
  ["kefyras", "kefir", "kefyr"],
  ["kiausiniai", "eggs", "egg", "kiausini"],

  // Bread / Bakery
  ["duona", "bread", "duon"],
  ["batonas", "baguette", "baton"],
  ["bandele", "bun", "bandel"],
  ["pyragas", "cake", "pyrag"],
  
  // Produce
  ["bulve", "potato", "bulves", "potatoes", "bulv"],
  ["morka", "carrot", "mork"],
  ["svogunai", "onion", "svoguna", "svogan"],
  ["pomidoras", "pomidorai", "tomato", "pomidor"],
  ["agurkas", "agurkai", "cucumber", "agurk"],
  ["obuolys", "obuoliai", "apple", "obuol"],
  ["bananas", "bananai", "banana", "banan"],
  ["apelsinas", "apelsinai", "orange", "apelsin"],
  ["citrina", "citrinos", "lemon", "citrin"],
  ["braske", "braskes", "strawberry", "brask"],
  ["salotos", "lettuce", "salad", "salot"],
  ["kopustas", "cabbage", "kopust"],

  // Beverages
  ["vanduo", "water", "vand"],
  ["sultys", "juice", "sult"],
  ["alus", "beer"],
  ["vynas", "wine", "vyn"],
  ["kava", "coffee", "kav"],
  ["arbata", "tea", "arbat"],
  ["limonadas", "lemonade", "limonad"],
  
  // Staples
  ["ryziai", "rice", "ryzi"],
  ["makaronai", "pasta", "makaron"],
  ["miltai", "flour", "milt"],
  ["cukrus", "sugar", "cukr"],
  ["druska", "salt", "drusk"],
  ["aliejus", "oil", "aliej"],
  
  // Cleaning 
  ["skalbimo", "detergent", "skalb", "skalbiklis"],
  ["indaploviu", "dishwasher", "indaplov"],
  ["tualetinis popierius", "toilet paper", "tualetini"],
];

// Map each term to its synonym group for O(1) lookup
const SYNONYM_MAP = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    SYNONYM_MAP.set(term.toLowerCase(), group);
  }
}

/**
 * Remove Lithuanian diacritics and normalize text for search.
 */
export function normalizeText(text: string): string {
  // Lithuanian-specific character replacements
  const LT_MAP: Record<string, string> = {
    'ą': 'a', 'č': 'c', 'ę': 'e', 'ė': 'e', 'į': 'i',
    'š': 's', 'ų': 'u', 'ū': 'u', 'ž': 'z',
    'Ą': 'A', 'Č': 'C', 'Ę': 'E', 'Ė': 'E', 'Į': 'I',
    'Š': 'S', 'Ų': 'U', 'Ū': 'U', 'Ž': 'Z',
  };
  
  let result = text.toLowerCase();
  for (const [from, to] of Object.entries(LT_MAP)) {
    result = result.replaceAll(from, to);
  }
  // Also NFD normalize for any other diacritics
  result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Remove non-alphanumeric except spaces
  result = result.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return result;
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
    for (const [key, group] of SYNONYM_MAP) {
      if (key.startsWith(word) && word.length >= 3) {
        for (const syn of group) {
          expansions.add(syn);
        }
        break; // Only match first prefix group
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

  // Exact full-query match in name (highest signal)
  if (nameLt.includes(q)) score += 100;
  if (nameEn.includes(q)) score += 100;

  // Word-level matching in name vs category vs brand
  for (const w of qWords) {
    if (nameLt.includes(w)) score += 20;
    if (nameEn.includes(w)) score += 20;
    if (cat.includes(w)) score += 5;
    if (brand.includes(w)) score += 5;
    if (idx.includes(w) && !nameLt.includes(w)) score += 3;
  }

  // Word coverage: what fraction of query words matched the name
  const nameWords = `${nameLt} ${nameEn}`;
  const matchedWords = qWords.filter(w => nameWords.includes(w)).length;
  score += (matchedWords / qWords.length) * 30;

  // Name starts with query (strong signal for autocomplete-style searches)
  if (nameLt.startsWith(q) || nameEn.startsWith(q)) score += 50;

  // Penalize very long names (likely compound/unrelated products)
  const nameWordCount = nameLt.split(/\s+/).length;
  if (nameWordCount > 8) score -= (nameWordCount - 8) * 2;

  return score;
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
