export interface ParsedItem {
  name: string;
  quantity: number;
  unit: string | null;
}

const UNIT_MAP: Record<string, string> = {
  kg: "kg",
  g: "g",
  l: "l",
  ml: "ml",
  pack: "pack",
  packs: "pack",
  pak: "pack",
  vnt: "pcs",
  pcs: "pcs",
  pc: "pcs",
  but: "bottle",
  bottle: "bottle",
  bottles: "bottle",
  butelis: "bottle",
  buteliai: "bottle",
  // Long-form English
  liter: "l",
  litre: "l",
  liters: "l",
  litres: "l",
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  milliliter: "ml",
  millilitre: "ml",
  milliliters: "ml",
  millilitres: "ml",
  // Lithuanian
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
};

const UNIT_PATTERN = Object.keys(UNIT_MAP).join("|");

// "1.5kg chicken breast" or "1.5 kg chicken breast"
const LEADING_QTY_UNIT = new RegExp(
  `^(\\d+(?:[.,]\\d+)?)\\s*(?:(${UNIT_PATTERN}))\\b[\\s,]*(.+)`,
  "i"
);

// "chicken breast 1.5kg" or "chicken breast 1.5 kg"
const TRAILING_QTY_UNIT = new RegExp(
  `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(?:(${UNIT_PATTERN}))\\s*$`,
  "i"
);

// "still water, 6 pack" or "water 6-pack"
const TRAILING_QTY_UNIT_COMMA = new RegExp(
  `^(.+?)[,\\s]+\\s*(\\d+(?:[.,]\\d+)?)\\s*[-\\s]?(?:(${UNIT_PATTERN}))\\s*$`,
  "i"
);

// "3x milk" or "3 x milk"
const MULTIPLIER_PREFIX = /^(\d+)\s*[xX×]\s+(.+)/;

// "milk x3" or "milk ×3"
const MULTIPLIER_SUFFIX = /^(.+?)\s*[xX×]\s*(\d+)\s*$/;

// Leading bare number: "6 eggs", "2 bread"
const LEADING_BARE_QTY = /^(\d+(?:[.,]\d+)?)\s+(.+)/;

export function parseItem(raw: string): ParsedItem {
  const input = raw.trim();
  if (!input) {
    return { name: "", quantity: 1, unit: null };
  }

  let match: RegExpMatchArray | null;

  // "1.5kg chicken breast"
  match = input.match(LEADING_QTY_UNIT);
  if (match) {
    return {
      name: match[3].trim(),
      quantity: parseNum(match[1]),
      unit: UNIT_MAP[match[2].toLowerCase()] || match[2].toLowerCase(),
    };
  }

  // "still water, 6 pack" or "water 6-pack"
  match = input.match(TRAILING_QTY_UNIT_COMMA);
  if (match) {
    return {
      name: match[1].trim(),
      quantity: parseNum(match[2]),
      unit: UNIT_MAP[match[3].toLowerCase()] || match[3].toLowerCase(),
    };
  }

  // "chicken breast 1.5kg"
  match = input.match(TRAILING_QTY_UNIT);
  if (match) {
    return {
      name: match[1].trim(),
      quantity: parseNum(match[2]),
      unit: UNIT_MAP[match[3].toLowerCase()] || match[3].toLowerCase(),
    };
  }

  // "3x milk"
  match = input.match(MULTIPLIER_PREFIX);
  if (match) {
    return {
      name: match[2].trim(),
      quantity: parseNum(match[1]),
      unit: null,
    };
  }

  // "milk x3"
  match = input.match(MULTIPLIER_SUFFIX);
  if (match) {
    return {
      name: match[1].trim(),
      quantity: parseNum(match[2]),
      unit: null,
    };
  }

  // "6 eggs" — leading bare number (only if > 1 word remains)
  match = input.match(LEADING_BARE_QTY);
  if (match && match[2].trim().length > 0) {
    const remaining = match[2].trim();
    // Don't match if the "number" is part of a product spec like "2% milk"
    if (!remaining.startsWith("%")) {
      return {
        name: remaining,
        quantity: parseNum(match[1]),
        unit: null,
      };
    }
  }

  // Plain name, no quantity detected
  return { name: input, quantity: 1, unit: null };
}

function parseNum(s: string): number {
  return parseFloat(s.replace(",", ".")) || 1;
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
