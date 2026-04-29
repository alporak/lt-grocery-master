import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (list.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(list);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const existing = await prisma.groceryList.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.expectedVersion !== undefined && body.expectedVersion !== existing.version) {
    const current = await prisma.groceryList.findUnique({
      where: { id },
      include: { items: true },
    });
    return NextResponse.json(
      { error: "Conflict", currentVersion: current?.version, list: current },
      { status: 409 }
    );
  }

  const newVersion = existing.version + 1;

  if (body.name !== undefined) {
    await prisma.groceryList.update({
      where: { id },
      data: { name: body.name, version: newVersion },
    });
  }

  if (Array.isArray(body.items)) {
    await prisma.groceryListItem.deleteMany({ where: { listId: id } });

    for (const item of body.items) {
      await prisma.groceryListItem.create({
        data: {
          listId: id,
          itemName: item.itemName,
          quantity: item.quantity || 1,
          unit: item.unit || null,
          checked: item.checked || false,
          pinnedProductId:
            typeof item.pinnedProductId === "number" ? item.pinnedProductId : null,
        },
      });
    }

    await prisma.groceryList.update({
      where: { id },
      data: { version: newVersion, updatedAt: new Date() },
    });
  } else if (body.name !== undefined) {
    await prisma.groceryList.update({
      where: { id },
      data: { version: newVersion },
    });
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const existing = await prisma.groceryList.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.groceryList.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
