import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "90", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      store: { select: { id: true, name: true, chain: true } },
      priceRecords: {
        where: { scrapedAt: { gte: since } },
        orderBy: { scrapedAt: "asc" },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If product belongs to a group, include cross-store alternatives
  let groupMembers: any[] = [];
  if (product.productGroupId) {
    const members = await prisma.product.findMany({
      where: {
        productGroupId: product.productGroupId,
        id: { not: product.id },
      },
      include: {
        store: { select: { id: true, name: true, chain: true } },
        priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
      },
    });
    groupMembers = members.map((m) => ({
      id: m.id,
      nameLt: m.nameLt,
      nameEn: m.nameEn,
      brand: m.brand,
      weightValue: m.weightValue,
      weightUnit: m.weightUnit,
      imageUrl: m.imageUrl,
      store: m.store,
      price: m.priceRecords[0]
        ? {
            regular: m.priceRecords[0].regularPrice,
            sale: m.priceRecords[0].salePrice,
            loyalty: m.priceRecords[0].loyaltyPrice,
            unit: m.priceRecords[0].unitPrice,
            unitLabel: m.priceRecords[0].unitLabel,
          }
        : null,
    }));
    // Sort by cheapest effective price
    groupMembers.sort((a: any, b: any) => {
      const pa = a.price
        ? Math.min(a.price.regular, a.price.sale ?? Infinity, a.price.loyalty ?? Infinity)
        : Infinity;
      const pb = b.price
        ? Math.min(b.price.regular, b.price.sale ?? Infinity, b.price.loyalty ?? Infinity)
        : Infinity;
      return pa - pb;
    });
  }

  return NextResponse.json({ ...product, groupMembers });
}
