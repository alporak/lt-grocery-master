import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const stores = await prisma.store.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      chain: true,
      lastScrapedAt: true,
      _count: { select: { products: true } },
      scrapeLogs: {
        orderBy: { startedAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          productCount: true,
          errorMessage: true,
          startedAt: true,
          finishedAt: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(
    stores.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      chain: s.chain,
      lastScrapedAt: s.lastScrapedAt,
      productCount: s._count.products,
      recentLogs: s.scrapeLogs,
    }))
  );
}
