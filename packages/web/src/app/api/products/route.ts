import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildSearchConditions, scoreRelevance, semanticSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const storeIds = searchParams.get("storeIds"); // comma-separated store IDs
  const storeId = searchParams.get("storeId"); // legacy single store
  const category = searchParams.get("category");
  const brand = searchParams.get("brand") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const lang = searchParams.get("lang") || "lt";

  // Parse store IDs early (needed by both paths)
  let storeIdFilter: number[] = [];
  if (storeIds) {
    storeIdFilter = storeIds.split(",").map(Number).filter(Boolean);
  } else if (storeId) {
    storeIdFilter = [parseInt(storeId, 10)];
  }

  // Try semantic search first when there's a search query
  if (search) {
    const semanticResults = await semanticSearch(
      search,
      page * pageSize * 3,
      storeIdFilter.length > 0 ? storeIdFilter : undefined,
    );

    if (semanticResults && semanticResults.length > 0) {
      // Semantic path: use embedder-ranked IDs
      const rankedIds = semanticResults.map(r => r.id);
      const scoreMap = new Map(semanticResults.map(r => [r.id, r.score]));

      const where: Record<string, unknown> = { id: { in: rankedIds } };
      if (storeIdFilter.length > 0) {
        where.storeId = { in: storeIdFilter };
      }
      if (category) {
        where.OR = [
          { categoryLt: { contains: category } },
          { categoryEn: { contains: category } },
          { canonicalCategory: category },
        ];
      }
      if (brand) {
        where.brand = brand;
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            store: { select: { id: true, name: true, chain: true } },
            priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
          },
        }),
        prisma.product.count({ where }),
      ]);

      // Sort by embedding score
      products.sort((a, b) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0));

      // Paginate in-memory
      const paged = products.slice((page - 1) * pageSize, page * pageSize);

      const items = paged.map((p) => ({
        id: p.id,
        name: lang === "en" ? p.nameEn || p.nameLt : p.nameLt,
        nameLt: p.nameLt,
        nameEn: p.nameEn,
        category: lang === "en" ? p.categoryEn || p.categoryLt : p.categoryLt,
        brand: p.brand,
        weightValue: p.weightValue,
        weightUnit: p.weightUnit,
        imageUrl: p.imageUrl,
        productUrl: p.productUrl,
        store: p.store,
        latestPrice: p.priceRecords[0] || null,
      }));

      return NextResponse.json({
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    }
  }

  // Fallback: keyword search with relevance scoring
  const where: Record<string, unknown> = {};

  if (search) {
    const conditions = buildSearchConditions(search);
    if (conditions.length > 0) {
      where.OR = conditions;
    }
  }

  if (storeIdFilter.length > 0) {
    where.storeId = { in: storeIdFilter };
  }

  if (category) {
    const catConditions = [
      { categoryLt: { contains: category } },
      { categoryEn: { contains: category } },
      { canonicalCategory: category },
    ];
    if (search && Array.isArray(where.OR)) {
      const searchOr = buildSearchConditions(search);
      delete where.OR;
      where.AND = [
        { OR: searchOr },
        { OR: catConditions },
      ];
    } else {
      where.OR = [...(Array.isArray(where.OR) ? where.OR : []), ...catConditions];
    }
  }

  if (brand) {
    where.brand = brand;
  }

  // Fetch more results for relevance scoring when searching
  const fetchSize = search ? Math.min(pageSize * 5, 200) : pageSize;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, chain: true } },
        priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      skip: search ? 0 : (page - 1) * pageSize,
      take: search ? fetchSize : pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  // Score and sort by relevance when searching
  let sortedProducts = products;
  if (search) {
    sortedProducts = products
      .map(p => ({
        ...p,
        _score: scoreRelevance(search, p),
      }))
      .sort((a, b) => b._score - a._score)
      .slice((page - 1) * pageSize, page * pageSize);
  }

  const items = sortedProducts.map((p) => ({
    id: p.id,
    name: lang === "en" ? p.nameEn || p.nameLt : p.nameLt,
    nameLt: p.nameLt,
    nameEn: p.nameEn,
    category: lang === "en" ? p.categoryEn || p.categoryLt : p.categoryLt,
    brand: p.brand,
    weightValue: p.weightValue,
    weightUnit: p.weightUnit,
    imageUrl: p.imageUrl,
    productUrl: p.productUrl,
    store: p.store,
    latestPrice: p.priceRecords[0] || null,
  }));

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
