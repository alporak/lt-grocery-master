import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get("chain");
  const limit = Math.min(parseInt(searchParams.get("limit") || "64", 10), 200);
  const lang = searchParams.get("lang") || "lt";

  const stores = await prisma.store.findMany({
    where: {
      enabled: true,
      ...(chain ? { chain } : {}),
    },
    select: { id: true, name: true, chain: true },
  });

  const storeIds = stores.map((s) => s.id);
  const storeMap = new Map(stores.map((s) => [s.id, s]));

  if (storeIds.length === 0) {
    return NextResponse.json({ items: [], total: 0 });
  }

  const products = await prisma.product.findMany({
    where: {
      storeId: { in: storeIds },
      priceRecords: {
        some: {
          OR: [
            { salePrice: { not: null } },
            { campaignText: { not: null } },
          ],
        },
      },
    },
    include: {
      priceRecords: {
        orderBy: { scrapedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit * 2, // overfetch, then filter
  });

  // Keep only products whose latest price record has a deal
  const items = products
    .filter(
      (p) =>
        p.priceRecords[0]?.salePrice != null ||
        p.priceRecords[0]?.campaignText != null
    )
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      name: lang === "en" ? p.nameEn || p.nameLt : p.nameLt,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      store: storeMap.get(p.storeId) ?? null,
      latestPrice: p.priceRecords[0]
        ? {
            regularPrice: p.priceRecords[0].regularPrice,
            salePrice: p.priceRecords[0].salePrice,
            campaignText: p.priceRecords[0].campaignText,
            unitPrice: p.priceRecords[0].unitPrice,
            unitLabel: p.priceRecords[0].unitLabel,
          }
        : null,
    }));

  return NextResponse.json({ items, total: items.length });
}
