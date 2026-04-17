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

// Lithuanian grocery synonym groups — searching any term finds all related products.
// Each group includes: Lithuanian, English, Russian (transliterated), Ukrainian (transliterated), Polish terms.
const SYNONYM_GROUPS: string[][] = [
  // ── Poultry ──────────────────────────────────────────────────────────────────
  ["vistiena", "visciena", "broileris", "broiler", "chicken", "paukstiena", "vist",
   "kuritsa", "kurица", "kuryatina", "ptitsa"],                                    // RU: курица, UA: курятина
  ["vistienos krut", "vistienos krutine", "chicken breast", "broilerio krutinele",
   "broileriu krutinele", "krutineles file", "fileja",
   "kurinaya grud", "filje"],
  ["vistienos saunel", "chicken thigh", "saunelis", "paukstienos saunel", "bedryshko"],
  ["vistienos sparn", "chicken wing", "sparnelis", "sparnel", "krilishko"],
  ["kalakutiena", "turkey", "indikas", "indeika", "indeyka"],                      // turkey

  // ── Meat ─────────────────────────────────────────────────────────────────────
  ["kiauliena", "pork", "kiaul", "svinina", "wieprzowina"],                        // RU: свинина, PL: wieprzowina
  ["jautiena", "beef", "jaut", "govyadina", "wolowina", "wołowina"],               // RU: говядина, PL: wołowina
  ["aviena", "lamb", "baranina"],                                                   // RU: баранина
  ["veršiena", "verstiena", "veal", "telyatina"],
  ["triušiena", "rabbit", "krolik"],
  ["malta mesa", "farsas", "minced", "mince", "ground meat", "malti",
   "farsh", "mielone"],                                                             // RU: фарш, PL: mielone
  ["desra", "desrele", "sausage", "desr", "kolbasa", "kielbasa"],                  // RU: колбаса, PL: kiełbasa
  ["kumpi", "ham", "kumpis", "vetschina", "szynka"],                               // RU: ветчина, PL: szynka
  ["slanine", "sonine", "bacon", "bekon"],
  ["kepenys", "liver", "pecheн", "pechen", "watrobka"],
  ["mesa", "meat", "myaso", "mieso"],

  // ── Fish & Seafood ────────────────────────────────────────────────────────────
  ["lazda", "lasis", "lasisa", "salmon", "losos", "losos", "losos"],               // LT: lašiša
  ["silke", "herring", "seledka"],                                                  // LT: silkė
  ["menkė", "menke", "cod", "treska"],
  ["tunas", "tuna", "tunets"],
  ["krevetes", "krevetės", "shrimp", "prawn", "krevetki"],
  ["zuvis", "fish", "ryba", "ryby"],                                                // LT: žuvis, RU: рыба

  // ── Dairy ─────────────────────────────────────────────────────────────────────
  ["pienas", "milk", "pien", "moloko", "mleko"],                                   // RU: молоко, PL: mleko
  ["sviestas", "butter", "sviest", "maslo", "maslo", "maslo"],                     // RU: масло, PL: masło
  ["suris", "cheese", "sur", "syr", "ser"],                                        // RU: сыр, PL: ser
  ["varske", "cottage cheese", "varsk", "tvorog", "twarog"],                       // RU: творог, PL: twaróg
  ["jogurtas", "yogurt", "yoghurt", "jogurt", "yogurt"],
  ["grietine", "sour cream", "grietin", "grietinele",
   "smetana", "smietana"],                                                          // RU: сметана, PL: śmietana
  ["grietinėlė", "grietinele", "heavy cream", "whipping cream", "slivki"],         // RU: сливки
  ["kefyras", "kefir", "kefyr"],
  ["kiausiniai", "eggs", "egg", "kiausini", "yaytsa", "yayco", "jajka", "jajko"],  // RU: яйца, PL: jajka

  // ── Bread / Bakery ────────────────────────────────────────────────────────────
  ["duona", "bread", "duon", "khleb", "hleb", "chleb"],                            // RU: хлеб, PL: chleb
  ["batonas", "baguette", "baton", "baton"],
  ["bandele", "bun", "bandel", "bulochka", "bulka"],
  ["pyragas", "cake", "pyrag", "pirog", "tort"],
  ["sausainis", "biscuit", "cookie", "pechenie"],
  ["kruasanas", "croissant"],

  // ── Produce — Vegetables ──────────────────────────────────────────────────────
  ["bulve", "potato", "bulves", "potatoes", "bulv",
   "kartoshka", "kartofel", "ziemniaki"],                                           // RU: картошка, PL: ziemniaki
  ["česnakas", "cesnakas", "garlic", "chesnok", "czosnek"],                        // RU: чеснок, PL: czosnek
  ["svogūnas", "svogunas", "onion", "svoguna", "svogan",
   "luk", "cebula"],                                                                // RU: лук, PL: cebula
  ["morka", "carrot", "mork", "morkov", "marchew"],                                // RU: морковь, PL: marchew
  ["pomidoras", "pomidorai", "tomato", "pomidor"],                                  // same in many langs
  ["agurkas", "agurkai", "cucumber", "agurk", "ogurtsy", "ogurets", "ogurek"],     // RU: огурец
  ["kopūstas", "kopustas", "cabbage", "kopust", "kapusta"],                        // RU/PL: капуста/kapusta
  ["brokoliai", "broccoli", "brokoli"],
  ["žiedinis kopūstas", "ziedinis kopustas", "cauliflower", "tsvetнaya kapusta", "kalafior"],
  ["špinatai", "spinatai", "spinach", "shpinat", "szpinak"],
  ["grybai", "mushroom", "griby", "grzyby"],                                        // RU: грибы, PL: grzyby
  ["paprika", "pepper", "perts", "pieprz"],
  ["cukinija", "zucchini", "courgette", "kabachok"],
  ["baklažanas", "baklazan", "eggplant", "aubergine", "baklazan"],
  ["salotos", "lettuce", "salad", "salot", "salat", "salata"],
  ["alyvuogiu", "alyvuogiai", "olive", "alyv", "maslinы", "oliwki"],
  ["kukurūzai", "kukurukai", "corn", "kukuruza", "kukurydza"],
  ["žirneliai", "zirneliai", "peas", "goroshek", "groszek"],
  ["pupelės", "pupeles", "beans", "fasol", "fasola"],
  ["svogūnlaiškiai", "svogunlaiskai", "spring onion", "green onion", "zelyony luk"],

  // ── Produce — Fruit ───────────────────────────────────────────────────────────
  ["obuolys", "obuoliai", "apple", "obuol", "yabloko", "jablko"],                  // RU: яблоко, PL: jabłko
  ["kriaušė", "kriause", "pear", "grusha", "gruszka"],
  ["bananas", "bananai", "banana", "banan"],
  ["apelsinas", "apelsinai", "orange", "apelsin", "pomarantscha", "pomarancza"],
  ["citrina", "citrinos", "lemon", "citrin", "limon"],
  ["mandarinas", "mandarins", "mandarin", "tangerine", "mandarin"],
  ["braškė", "braske", "braskes", "strawberry", "brask", "klubnika", "truskawka"],
  ["vyšnia", "visnia", "cherry", "vishnya", "wisnia"],
  ["vynuogės", "vynuoges", "grape", "vinograd", "winogrona"],
  ["arbūzas", "arbuzas", "watermelon", "arbuz"],
  ["melionas", "melon", "melon"],
  ["ananasas", "pineapple", "ananas"],
  ["avokadas", "avocado"],
  ["mango"],
  ["avietė", "aviete", "raspberry", "malina", "maliny"],
  ["mėlynė", "melyne", "blueberry", "golubika", "borowka"],

  // ── Beverages ─────────────────────────────────────────────────────────────────
  ["vanduo", "water", "vand", "voda", "woda"],
  ["gazuotas vanduo", "sparkling water", "mineral water", "mineralka", "mineralnaya voda", "woda gazowana"],
  ["sultys", "juice", "sult", "sok", "sok"],                                        // RU/PL: сок/sok
  ["alus", "beer", "pivo", "piwo"],                                                 // RU: пиво, PL: piwo
  ["vynas", "wine", "vyn", "vino", "wino"],
  ["kava", "coffee", "kav", "kofe", "kawa"],
  ["arbata", "tea", "arbat", "chay", "herbata"],
  ["limonadas", "lemonade", "limonad", "limonad"],
  ["sultinys", "energy drink", "energetik", "energetikas"],
  ["pienas kakava", "hot chocolate", "kakao", "kakao"],

  // ── Staples ───────────────────────────────────────────────────────────────────
  ["ryžiai", "ryziai", "rice", "ryzi", "ris", "ryz"],                              // RU: рис, PL: ryż
  ["makaronai", "pasta", "makaron", "makarony", "makaron"],                         // RU: макароны
  ["miltai", "flour", "milt", "muka", "maka"],                                     // RU: мука, PL: mąka
  ["cukrus", "sugar", "cukr", "sakhar", "sакhar", "cukier"],                       // RU: сахар, PL: cukier
  ["druska", "salt", "drusk", "sol", "sol"],                                        // RU: соль, PL: sól
  ["aliejus", "oil", "aliej", "maslo rastitelnoye", "olej"],                        // vegetable oil
  ["actas", "vinegar", "uksus", "ocet"],
  ["pomidorų padažas", "pomidoru padazas", "tomato sauce", "tomatniy sous", "sos pomidorowy"],
  ["kečupas", "ketchup", "ketchup"],
  ["majonezas", "mayonnaise", "mayo", "mayonez", "majonez"],
  ["medus", "honey", "myod", "miod"],
  ["uogienė", "uogiene", "jam", "varene", "dzem"],
  ["šokoladas", "sokoladas", "chocolate", "shokolad", "czekolada"],
  ["avižos", "avizos", "oats", "oatmeal", "ovsyanka", "owsianka", "porridge"],
  ["dribsniai", "cereal", "cornflakes", "lopya", "płatki"],
  ["mielės", "mieles", "yeast", "drozhzhi", "drozdzе"],
  ["kepimo milteliai", "baking powder", "razrikhitel"],
  ["krakmolas", "starch", "krakmal", "skrobia"],
  ["zeldiniai", "spices", "herbs", "spetsii", "przyprawy"],
  ["pipiras", "black pepper", "chyorny perts", "pieprz czarny"],
  ["lauro lapai", "lauro lapas", "bay leaf", "lavroviy list", "listek laurowy"],

  // ── Frozen / Convenience ──────────────────────────────────────────────────────
  ["šaldytos daržovės", "saldytos darzoves", "frozen vegetables", "zamorozhennye ovoschi"],
  ["pica", "pizza"],
  ["pelmenys", "dumplings", "pelmeni", "pierogi"],
  ["blyneliai", "pancakes", "bliny", "naleśniki"],

  // ── Dairy extras ─────────────────────────────────────────────────────────────
  ["sūrelis", "surelis", "cheese snack", "glazirovaniy syrok", "serochok"],
  ["gėrimas su pienu", "gerimas su pienu", "milk drink", "molochniy napitok"],

  // ── Household / Personal care ─────────────────────────────────────────────────
  ["skalbimo", "detergent", "skalb", "skalbiklis", "stiralnoye sredstvo", "proszek do prania"],
  ["indaplovių", "indaploviu", "dishwasher", "indaplov", "posudomoechnoe"],
  ["tualetinis popierius", "toilet paper", "tualetini", "tualetnaya bumaga", "papier toaletowy"],
  ["servetėlės", "servietkes", "napkins", "tissues", "salfetki", "serwetki"],
  ["šampūnas", "sampunas", "shampoo", "shampun", "szampon"],
  ["muilas", "soap", "mylo", "mydlo"],
  ["dantų pasta", "dantu pasta", "toothpaste", "zubnaya pasta", "pasta do zebow"],
  ["dezodorantas", "deodorant", "dezodorant"],
  ["skutimosi", "razor", "britva"],
  ["sauskelnės", "sauskelines", "diapers", "nappies", "pampersy", "pieluchy"],
  ["ploviklis", "cleaning spray", "cleaner", "chistyaszcheye"],
];

// Map each term to its synonym group for O(1) lookup
export const SYNONYM_MAP = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    SYNONYM_MAP.set(term.toLowerCase(), group);
  }
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
