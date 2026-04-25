import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseSearchQuery,
  buildFlexibleConditions,
  scoreRelevance,
  buildIntentFromText,
  productMatchesIntent,
  categoryBonus,
} from "@/lib/search";
import { matchesDietaryFilter, type DietaryFilter } from "@/lib/dietaryTags";

export const dynamic = "force-dynamic";

const DIETARY_SET = new Set<DietaryFilter>(["vegan", "vegetarian", "gluten-free", "lactose-free"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 100);
  const storeIdsParam = searchParams.get("storeIds") || "";
  const storeIds = storeIdsParam.split(",").map(Number).filter(Boolean);

  const parsed = parseSearchQuery(raw);
  if (!parsed.terms && !parsed.brand) {
    return NextResponse.json({ query: parsed, results: [] });
  }

  const intent = buildIntentFromText(parsed.terms);

  const where: Record<string, unknown> = {};
  const andClauses: Record<string, unknown>[] = [];

  if (parsed.terms) {
    const flex = buildFlexibleConditions(parsed.terms);
    if (flex.length > 0) andClauses.push(...flex);
  }
  if (parsed.brand) {
    andClauses.push({ brand: { contains: parsed.brand } });
  }
  if (andClauses.length > 0) where.AND = andClauses;
  if (storeIds.length > 0) where.storeId = { in: storeIds };

  const products = await prisma.product.findMany({
    where,
    include: {
      store: { select: { id: true, name: true, chain: true } },
      priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
      productGroup: { select: { id: true, name: true } },
    },
    take: 400,
  });

  type Scored = {
    product: (typeof products)[number];
    price: number | null;
    score: number;
  };

  const scored: Scored[] = [];
  for (const p of products) {
    if (!productMatchesIntent(p, intent)) continue;

    const pr = p.priceRecords[0];
    const price = pr ? (pr.salePrice ?? pr.loyaltyPrice ?? pr.regularPrice) : null;
    if (parsed.priceMax !== null && (price === null || price > parsed.priceMax)) continue;
    if (parsed.priceMin !== null && (price === null || price < parsed.priceMin)) continue;

    // Dietary attrs
    let dietaryOk = true;
    for (const attr of parsed.attrs) {
      if (DIETARY_SET.has(attr as DietaryFilter)) {
        if (!matchesDietaryFilter(attr as DietaryFilter, { name: p.nameLt, nameEn: p.nameEn, canonicalCategory: p.canonicalCategory, subcategory: p.subcategory })) {
          dietaryOk = false;
          break;
        }
      } else if (attr === "organic") {
        const hay = `${p.nameLt} ${p.nameEn ?? ""}`.toLowerCase();
        if (!hay.includes("eko") && !hay.includes("organic") && !hay.includes("bio")) {
          dietaryOk = false;
          break;
        }
      }
    }
    if (!dietaryOk) continue;

    const s = scoreRelevance(parsed.terms, p) + categoryBonus(intent, p);
    scored.push({ product: p, price, score: s });
  }

  scored.sort((a, b) => b.score - a.score || (a.price ?? Infinity) - (b.price ?? Infinity));

  const results = scored.slice(0, limit).map(({ product: p, price }) => ({
    id: p.id,
    nameLt: p.nameLt,
    nameEn: p.nameEn,
    brand: p.brand,
    subcategory: p.subcategory,
    imageUrl: p.imageUrl,
    store: p.store,
    productGroupId: p.productGroup?.id ?? null,
    productGroupName: p.productGroup?.name ?? null,
    canonicalCategory: p.canonicalCategory,
    price,
  }));

  return NextResponse.json({
    query: parsed,
    intent: intent.category,
    total: scored.length,
    results,
  });
}
