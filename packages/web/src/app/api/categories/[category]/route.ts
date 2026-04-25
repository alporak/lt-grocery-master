import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { matchesDietaryFilter, type DietaryFilter } from "@/lib/dietaryTags";

export const dynamic = "force-dynamic";

const DIETARY_SET = new Set<DietaryFilter>(["vegan", "vegetarian", "gluten-free", "lactose-free"]);

export async function GET(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  const { searchParams } = new URL(req.url);
  const subcategory = searchParams.get("subcategory") || "";
  const brand = searchParams.get("brand") || "";
  const storeIds = searchParams.get("storeIds") || "";
  const sortBy = searchParams.get("sort") || "price_asc";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "24", 10);
  const lang = searchParams.get("lang") || "lt";
  const priceMinParam = searchParams.get("priceMin");
  const priceMaxParam = searchParams.get("priceMax");
  const priceMin = priceMinParam ? parseFloat(priceMinParam) : null;
  const priceMax = priceMaxParam ? parseFloat(priceMaxParam) : null;
  const attrs = (searchParams.get("attrs") || "").split(",").filter(Boolean);

  const storeIdFilter = storeIds
    ? storeIds.split(",").map(Number).filter(Boolean)
    : [];

  // Build where clause (SQLite: no mode:"insensitive", use plain equals)
  type ProductWhere = {
    canonicalCategory: string;
    subcategory?: { equals: string };
    brand?: { equals: string };
    storeId?: { in: number[] };
  };

  const where: ProductWhere = { canonicalCategory: params.category };
  if (subcategory) where.subcategory = { equals: subcategory };
  if (brand) where.brand = { equals: brand };
  if (storeIdFilter.length > 0) where.storeId = { in: storeIdFilter };

  // Get distinct subcategories
  const subcategoryRows = await prisma.product.groupBy({
    by: ["subcategory"],
    where: {
      canonicalCategory: params.category,
      subcategory: { not: null },
      ...(storeIdFilter.length > 0 ? { storeId: { in: storeIdFilter } } : {}),
      ...(brand ? { brand: brand } : {}),
    },
    _count: { _all: true },
    orderBy: { _count: { subcategory: "desc" } },
  });

  const subcategories = subcategoryRows
    .filter((r) => r.subcategory)
    .map((r) => ({ name: r.subcategory!, count: r._count._all }));

  // Get distinct brands
  const brandRows = await prisma.product.groupBy({
    by: ["brand"],
    where: {
      canonicalCategory: params.category,
      brand: { not: null },
      ...(subcategory ? { subcategory: subcategory } : {}),
      ...(storeIdFilter.length > 0 ? { storeId: { in: storeIdFilter } } : {}),
    },
    _count: { _all: true },
    orderBy: { _count: { brand: "desc" } },
    take: 50,
  });

  const brands = brandRows
    .filter((r) => r.brand)
    .map((r) => ({ name: r.brand!, count: r._count._all }));

  // Fetch products with latest price.
  // Post-fetch filtering (attrs + priceMin/Max) requires loading a wider window
  // then paginating manually so total count stays accurate.
  const needsRuntimeFilter = attrs.length > 0 || priceMin !== null || priceMax !== null;
  const rawProducts = await prisma.product.findMany({
    where,
    include: {
      store: { select: { id: true, name: true, chain: true } },
      priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
      productGroup: { select: { id: true } },
    },
    // When filtering runtime, grab a reasonable window; otherwise paginate at DB level
    skip: needsRuntimeFilter ? 0 : (page - 1) * pageSize,
    take: needsRuntimeFilter ? 2000 : pageSize,
  });
  const totalRaw = needsRuntimeFilter ? 0 : await prisma.product.count({ where });

  const filtered = rawProducts.filter((p) => {
    const pr = p.priceRecords[0];
    const price = pr ? (pr.salePrice ?? pr.loyaltyPrice ?? pr.regularPrice) : null;
    if (priceMin !== null && (price === null || price < priceMin)) return false;
    if (priceMax !== null && (price === null || price > priceMax)) return false;
    for (const attr of attrs) {
      if (DIETARY_SET.has(attr as DietaryFilter)) {
        if (!matchesDietaryFilter(attr as DietaryFilter, {
          name: p.nameLt, nameEn: p.nameEn, canonicalCategory: p.canonicalCategory, subcategory: p.subcategory,
        })) return false;
      } else if (attr === "organic") {
        const hay = `${p.nameLt} ${p.nameEn ?? ""}`.toLowerCase();
        if (!hay.includes("eko") && !hay.includes("organic") && !hay.includes("bio")) return false;
      }
    }
    return true;
  });

  const total = needsRuntimeFilter ? filtered.length : totalRaw;
  const products = needsRuntimeFilter
    ? filtered.slice((page - 1) * pageSize, page * pageSize)
    : filtered;

  const withPrice = products.map((p) => {
    const pr = p.priceRecords[0];
    const effectivePrice = pr?.salePrice ?? pr?.loyaltyPrice ?? pr?.regularPrice ?? null;
    return {
      id: p.id,
      name: lang === "en" ? p.nameEn || p.nameLt : p.nameLt,
      nameLt: p.nameLt,
      nameEn: p.nameEn,
      brand: p.brand,
      subcategory: p.subcategory,
      weightValue: p.weightValue,
      weightUnit: p.weightUnit,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      store: p.store,
      productGroupId: p.productGroup?.id ?? null,
      latestPrice: pr
        ? {
            regularPrice: pr.regularPrice,
            salePrice: pr.salePrice,
            unitPrice: pr.unitPrice,
            unitLabel: pr.unitLabel,
            loyaltyPrice: pr.loyaltyPrice,
            campaignText: pr.campaignText,
          }
        : null,
      effectivePrice,
    };
  });

  if (sortBy === "price_asc") {
    withPrice.sort((a, b) => (a.effectivePrice ?? Infinity) - (b.effectivePrice ?? Infinity));
  } else if (sortBy === "price_desc") {
    withPrice.sort((a, b) => (b.effectivePrice ?? -Infinity) - (a.effectivePrice ?? -Infinity));
  } else if (sortBy === "name_asc") {
    withPrice.sort((a, b) => a.name.localeCompare(b.name));
  }

  return NextResponse.json({
    products: withPrice,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    subcategories,
    brands,
  });
}
