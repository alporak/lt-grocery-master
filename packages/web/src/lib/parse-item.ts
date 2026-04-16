export interface ParsedItem {
  name: string;
  quantity: number;
  unit: string | null;
}

// ─── Unicode fraction → decimal string ───────────────────────────────────────

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "0.5",
  "⅓": "0.333",
  "¼": "0.25",
  "¾": "0.75",
  "⅔": "0.667",
  "⅕": "0.2",
  "⅖": "0.4",
  "⅗": "0.6",
  "⅘": "0.8",
  "⅙": "0.167",
  "⅚": "0.833",
  "⅛": "0.125",
  "⅜": "0.375",
  "⅝": "0.625",
  "⅞": "0.875",
};

const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join("");

/** Normalise unicode fractions and mixed numbers to decimal strings.
 *  "½"    → "0.5"
 *  "1 ½"  → "1.5"
 *  "2⅔"   → "2.667"
 */
function normalizeFractions(input: string): string {
  // Mixed number first: "1 ½" or "2⅔" — integer immediately followed by fraction
  let s = input.replace(
    new RegExp(`(\\d+)\\s*([${FRACTION_CHARS}])`, "g"),
    (_, whole, frac) => {
      const decimal = parseFloat(UNICODE_FRACTIONS[frac] ?? "0");
      return String(parseInt(whole, 10) + decimal);
    }
  );
  // Standalone fraction
  s = s.replace(
    new RegExp(`[${FRACTION_CHARS}]`, "g"),
    (frac) => UNICODE_FRACTIONS[frac] ?? frac
  );
  return s;
}

// ─── Unit map ────────────────────────────────────────────────────────────────

const UNIT_MAP: Record<string, string> = {
  // Weight — SI
  kg: "kg",
  g: "g",
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  milligram: "mg",
  milligrams: "mg",
  mg: "mg",
  // Volume — SI
  l: "l",
  ml: "ml",
  liter: "l",
  litre: "l",
  liters: "l",
  litres: "l",
  milliliter: "ml",
  millilitre: "ml",
  milliliters: "ml",
  millilitres: "ml",
  // Weight — Imperial / recipe
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  // Volume — recipe
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  floz: "fl oz",
  "fl oz": "fl oz",
  pt: "pt",
  pint: "pt",
  pints: "pt",
  qt: "qt",
  quart: "qt",
  quarts: "qt",
  gal: "gal",
  gallon: "gal",
  gallons: "gal",
  // Count / packaging
  pack: "pack",
  packs: "pack",
  pak: "pack",
  pcs: "pcs",
  pc: "pcs",
  piece: "pcs",
  pieces: "pcs",
  vnt: "pcs",
  bottle: "bottle",
  bottles: "bottle",
  but: "bottle",
  can: "can",
  cans: "can",
  jar: "jar",
  jars: "jar",
  bag: "bag",
  bags: "bag",
  box: "box",
  boxes: "box",
  // Recipe / culinary English
  clove: "pcs",
  cloves: "pcs",
  head: "pcs",
  heads: "pcs",
  slice: "slice",
  slices: "slice",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
  bunch: "bunch",
  bunches: "bunch",
  handful: "handful",
  handfuls: "handful",
  sprig: "sprig",
  sprigs: "sprig",
  stalk: "stalk",
  stalks: "stalk",
  stick: "pcs",
  sticks: "pcs",
  sheet: "pcs",
  sheets: "pcs",
  // Lithuanian — weight
  litras: "l",
  litrai: "l",
  litrų: "l",
  gramas: "g",
  gramai: "g",
  gramų: "g",
  kilogramas: "kg",
  kilogramai: "kg",
  kilogramų: "kg",
  mililitras: "ml",
  mililitas: "ml",
  mililitrai: "ml",
  miligramų: "ml",
  // Lithuanian — imperial
  svaras: "lb",
  svarai: "lb",
  svarų: "lb",
  uncija: "oz",
  uncijos: "oz",
  uncijų: "oz",
  // Lithuanian — recipe volume
  puodelis: "cup",
  puodeliai: "cup",
  puodelių: "cup",
  stiklinė: "cup",
  stiklinės: "cup",
  stiklinių: "cup",
  šaukštas: "tbsp",
  šaukštai: "tbsp",
  šaukštų: "tbsp",
  šaukštelis: "tsp",
  šaukšteliai: "tsp",
  šaukštelių: "tsp",
  // Lithuanian — count / packaging
  butelis: "bottle",
  buteliai: "bottle",
  butelių: "bottle",
  skardinė: "can",
  skardinės: "can",
  skardinių: "can",
  stiklainis: "jar",
  stiklainiai: "jar",
  stiklainių: "jar",
  maišelis: "bag",
  maišeliai: "bag",
  maišelių: "bag",
  dėžutė: "box",
  dėžutės: "box",
  dėžučių: "box",
  gabalas: "pcs",
  gabalai: "pcs",
  gabalų: "pcs",
  // Lithuanian — culinary
  skiltelė: "pcs",
  skiltelės: "pcs",
  skiltelių: "pcs",
  galva: "pcs",
  galvos: "pcs",
  galvų: "pcs",
  griežinys: "slice",
  griežiniai: "slice",
  griežinių: "slice",
  žiupsnelis: "pinch",
  žiupsnis: "pinch",
  žiupsniai: "pinch",
  pluoštas: "bunch",
  pluoštelis: "bunch",
  sauja: "handful",
  saujos: "handful",
};

// Sort longest first so e.g. "tablespoons" beats "tablespoon" in alternation
const UNIT_PATTERN = Object.keys(UNIT_MAP)
  .sort((a, b) => b.length - a.length)
  .join("|");

// ─── Patterns ────────────────────────────────────────────────────────────────

// "1.5kg chicken" or "1.5 kg chicken" or "1 pound linguine pasta"
const LEADING_QTY_UNIT = new RegExp(
  `^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})\\b[\\s,]*(.+)`,
  "i"
);

// "chicken breast 1.5kg" or "chicken breast 1.5 kg"
const TRAILING_QTY_UNIT = new RegExp(
  `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})\\s*$`,
  "i"
);

// "still water, 6 pack" or "water 6-pack"
const TRAILING_QTY_UNIT_COMMA = new RegExp(
  `^(.+?)[,\\s]+\\s*(\\d+(?:[.,]\\d+)?)\\s*[-\\s]?(${UNIT_PATTERN})\\s*$`,
  "i"
);

// "3x milk" or "3 x milk"
const MULTIPLIER_PREFIX = /^(\d+)\s*[xX×]\s+(.+)/;

// "milk x3" or "milk ×3"
const MULTIPLIER_SUFFIX = /^(.+?)\s*[xX×]\s*(\d+)\s*$/;

// Leading bare number: "6 eggs"
const LEADING_BARE_QTY = /^(\d+(?:[.,]\d+)?)\s+(.+)/;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNum(s: string): number {
  return parseFloat(s.replace(",", ".")) || 1;
}

/**
 * Strip cooking preparation descriptors that follow a comma.
 * "large shrimp, peeled and deveined" → "large shrimp"
 * "ground black pepper" → "ground black pepper"  (no change)
 */
function stripDescriptor(name: string): string {
  const idx = name.indexOf(",");
  return idx > 0 ? name.slice(0, idx).trim() : name;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function parseItem(raw: string): ParsedItem {
  const input = raw.trim();
  if (!input) {
    return { name: "", quantity: 1, unit: null };
  }

  // Normalise fractions before regex matching
  const normalised = normalizeFractions(input);

  let match: RegExpMatchArray | null;

  // "1.5kg chicken" / "1 pound linguine pasta" / "½ cup butter"
  match = normalised.match(LEADING_QTY_UNIT);
  if (match) {
    return {
      name: stripDescriptor(match[3].trim()),
      quantity: parseNum(match[1]),
      unit: UNIT_MAP[match[2].toLowerCase()] ?? match[2].toLowerCase(),
    };
  }

  // "still water, 6 pack"
  match = normalised.match(TRAILING_QTY_UNIT_COMMA);
  if (match) {
    return {
      name: stripDescriptor(match[1].trim()),
      quantity: parseNum(match[2]),
      unit: UNIT_MAP[match[3].toLowerCase()] ?? match[3].toLowerCase(),
    };
  }

  // "chicken breast 1.5kg"
  match = normalised.match(TRAILING_QTY_UNIT);
  if (match) {
    return {
      name: stripDescriptor(match[1].trim()),
      quantity: parseNum(match[2]),
      unit: UNIT_MAP[match[3].toLowerCase()] ?? match[3].toLowerCase(),
    };
  }

  // "3x milk"
  match = normalised.match(MULTIPLIER_PREFIX);
  if (match) {
    return {
      name: stripDescriptor(match[2].trim()),
      quantity: parseNum(match[1]),
      unit: null,
    };
  }

  // "milk x3"
  match = normalised.match(MULTIPLIER_SUFFIX);
  if (match) {
    return {
      name: stripDescriptor(match[1].trim()),
      quantity: parseNum(match[2]),
      unit: null,
    };
  }

  // "6 eggs" — leading bare number
  match = normalised.match(LEADING_BARE_QTY);
  if (match && match[2].trim().length > 0) {
    const remaining = match[2].trim();
    if (!remaining.startsWith("%")) {
      return {
        name: stripDescriptor(remaining),
        quantity: parseNum(match[1]),
        unit: null,
      };
    }
  }

  // Plain name
  return { name: stripDescriptor(input), quantity: 1, unit: null };
}

// ─── Smart import-line splitter ───────────────────────────────────────────────

/**
 * Split a single pasted line into individual ingredient strings.
 *
 * Recipe lines start with a number or fraction → single ingredient,
 * even if they contain a comma ("1 lb shrimp, peeled and deveined").
 *
 * Plain text lines may be comma-separated lists ("milk, bread, eggs").
 */
export function splitIngredientLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // Starts with digit or unicode fraction → recipe format, keep whole line
  if (/^[\d½⅓¼¾⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/.test(trimmed)) {
    return [trimmed];
  }

  // Plain text: try comma-splitting for lists like "milk, bread, eggs"
  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [trimmed];
}

export function formatParsed(parsed: ParsedItem): string {
  if (parsed.unit) {
    return `${parsed.name} × ${parsed.quantity} ${parsed.unit}`;
  }
  if (parsed.quantity !== 1) {
    return `${parsed.name} × ${parsed.quantity}`;
  }
  return parsed.name;
}
