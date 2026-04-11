import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/categoryLabels";

export const dynamic = "force-dynamic";

export async function GET() {
  const [counts, subcategoryCounts] = await Promise.all([
    prisma.product.groupBy({
      by: ["canonicalCategory"],
      where: { canonicalCategory: { not: null } },
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ["canonicalCategory", "subcategory"],
      where: { canonicalCategory: { not: null }, subcategory: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { subcategory: "desc" } },
    }),
  ]);

  const countMap = Object.fromEntries(
    counts.map((r) => [r.canonicalCategory!, r._count._all])
  );

  const subcategoryMap: Record<string, { name: string; count: number }[]> = {};
  for (const row of subcategoryCounts) {
    const catId = row.canonicalCategory!;
    if (!subcategoryMap[catId]) subcategoryMap[catId] = [];
    if (subcategoryMap[catId].length < 6) {
      subcategoryMap[catId].push({ name: row.subcategory!, count: row._count._all });
    }
  }

  const categories = Object.entries(CATEGORY_LABELS)
    .filter(([id]) => countMap[id] > 0)
    .map(([id, labels]) => ({
      id,
      lt: labels.lt,
      en: labels.en,
      icon: labels.icon,
      count: countMap[id] || 0,
      subcategories: subcategoryMap[id] || [],
    }))
    .sort((a, b) => b.count - a.count);

  if (categories.length === 0) {
    const scraped = await prisma.product.findMany({
      select: { categoryLt: true, categoryEn: true },
      distinct: ["categoryLt"],
      where: { categoryLt: { not: null } },
    });
    return NextResponse.json(
      scraped
        .filter((c) => c.categoryLt)
        .map((c) => ({ id: c.categoryLt!, lt: c.categoryLt!, en: c.categoryEn || c.categoryLt!, icon: "📦", count: 0, subcategories: [] }))
    );
  }

  return NextResponse.json(categories);
}
