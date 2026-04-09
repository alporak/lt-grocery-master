import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const categories = await prisma.product.findMany({
    select: { categoryLt: true, categoryEn: true },
    distinct: ["categoryLt"],
    where: { categoryLt: { not: null } },
  });

  return NextResponse.json(
    categories
      .filter((c) => c.categoryLt)
      .map((c) => ({
        lt: c.categoryLt,
        en: c.categoryEn || c.categoryLt,
      }))
  );
}
