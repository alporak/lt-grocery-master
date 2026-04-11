import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

  // Fetch products with latest price
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, chain: true } },
        priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
        productGroup: { select: { id: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

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
