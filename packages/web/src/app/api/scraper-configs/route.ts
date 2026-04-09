import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const configs = await prisma.scraperConfig.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(configs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const config = await prisma.scraperConfig.create({
    data: {
      name: body.name,
      url: body.url,
      storeName: body.storeName,
      chain: body.chain || "CUSTOM",
      containerSel: body.containerSel,
      nameSel: body.nameSel,
      priceSel: body.priceSel,
      linkSel: body.linkSel || null,
      imageSel: body.imageSel || null,
      categorySel: body.categorySel || null,
      paginationSel: body.paginationSel || null,
    },
  });

  return NextResponse.json(config, { status: 201 });
}
