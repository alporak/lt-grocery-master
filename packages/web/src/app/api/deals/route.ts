import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get("chain");
  const limit = Math.min(parseInt(searchParams.get("limit") || "64", 10), 200);
  const lang = searchParams.get("lang") || "lt";
  const minDiscount = Math.max(0, Math.min(100, parseInt(searchParams.get("minDiscount") || "0", 10)));
  const category = searchParams.get("category") || null;

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
      ...(category ? { canonicalCategory: category } : {}),
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
    take: limit * 4, // overfetch to allow discount % sorting
  });

  // Keep only products whose latest price record has a deal, apply minDiscount filter
  const withDiscount = products
    .filter((p) => {
      const pr = p.priceRecords[0];
      if (!pr) return false;
      if (pr.salePrice == null && pr.campaignText == null) return false;
      if (minDiscount > 0 && pr.salePrice != null) {
        const pct = Math.round(((pr.regularPrice - pr.salePrice) / pr.regularPrice) * 100);
        if (pct < minDiscount) return false;
      }
      return true;
    });

  // Sort by discount % descending (best deals first)
  withDiscount.sort((a, b) => {
    const prA = a.priceRecords[0];
    const prB = b.priceRecords[0];
    const pctA = prA?.salePrice != null
      ? (prA.regularPrice - prA.salePrice) / prA.regularPrice
      : 0;
    const pctB = prB?.salePrice != null
      ? (prB.regularPrice - prB.salePrice) / prB.regularPrice
      : 0;
    return pctB - pctA;
  });

  const items = withDiscount.slice(0, limit).map((p) => ({
    id: p.id,
    name: lang === "en" ? p.nameEn || p.nameLt : p.nameLt,
    imageUrl: p.imageUrl,
    productUrl: p.productUrl,
    store: storeMap.get(p.storeId) ?? null,
    canonicalCategory: p.canonicalCategory,
    discountPct: p.priceRecords[0]?.salePrice != null
      ? Math.round(((p.priceRecords[0].regularPrice - p.priceRecords[0].salePrice) / p.priceRecords[0].regularPrice) * 100)
      : null,
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
