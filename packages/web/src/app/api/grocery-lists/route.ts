import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const lists = await prisma.groceryList.findMany({
    include: {
      items: true,
      _count: { select: { items: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const list = await prisma.groceryList.create({
    data: {
      name,
      items: {
        create: (body.items || []).map(
          (item: { itemName: string; quantity?: number; unit?: string }) => ({
            itemName: item.itemName,
            quantity: item.quantity || 1,
            unit: item.unit || null,
          })
        ),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(list, { status: 201 });
}
