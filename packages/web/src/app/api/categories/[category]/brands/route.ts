import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { category: string } }
) {
  const rows = await prisma.product.groupBy({
    by: ["brand"],
    where: {
      canonicalCategory: params.category,
      brand: { not: null },
    },
    _count: { brand: true },
    orderBy: { _count: { brand: "desc" } },
    take: 40,
  });

  // For each brand, get a sample product (image + cheapest price)
  const brands = await Promise.all(
    rows
      .filter((r) => r.brand)
      .map(async (r) => {
        const sample = await prisma.product.findFirst({
          where: { canonicalCategory: params.category, brand: r.brand },
          include: { priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 } },
          orderBy: { id: "asc" },
        });
        const pr = sample?.priceRecords[0];
        return {
          name: r.brand!,
          count: r._count.brand,
          sampleImage: sample?.imageUrl ?? null,
          sampleProductName: sample?.nameEn || sample?.nameLt || null,
          minPrice: pr ? (pr.salePrice ?? pr.loyaltyPrice ?? pr.regularPrice) : null,
        };
      })
  );

  return NextResponse.json({ brands });
}
