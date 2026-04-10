import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const setting = await prisma.settings.findUnique({ where: { key: "pipelineState" } });
  if (!setting?.value) {
    return NextResponse.json({ status: "idle" });
  }
  try {
    return NextResponse.json(JSON.parse(setting.value));
  } catch {
    return NextResponse.json({ status: "idle" });
  }
}

async function doResetData() {
  // Wipe all scraped data: products, prices, scrape logs, groups, embeddings
  // Keep: stores, settings, grocery lists, scraper configs, store locations
  const deletedPrices = await prisma.priceRecord.deleteMany();
  const deletedProducts = await prisma.product.deleteMany();
  const deletedGroups = await prisma.productGroup.deleteMany();
  const deletedLogs = await prisma.scrapeLog.deleteMany();

  await prisma.store.updateMany({ data: { lastScrapedAt: null } });

  const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
  try {
    await fetch(`${embedderUrl}/reset`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // embedder might not be running
  }

  return {
    products: deletedProducts.count,
    productGroups: deletedGroups.count,
    priceRecords: deletedPrices.count,
    scrapeLogs: deletedLogs.count,
  };
}

async function waitForScrapeFinish(requestedAt: Date, timeoutMs: number) {
  const enabledStores = await prisma.store.findMany({
    where: { enabled: true },
    select: { id: true, name: true },
  });

  if (enabledStores.length === 0) {
    return {
      done: true,
      timedOut: false,
      reason: null,
      totalStores: 0,
      successStores: 0,
      failedStores: 0,
      statuses: [],
    };
  }

  const startMs = Date.now();
  const deadline = startMs + timeoutMs;
  while (Date.now() < deadline) {
    const statuses = await Promise.all(
      enabledStores.map(async (s) => {
        const log = await prisma.scrapeLog.findFirst({
          where: {
            storeId: s.id,
            startedAt: { gte: requestedAt },
          },
          orderBy: { startedAt: "desc" },
          select: { status: true, startedAt: true, finishedAt: true },
        });

        return {
          storeId: s.id,
          storeName: s.name,
          status: log?.status || "pending",
          startedAt: log?.startedAt || null,
          finishedAt: log?.finishedAt || null,
        };
      })
    );

    const allDone = statuses.every(
      (s) => s.status === "success" || s.status === "error" || s.status === "interrupted"
    );

    if (allDone) {
      const successStores = statuses.filter((s) => s.status === "success").length;
      const failedStores = statuses.filter(
        (s) => s.status === "error" || s.status === "interrupted"
      ).length;

      return {
        done: true,
        timedOut: false,
        reason: null,
        totalStores: enabledStores.length,
        successStores,
        failedStores,
        statuses,
      };
    }

    // If nothing started within 30s, scraper service is likely not running.
    const noActivity = statuses.every((s) => s.status === "pending");
    if (noActivity && Date.now() - startMs > 30_000) {
      return {
        done: false,
        timedOut: true,
        reason: "no-scraper-activity",
        totalStores: enabledStores.length,
        successStores: 0,
        failedStores: 0,
        statuses,
      };
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  const statuses = await Promise.all(
    enabledStores.map(async (s) => {
      const log = await prisma.scrapeLog.findFirst({
        where: {
          storeId: s.id,
          startedAt: { gte: requestedAt },
        },
        orderBy: { startedAt: "desc" },
        select: { status: true, startedAt: true, finishedAt: true },
      });

      return {
        storeId: s.id,
        storeName: s.name,
        status: log?.status || "pending",
        startedAt: log?.startedAt || null,
        finishedAt: log?.finishedAt || null,
      };
    })
  );

  return {
    done: false,
    timedOut: true,
    reason: "timeout",
    totalStores: enabledStores.length,
    successStores: statuses.filter((s) => s.status === "success").length,
    failedStores: statuses.filter(
      (s) => s.status === "error" || s.status === "interrupted"
    ).length,
    statuses,
  };
}

/**
 * POST /api/admin
 * Admin actions: reset data, trigger full enrichment, re-embed, etc.
 * Body: { action: "reset" | "enrich-all" | "reprocess" }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action;

  if (action === "reset") {
    const deleted = await doResetData();

    return NextResponse.json({
      success: true,
      deleted,
    });
  }

  if (action === "enrich-all") {
    // Clear enrichedAt on all products so they get re-enriched
    const updated = await prisma.product.updateMany({
      data: { enrichment: null, enrichedAt: null },
    });

    // Trigger the bulk-enrich background worker (uses GROQ_API_KEY from env)
    const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
    let enrichResult = null;
    try {
      const res = await fetch(`${embedderUrl}/bulk-enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

  if (action === "redo-database") {
    const requestedAt = new Date();

    // Set initial pipeline state
    const initialState = {
      trigger: "manual",
      status: "clearing",
      startedAt: requestedAt.toISOString(),
      storesTotal: 0,
      storesCompleted: 0,
      productsScraped: 0,
      currentStore: null,
      finishedAt: null,
      error: null,
      updatedAt: requestedAt.toISOString(),
    };
    await prisma.settings.upsert({
      where: { key: "pipelineState" },
      update: { value: JSON.stringify(initialState) },
      create: { key: "pipelineState", value: JSON.stringify(initialState) },
    });

    // 1) Reset existing scraped data
    const deleted = await doResetData();

    // 2) Update pipeline state to scraping (waiting for scraper to pick up)
    await prisma.settings.upsert({
      where: { key: "pipelineState" },
      update: { value: JSON.stringify({ ...initialState, status: "scraping", updatedAt: new Date().toISOString() }) },
      create: { key: "pipelineState", value: JSON.stringify({ ...initialState, status: "scraping" }) },
    });

    // 3) Trigger scraper immediately via settings signal
    await prisma.settings.upsert({
      where: { key: "scrapeRequested" },
      update: { value: requestedAt.toISOString() },
      create: { key: "scrapeRequested", value: requestedAt.toISOString() },
    });

    return NextResponse.json({
      success: true,
      deleted,
      requestedAt: requestedAt.toISOString(),
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
