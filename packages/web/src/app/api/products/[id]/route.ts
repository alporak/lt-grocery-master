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

  return NextResponse.json(product);
}
