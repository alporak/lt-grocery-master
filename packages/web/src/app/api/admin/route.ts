import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { translateBatch, TranslateProviderConfig } from "@/lib/translate";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function getOllamaConfig() {
  const settings = await getSettings();
  const useOllama = String(settings.useOllamaForBulk) === "true";
  const config = {
    useOllama,
    provider: useOllama ? "ollama" : "groq",
    ollama_url: String(settings.ollamaUrl || ""),
    ollama_model: String(settings.ollamaModel || "llama3.1:8b"),
  };
  console.log("[getOllamaConfig]", JSON.stringify(config));
  return config;
}

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

    // Trigger the bulk-enrich background worker (respects Ollama settings)
    const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
    const ollamaConfig = await getOllamaConfig();
    let enrichResult = null;
    try {
      const res = await fetch(`${embedderUrl}/bulk-enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: ollamaConfig.provider,
          ollama_url: ollamaConfig.ollama_url,
          ollama_model: ollamaConfig.ollama_model,
        }),
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

  if (action === "stop-all") {
    // Stop bulk enrichment
    const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
    let enrichStopped = false;
    try {
      const res = await fetch(`${embedderUrl}/bulk-enrich/stop`, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
      enrichStopped = res.ok;
    } catch {
      // embedder might not be running
    }

    // Reset pipeline state to idle
    await prisma.settings.upsert({
      where: { key: "pipelineState" },
      update: { value: JSON.stringify({ status: "idle", stoppedAt: new Date().toISOString() }) },
      create: { key: "pipelineState", value: JSON.stringify({ status: "idle" }) },
    });

    return NextResponse.json({ success: true, enrichStopped });
  }

  if (action === "scrape-only") {
    const requestedAt = new Date();
    await prisma.settings.upsert({
      where: { key: "pipelineState" },
      update: {
        value: JSON.stringify({
          trigger: "manual-scrape",
          status: "scraping",
          startedAt: requestedAt.toISOString(),
          storesTotal: 0,
          storesCompleted: 0,
          productsScraped: 0,
          currentStore: null,
          finishedAt: null,
          error: null,
          updatedAt: requestedAt.toISOString(),
        }),
      },
      create: {
        key: "pipelineState",
        value: JSON.stringify({ status: "scraping" }),
      },
    });
    await prisma.settings.upsert({
      where: { key: "scrapeRequested" },
      update: { value: requestedAt.toISOString() },
      create: { key: "scrapeRequested", value: requestedAt.toISOString() },
    });
    return NextResponse.json({ success: true, requestedAt: requestedAt.toISOString() });
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
        const ollamaConfig = await getOllamaConfig();
        const providerConfig: TranslateProviderConfig | undefined = ollamaConfig.useOllama
          ? { provider: "ollama", ollama_url: ollamaConfig.ollama_url, ollama_model: ollamaConfig.ollama_model }
          : undefined;
        const cleared = await prisma.product.updateMany({
          data: { nameEn: null, categoryEn: null },
        });
        results.retranslateCleared = cleared.count;
        const translateResult = await doTranslateProducts(providerConfig);
        results.translate = translateResult;
      }
      // Phase: translate — only untranslated products
      else if (selected.includes("translate")) {
        await updatePipelineState("translating");
        const ollamaConfig = await getOllamaConfig();
        const providerConfig: TranslateProviderConfig | undefined = ollamaConfig.useOllama
          ? { provider: "ollama", ollama_url: ollamaConfig.ollama_url, ollama_model: ollamaConfig.ollama_model }
          : undefined;
        const translateResult = await doTranslateProducts(providerConfig);
        results.translate = translateResult;
      }

      // Phase: enrich — run embedder pipeline (embed + categorize + LLM enrich + group)
      if (selected.includes("enrich") || selected.includes("reprocess")) {
        await updatePipelineState("enriching");
        const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
        const ollamaConfig = await getOllamaConfig();
        const useBulkEnrich = !ollamaConfig.useOllama;
        const endpoint = useBulkEnrich ? "/bulk-enrich" : "/process";
        try {
          const res = await fetch(`${embedderUrl}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: ollamaConfig.provider,
              ollama_url: ollamaConfig.ollama_url,
              ollama_model: ollamaConfig.ollama_model,
            }),
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

async function doTranslateProducts(providerConfig?: TranslateProviderConfig): Promise<{ translated: number }> {
  let totalTranslated = 0;

  while (true) {
    const untranslated = await prisma.product.findMany({
      where: { nameEn: null },
      select: { id: true, nameLt: true, categoryLt: true },
      take: 400,
    });

    if (untranslated.length === 0) break;

    const names = untranslated.map((p) => p.nameLt);
    const translatedNames = await translateBatch(names, "lt", "en", providerConfig);

    // Translate categories too
    const categories = untranslated
      .map((p) => p.categoryLt)
      .filter((c): c is string => !!c);
    const uniqueCategories = [...new Set(categories)];
    const translatedCategories = uniqueCategories.length > 0
      ? await translateBatch(uniqueCategories, "lt", "en", providerConfig)
      : [];
    const catMap = new Map<string, string>();
    uniqueCategories.forEach((c, i) => catMap.set(c, translatedCategories[i]));

    const updateChunkSize = 80;
    for (let ci = 0; ci < untranslated.length; ci += updateChunkSize) {
      const chunk = untranslated.slice(ci, ci + updateChunkSize);
      await Promise.all(
        chunk.map(async (row, j) => {
          const i = ci + j;
          const nameEn = translatedNames[i];
          const categoryEn = row.categoryLt
            ? catMap.get(row.categoryLt) || undefined
            : undefined;

          const searchParts = [
            row.nameLt,
            nameEn,
            row.categoryLt,
            categoryEn,
          ].filter(Boolean);
          const searchIndex = normalizeForIndex(searchParts.join(" "));

          try {
            await prisma.product.update({
              where: { id: row.id },
              data: { nameEn, categoryEn, searchIndex },
            });
          } catch {
            // Product may have been deleted by scraper — skip
          }
        })
      );
    }

    totalTranslated += untranslated.length;
    await updatePipelineState("translating");
  }

  return { translated: totalTranslated };
}
