import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.product.groupBy({
    by: ["brand"],
    where: { brand: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 200,
  });

  const brands = rows
    .filter((r) => r.brand)
    .map((r) => ({ name: r.brand!, count: r._count.id }));

  return NextResponse.json({ brands });
}
