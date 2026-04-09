import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const list = await prisma.groceryList.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!list) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(list);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();

  // Update list name if provided
  if (body.name !== undefined) {
    await prisma.groceryList.update({
      where: { id },
      data: { name: body.name },
    });
  }

  // Replace items if provided
  if (Array.isArray(body.items)) {
    // Delete existing items
    await prisma.groceryListItem.deleteMany({ where: { listId: id } });

    // Create new items
    for (const item of body.items) {
      await prisma.groceryListItem.create({
        data: {
          listId: id,
          itemName: item.itemName,
          quantity: item.quantity || 1,
          unit: item.unit || null,
          checked: item.checked || false,
        },
      });
    }
  }

  const list = await prisma.groceryList.findUnique({
    where: { id },
    include: { items: true },
  });

  return NextResponse.json(list);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  await prisma.groceryList.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
