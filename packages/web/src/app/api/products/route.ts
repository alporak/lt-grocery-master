import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const storeId = searchParams.get("storeId");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const lang = searchParams.get("lang") || "lt";

  const where: Record<string, unknown> = {};

  if (search) {
    const field = lang === "en" ? "nameEn" : "nameLt";
    where[field] = { contains: search };
  }

  if (storeId) {
    where.storeId = parseInt(storeId, 10);
  }

  if (category) {
    const field = lang === "en" ? "categoryEn" : "categoryLt";
    where[field] = { contains: category };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, chain: true } },
        priceRecords: {
          orderBy: { scrapedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  const items = products.map((p) => ({
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
