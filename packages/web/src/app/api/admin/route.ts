import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { translateBatch } from "@/lib/translate";

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

  if (action === "run-phases") {
    const phases: string[] = body.phases || [];
    const validPhases = ["translate", "retranslate", "enrich", "reprocess"];
    const selected = phases.filter((p: string) => validPhases.includes(p));

    if (selected.length === 0) {
      return NextResponse.json({ error: "No valid phases selected" }, { status: 400 });
    }

    const requestedAt = new Date();
    const results: Record<string, unknown> = {};

    // Set pipeline state
    const firstPhase = selected[0] === "retranslate" ? "translating" : selected[0] === "translate" ? "translating" : selected[0] === "enrich" ? "enriching" : "enriching";
    await prisma.settings.upsert({
      where: { key: "pipelineState" },
      update: {
        value: JSON.stringify({
          trigger: "manual-phases",
          status: firstPhase,
          startedAt: requestedAt.toISOString(),
          phases: selected,
          finishedAt: null,
          error: null,
          updatedAt: requestedAt.toISOString(),
        }),
      },
      create: {
        key: "pipelineState",
        value: JSON.stringify({
          trigger: "manual-phases",
          status: firstPhase,
          startedAt: requestedAt.toISOString(),
          phases: selected,
          finishedAt: null,
          error: null,
          updatedAt: requestedAt.toISOString(),
        }),
      },
    });

    try {
      // Phase: retranslate — clear existing translations first, then translate
      if (selected.includes("retranslate")) {
        await updatePipelineState("translating");
        const cleared = await prisma.product.updateMany({
          data: { nameEn: null, categoryEn: null },
        });
        results.retranslateCleared = cleared.count;
        const translateResult = await doTranslateProducts();
        results.translate = translateResult;
      }
      // Phase: translate — only untranslated products
      else if (selected.includes("translate")) {
        await updatePipelineState("translating");
        const translateResult = await doTranslateProducts();
        results.translate = translateResult;
      }

      // Phase: enrich — run embedder pipeline (embed + categorize + LLM enrich + group)
      if (selected.includes("enrich") || selected.includes("reprocess")) {
        await updatePipelineState("enriching");
        const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
        try {
          const res = await fetch(`${embedderUrl}/process`, {
            method: "POST",
            signal: AbortSignal.timeout(600000),
          });
          if (res.ok) {
            results.enrich = await res.json();
          } else {
            results.enrich = { error: `Embedder returned ${res.status}` };
          }
        } catch {
          results.enrich = { error: "Embedder service not available" };
        }
      }

      // Done
      await prisma.settings.upsert({
        where: { key: "pipelineState" },
        update: {
          value: JSON.stringify({
            trigger: "manual-phases",
            status: "done",
            startedAt: requestedAt.toISOString(),
            phases: selected,
            finishedAt: new Date().toISOString(),
            error: null,
            updatedAt: new Date().toISOString(),
          }),
        },
        create: {
          key: "pipelineState",
          value: JSON.stringify({ status: "done" }),
        },
      });

      return NextResponse.json({ success: true, phases: selected, results });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.settings.upsert({
        where: { key: "pipelineState" },
        update: {
          value: JSON.stringify({
            trigger: "manual-phases",
            status: "error",
            error: message,
            finishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        },
        create: {
          key: "pipelineState",
          value: JSON.stringify({ status: "error", error: message }),
        },
      });
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

function normalizeForIndex(text: string): string {
  const LT: Record<string, string> = {
    'ą': 'a', 'č': 'c', 'ę': 'e', 'ė': 'e', 'į': 'i',
    'š': 's', 'ų': 'u', 'ū': 'u', 'ž': 'z',
  };
  let r = text.toLowerCase();
  for (const [f, t] of Object.entries(LT)) r = r.replaceAll(f, t);
  return r.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

async function updatePipelineState(status: string) {
  try {
    const existing = await prisma.settings.findUnique({ where: { key: "pipelineState" } });
    const state = existing?.value ? JSON.parse(existing.value) : {};
    const merged = { ...state, status, updatedAt: new Date().toISOString() };
    await prisma.settings.upsert({
      where: { key: "pipelineState" },
      update: { value: JSON.stringify(merged) },
      create: { key: "pipelineState", value: JSON.stringify(merged) },
    });
  } catch {
    // ignore
  }
}

async function doTranslateProducts(): Promise<{ translated: number }> {
  let totalTranslated = 0;

  while (true) {
    const untranslated = await prisma.product.findMany({
      where: { nameEn: null },
      select: { id: true, nameLt: true, categoryLt: true },
      take: 200,
    });

    if (untranslated.length === 0) break;

    const names = untranslated.map((p) => p.nameLt);
    const translatedNames = await translateBatch(names);

    // Translate categories too
    const categories = untranslated
      .map((p) => p.categoryLt)
      .filter((c): c is string => !!c);
    const uniqueCategories = [...new Set(categories)];
    const translatedCategories = uniqueCategories.length > 0
      ? await translateBatch(uniqueCategories)
      : [];
    const catMap = new Map<string, string>();
    uniqueCategories.forEach((c, i) => catMap.set(c, translatedCategories[i]));

    for (let i = 0; i < untranslated.length; i++) {
      const nameEn = translatedNames[i];
      const categoryEn = untranslated[i].categoryLt
        ? catMap.get(untranslated[i].categoryLt!) || undefined
        : undefined;

      const searchParts = [
        untranslated[i].nameLt,
        nameEn,
        untranslated[i].categoryLt,
        categoryEn,
      ].filter(Boolean);
      const searchIndex = normalizeForIndex(searchParts.join(" "));

      await prisma.product.update({
        where: { id: untranslated[i].id },
        data: { nameEn, categoryEn, searchIndex },
      });
    }

    totalTranslated += untranslated.length;
  }

  return { translated: totalTranslated };
}
