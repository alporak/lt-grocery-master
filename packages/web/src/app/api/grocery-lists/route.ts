import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lists = await prisma.groceryList.findMany({
    where: { userId: session.user.id },
    include: {
      items: true,
      _count: { select: { items: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const list = await prisma.groceryList.create({
    data: {
      name,
      userId: session.user.id,
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
