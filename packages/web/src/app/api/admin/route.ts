import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin
 * Admin actions: reset data, trigger full enrichment, re-embed, etc.
 * Body: { action: "reset" | "enrich-all" | "reprocess" }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action;

  if (action === "reset") {
    // Wipe all scraped data: products, prices, scrape logs, embeddings
    // Keep: stores, settings, grocery lists, scraper configs, store locations
    const deletedPrices = await prisma.priceRecord.deleteMany();
    const deletedProducts = await prisma.product.deleteMany();
    const deletedLogs = await prisma.scrapeLog.deleteMany();

    // Reset store lastScrapedAt
    await prisma.store.updateMany({ data: { lastScrapedAt: null } });

    // Clear embeddings via embedder service
    const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
    try {
      await fetch(`${embedderUrl}/reset`, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // embedder might not be running
    }

    return NextResponse.json({
      success: true,
      deleted: {
        products: deletedProducts.count,
        priceRecords: deletedPrices.count,
        scrapeLogs: deletedLogs.count,
      },
    });
  }

  if (action === "enrich-all") {
    // Clear enrichedAt on all products so Ollama re-processes everything
    const updated = await prisma.product.updateMany({
      data: { enrichment: null, enrichedAt: null },
    });

    // Trigger the embedder to start enrichment
    const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
    let enrichResult = null;
    try {
      const res = await fetch(`${embedderUrl}/enrich`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        enrichResult = await res.json();
      }
    } catch {
      enrichResult = { message: "Enrichment triggered — embedder will process in background" };
    }

    return NextResponse.json({
      success: true,
      productsCleared: updated.count,
      enrichResult,
    });
  }

  if (action === "reprocess") {
    // Trigger full reprocessing pipeline (embed + categorize + enrich + export)
    const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
    try {
      const res = await fetch(`${embedderUrl}/process`, {
        method: "POST",
        signal: AbortSignal.timeout(600000),
      });
      if (res.ok) {
        return NextResponse.json({ success: true, result: await res.json() });
      }
      return NextResponse.json({ success: false, error: "Embedder returned error" }, { status: 502 });
    } catch {
      return NextResponse.json(
        { success: false, error: "Embedder service not available" },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
