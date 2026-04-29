import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetId = parseInt(params.id, 10);
  if (isNaN(targetId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const target = await prisma.groceryList.findUnique({ where: { id: targetId } });
  if (!target || target.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const sourceId = body.sourceId;

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const source = await prisma.groceryList.findUnique({
    where: { id: parseInt(sourceId, 10) },
    include: { items: true },
  });

  if (!source || source.userId !== session.user.id) {
    return NextResponse.json({ error: "Source list not found" }, { status: 404 });
  }

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
