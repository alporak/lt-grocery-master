import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const groupId = parseInt(id);
  if (isNaN(groupId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const group = await prisma.productGroup.findUnique({
    where: { id: groupId },
    include: {
      products: {
        include: {
          store: { select: { id: true, name: true, chain: true, slug: true } },
          priceRecords: { orderBy: { scrapedAt: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const members = group.products.map((p) => {
    const pr = p.priceRecords[0];
    return {
      id: p.id,
      nameLt: p.nameLt,
      nameEn: p.nameEn,
      brand: p.brand,
      weightValue: p.weightValue,
      weightUnit: p.weightUnit,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      barcode: p.barcode,
      store: p.store,
      price: pr
        ? {
            regular: pr.regularPrice,
            sale: pr.salePrice,
            loyalty: pr.loyaltyPrice,
            unit: pr.unitPrice,
            unitLabel: pr.unitLabel,
          }
        : null,
    };
  });

  // Sort by cheapest effective price
  members.sort((a, b) => {
    const pa = a.price
      ? Math.min(a.price.regular, a.price.sale ?? Infinity, a.price.loyalty ?? Infinity)
      : Infinity;
    const pb = b.price
      ? Math.min(b.price.regular, b.price.sale ?? Infinity, b.price.loyalty ?? Infinity)
      : Infinity;
    return pa - pb;
  });

  return NextResponse.json({
    id: group.id,
    name: group.name,
    nameEn: group.nameEn,
    canonicalCategory: group.canonicalCategory,
    members,
  });
}
