import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [
    totalProducts,
    categorizedCount,
    enrichedCount,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { canonicalCategory: { not: null } } }),
    prisma.product.count({ where: { enrichedAt: { not: null } } }),
  ]);

  // Query embedder health for embedding count
  let embeddingsCount = 0;
  let embedderStatus = "unknown";
  const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
  try {
    const res = await fetch(`${embedderUrl}/health`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      embeddingsCount = data.embeddings_count || 0;
      embedderStatus = "online";
    } else {
      embedderStatus = "error";
    }
  } catch {
    embedderStatus = "offline";
  }

  // Top canonical categories
  let topCategories: { category: string; count: number }[] = [];
  try {
    const cats = await prisma.product.groupBy({
      by: ["canonicalCategory"],
      where: { canonicalCategory: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });
    topCategories = cats.map((c) => ({
      category: c.canonicalCategory!,
      count: c._count.id,
    }));
  } catch {
    // groupBy may fail on older schemas
  }

  return NextResponse.json({
    totalProducts,
    embeddingsCount,
    categorizedCount,
    enrichedCount,
    embedderStatus,
    topCategories,
  });
}
