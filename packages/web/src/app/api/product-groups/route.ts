import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { semanticSearch, buildSearchConditions, scoreRelevance } from "@/lib/search";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const offset = (page - 1) * limit;

  const where: any = {};

  if (category) {
    where.canonicalCategory = category;
  }

  if (q) {
    // Search products first, then aggregate by group
    const semanticResults = await semanticSearch(q, limit * 4);
    let productIds: number[] = [];

    if (semanticResults && semanticResults.length > 0) {
      productIds = semanticResults
        .filter((r) => r.score >= 0.3)
        .map((r) => r.id);
    }

    // Get groups from matched products
    const products = await prisma.product.findMany({
      where: {
        ...(productIds.length > 0
          ? { id: { in: productIds } }
          : buildSearchConditions(q)),
        productGroupId: { not: null },
      },
      select: {
        productGroupId: true,
      },
      take: limit * 4,
    });

    const groupIds = [
      ...new Set(products.map((p) => p.productGroupId).filter(Boolean)),
    ] as number[];

    if (groupIds.length === 0) {
      return NextResponse.json({ groups: [], total: 0, page, limit });
    }

    const groups = await prisma.productGroup.findMany({
      where: {
        id: { in: groupIds },
        ...(category ? { canonicalCategory: category } : {}),
      },
      include: {
        products: {
          include: {
            store: { select: { id: true, name: true, chain: true } },
            priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
          },
        },
      },
      skip: offset,
      take: limit,
    });

    const formatted = groups.map(formatGroup);
    return NextResponse.json({ groups: formatted, total: groupIds.length, page, limit });
  }

  // No search query — return all groups
  const [groups, total] = await Promise.all([
    prisma.productGroup.findMany({
      where,
      include: {
        products: {
          include: {
            store: { select: { id: true, name: true, chain: true } },
            priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.productGroup.count({ where }),
  ]);

  const formatted = groups.map(formatGroup);
  return NextResponse.json({ groups: formatted, total, page, limit });
}

function formatGroup(group: any) {
  const stores = new Map<string, { id: number; name: string; chain: string }>();
  let minPrice = Infinity;
  let maxPrice = 0;
  const brands = new Set<string>();

  for (const p of group.products) {
    if (p.store) {
      stores.set(p.store.name, p.store);
    }
    if (p.brand) brands.add(p.brand);
    const pr = p.priceRecords[0];
    if (pr) {
      const effectivePrice = Math.min(
        pr.regularPrice,
        pr.salePrice ?? Infinity,
        pr.loyaltyPrice ?? Infinity
      );
      if (effectivePrice < minPrice) minPrice = effectivePrice;
      if (effectivePrice > maxPrice) maxPrice = effectivePrice;
    }
  }

  return {
    id: group.id,
    name: group.name,
    nameEn: group.nameEn,
    canonicalCategory: group.canonicalCategory,
    productCount: group.products.length,
    stores: Array.from(stores.values()),
    brands: Array.from(brands),
    priceRange: {
      min: minPrice === Infinity ? null : minPrice,
      max: maxPrice === 0 ? null : maxPrice,
    },
  };
}
