import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = await prisma.scraperConfig.findUnique({
    where: { id: parseInt(id, 10) },
  });
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(config);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const config = await prisma.scraperConfig.update({
    where: { id: parseInt(id, 10) },
    data: {
      name: body.name,
      url: body.url,
      storeName: body.storeName,
      chain: body.chain,
      containerSel: body.containerSel,
      nameSel: body.nameSel,
      priceSel: body.priceSel,
      linkSel: body.linkSel || null,
      imageSel: body.imageSel || null,
      categorySel: body.categorySel || null,
      paginationSel: body.paginationSel || null,
      enabled: body.enabled,
    },
  });

  return NextResponse.json(config);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.scraperConfig.delete({
    where: { id: parseInt(id, 10) },
  });
  return NextResponse.json({ ok: true });
}
