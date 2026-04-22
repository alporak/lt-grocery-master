import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Import items from another grocery list */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const targetId = parseInt(params.id, 10);
  if (isNaN(targetId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();
  const sourceId = body.sourceId;

  if (!sourceId) {
    return NextResponse.json(
      { error: "sourceId is required" },
      { status: 400 }
    );
  }

  const source = await prisma.groceryList.findUnique({
    where: { id: parseInt(sourceId, 10) },
    include: { items: true },
  });

  if (!source) {
    return NextResponse.json(
      { error: "Source list not found" },
      { status: 404 }
    );
  }

  // Copy items from source to target
  for (const item of source.items) {
    await prisma.groceryListItem.create({
      data: {
        listId: targetId,
        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit,
        checked: false,
        pinnedProductId: item.pinnedProductId,
      },
    });
  }

  const updated = await prisma.groceryList.findUnique({
    where: { id: targetId },
    include: { items: true },
  });

  return NextResponse.json(updated);
}
