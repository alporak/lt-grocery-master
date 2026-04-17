import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/products/watched?ids=1,2,3&lang=en
 * Returns current price snapshot for a list of product IDs.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get("lang") || "lt";
  const idsParam = searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
    .slice(0, 100);

  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      nameLt: true,
      nameEn: true,
      brand: true,
      imageUrl: true,
      store: { select: { name: true, chain: true } },
      priceRecords: {
        orderBy: { scrapedAt: "desc" },
        take: 1,
        select: { regularPrice: true, salePrice: true, loyaltyPrice: true, unitPrice: true, unitLabel: true },
      },
    },
  });

  return NextResponse.json(
    products.map((p) => {
      const pr = p.priceRecords[0];
      const currentPrice = pr
        ? Math.min(pr.regularPrice, pr.salePrice ?? Infinity, pr.loyaltyPrice ?? Infinity)
        : null;
      return {
        id: p.id,
        name: lang === "en" ? p.nameEn || p.nameLt : p.nameLt,
        brand: p.brand,
        imageUrl: p.imageUrl,
        store: p.store.name,
        chain: p.store.chain,
        currentPrice,
        salePrice: pr?.salePrice ?? null,
        regularPrice: pr?.regularPrice ?? null,
        unitPrice: pr?.unitPrice ?? null,
        unitLabel: pr?.unitLabel ?? null,
      };
    })
  );
}
