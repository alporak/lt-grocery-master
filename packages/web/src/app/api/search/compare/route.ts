import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseSearchQuery,
  buildFlexibleConditions,
  scoreRelevance,
  buildIntentFromText,
  productMatchesIntent,
} from "@/lib/search";

export const dynamic = "force-dynamic";

const CHAINS = ["RIMI", "IKI", "BARBORA", "PROMO"] as const;
type Chain = (typeof CHAINS)[number];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "cheapest";
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 80);

  const parsed = parseSearchQuery(raw);
  if (!parsed.terms && !parsed.brand) {
    return NextResponse.json({ query: parsed, rows: [] });
  }

  const intent = buildIntentFromText(parsed.terms);

  const where: Record<string, unknown> = {};
  const andClauses: Record<string, unknown>[] = [];
  if (parsed.terms) {
    const flex = buildFlexibleConditions(parsed.terms);
    if (flex.length > 0) andClauses.push(...flex);
  }
  if (parsed.brand) andClauses.push({ brand: { contains: parsed.brand } });
  if (andClauses.length > 0) where.AND = andClauses;

  const products = await prisma.product.findMany({
    where,
    include: {
      store: { select: { id: true, name: true, chain: true } },
      priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
      productGroup: { select: { id: true, name: true, nameEn: true } },
    },
    take: 500,
  });

  // Group by productGroupId (fallback: normalized nameLt)
  type Row = {
    key: string;
    groupId: number | null;
    name: string;
    nameEn: string | null;
    imageUrl: string | null;
    brand: string | null;
    prices: Record<Chain, { productId: number; price: number } | null>;
    bestChain: Chain | null;
    bestPrice: number | null;
    score: number;
  };

  const rowsMap = new Map<string, Row>();

  for (const p of products) {
    if (!productMatchesIntent(p, intent)) continue;
    const pr = p.priceRecords[0];
    const price = pr ? (pr.salePrice ?? pr.loyaltyPrice ?? pr.regularPrice) : null;
    if (parsed.priceMax !== null && (price === null || price > parsed.priceMax)) continue;
    if (parsed.priceMin !== null && (price === null || price < parsed.priceMin)) continue;

    const chain = p.store.chain.toUpperCase() as Chain;
    if (!CHAINS.includes(chain)) continue;

    const key = p.productGroupId
      ? `g:${p.productGroupId}`
      : `n:${p.nameLt.toLowerCase().trim()}`;

    let row = rowsMap.get(key);
    if (!row) {
      row = {
        key,
        groupId: p.productGroupId,
        name: p.productGroup?.name ?? p.nameLt,
        nameEn: p.productGroup?.nameEn ?? p.nameEn,
        imageUrl: p.imageUrl,
        brand: p.brand,
        prices: { RIMI: null, IKI: null, BARBORA: null, PROMO: null },
        bestChain: null,
        bestPrice: null,
        score: scoreRelevance(parsed.terms, p),
      };
      rowsMap.set(key, row);
    } else {
      row.score = Math.max(row.score, scoreRelevance(parsed.terms, p));
      if (!row.imageUrl && p.imageUrl) row.imageUrl = p.imageUrl;
    }

    if (price !== null) {
      const existing = row.prices[chain];
      if (!existing || price < existing.price) {
        row.prices[chain] = { productId: p.id, price };
      }
    }
  }

  const rows = [...rowsMap.values()]
    .map((r) => {
      let bestChain: Chain | null = null;
      let bestPrice: number | null = null;
      for (const c of CHAINS) {
        const cell = r.prices[c];
        if (cell && (bestPrice === null || cell.price < bestPrice)) {
          bestPrice = cell.price;
          bestChain = c;
        }
      }
      r.bestChain = bestChain;
      r.bestPrice = bestPrice;
      return r;
    })
    // Drop rows with no prices across any chain
    .filter((r) => r.bestPrice !== null);

  if (sort === "cheapest") {
    rows.sort((a, b) => (a.bestPrice ?? Infinity) - (b.bestPrice ?? Infinity) || b.score - a.score);
  } else if (sort === "name") {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "savings") {
    const spread = (r: Row) => {
      const ps = CHAINS.map((c) => r.prices[c]?.price ?? null).filter((x): x is number => x !== null);
      if (ps.length < 2) return 0;
      return Math.max(...ps) - Math.min(...ps);
    };
    rows.sort((a, b) => spread(b) - spread(a));
  } else {
    rows.sort((a, b) => b.score - a.score);
  }

  return NextResponse.json({
    query: parsed,
    total: rows.length,
    rows: rows.slice(0, limit),
  });
}
