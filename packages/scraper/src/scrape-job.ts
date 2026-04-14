import prisma from "./db.js";
import { ScrapedProduct } from "./scrapers/base-scraper.js";
import { IkiScraper, PromoCashCarryScraper } from "./scrapers/lastmile.js";
import { BarboraScraper } from "./scrapers/barbora.js";
import { RimiScraper } from "./scrapers/rimi.js";
import { LidlScraper } from "./scrapers/lidl.js";
import { translateBatch } from "./translate.js";

// Lithuanian diacritics map for search index generation
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

interface Scraper {
  run(): Promise<ScrapedProduct[]>;
}

const SCRAPER_MAP: Record<string, () => Scraper> = {
  iki: () => new IkiScraper(),
  "promo-cash-and-carry": () => new PromoCashCarryScraper(),
  barbora: () => new BarboraScraper(),
  rimi: () => new RimiScraper(),
  lidl: () => new LidlScraper(),
};

// --- Pipeline state tracking (stored in Settings table as JSON) ---
async function updatePipelineState(update: Record<string, unknown>) {
  try {
    const existing = await prisma.settings.findUnique({ where: { key: "pipelineState" } });
    const state = existing?.value ? JSON.parse(existing.value) : {};
    const merged = { ...state, ...update, updatedAt: new Date().toISOString() };
    await prisma.settings.upsert({
      where: { key: "pipelineState" },
      update: { value: JSON.stringify(merged) },
      create: { key: "pipelineState", value: JSON.stringify(merged) },
    });
  } catch (err) {
    console.warn("[Pipeline] State update failed:", err);
  }
}

async function isStopRequested(): Promise<boolean> {
  try {
    const row = await prisma.settings.findUnique({ where: { key: "scrapeStopRequested" } });
    return row?.value === "1";
  } catch {
    return false;
  }
}

async function clearStopRequest(): Promise<void> {
  try {
    await prisma.settings.deleteMany({ where: { key: "scrapeStopRequested" } });
  } catch { /* best-effort */ }
}

export async function runScrapeJob(storeSlugs?: string[]) {
  await clearStopRequest();

  const stores = await prisma.store.findMany({
    where: {
      enabled: true,
      ...(storeSlugs && storeSlugs.length > 0 ? { slug: { in: storeSlugs } } : {}),
    },
  });

  await updatePipelineState({
    status: "scraping",
    storesTotal: stores.length,
    storesCompleted: 0,
    productsScraped: 0,
    currentStore: stores.map((s) => s.name).join(", "),
    error: null,
    finishedAt: null,
    categoriesTotal: 0,
    categoriesCompleted: 0,
    currentCategory: null,
  });

  // Track all active scrapers so stop-watcher can close every browser at once
  const activeScrapers = new Map<string, { close?(): Promise<void> }>();

  // Aggregate per-store category progress for the progress bar
  const catProgress = new Map<string, { total: number; done: number }>();

  const stopWatcher = setInterval(async () => {
    if (await isStopRequested()) {
      for (const scraper of activeScrapers.values()) {
        try { await scraper.close?.(); } catch { /* ignore */ }
      }
    }
  }, 1000);
  const clearWatcher = () => clearInterval(stopWatcher);

  // Run all scrapers concurrently — errors are caught per-scraper so Promise.all never rejects
  const scraperTasks = stores.map(async (store) => {
    const createScraper = SCRAPER_MAP[store.slug];
    if (!createScraper) {
      console.log(`[ScrapeJob] No scraper for store: ${store.slug}`);
      return { store, products: [] as ScrapedProduct[] };
    }

    const scraper = createScraper();
    activeScrapers.set(store.slug, scraper as { close?(): Promise<void> });

    const log = await prisma.scrapeLog.create({ data: { storeId: store.id, status: "running" } });

    // Hook progress callback — update aggregated totals
    if ("setProgressCallback" in scraper && typeof (scraper as { setProgressCallback: unknown }).setProgressCallback === "function") {
      (scraper as { setProgressCallback: (cb: unknown) => void }).setProgressCallback(
        async (info: { categoriesTotal: number; categoriesCompleted: number; currentCategory?: string }) => {
          catProgress.set(store.slug, { total: info.categoriesTotal, done: info.categoriesCompleted });
          const totalCats = [...catProgress.values()].reduce((s, p) => s + p.total, 0);
          const doneCats  = [...catProgress.values()].reduce((s, p) => s + p.done,  0);
          await updatePipelineState({ categoriesTotal: totalCats, categoriesCompleted: doneCats });
        }
      );
    }

    try {
      console.log(`[ScrapeJob] Scraping ${store.name}...`);
      const products = await scraper.run();
      activeScrapers.delete(store.slug);

      if (await isStopRequested()) {
        await prisma.scrapeLog.update({ where: { id: log.id }, data: { status: "interrupted", finishedAt: new Date() } });
        return { store, products: [] as ScrapedProduct[], interrupted: true };
      }

      await prisma.scrapeLog.update({
        where: { id: log.id },
        data: { status: "success", productCount: products.length, finishedAt: new Date() },
      });
      return { store, products };
    } catch (err) {
      activeScrapers.delete(store.slug);

      if (await isStopRequested()) {
        await prisma.scrapeLog.update({ where: { id: log.id }, data: { status: "interrupted", finishedAt: new Date() } });
        return { store, products: [] as ScrapedProduct[], interrupted: true };
      }

      const message = err instanceof Error ? err.message : String(err);
      await prisma.scrapeLog.update({
        where: { id: log.id },
        data: { status: "error", errorMessage: message.substring(0, 500), finishedAt: new Date() },
      });
      console.error(`[ScrapeJob] ${store.name} failed:`, err);
      return { store, products: [] as ScrapedProduct[] };
    }
  });

  const results = await Promise.all(scraperTasks);
  clearWatcher();

  // Handle stop after all scrapers finish
  if (await isStopRequested()) {
    await clearStopRequest();
    await updatePipelineState({ status: "idle", currentStore: null, finishedAt: new Date().toISOString() });
    return;
  }

  // Save products sequentially — avoids concurrent SQLite write contention
  let totalProducts = 0;
  let storesCompleted = 0;
  for (const { store, products } of results) {
    if (products.length > 0) {
      await saveProducts(store.id, products);
      await prisma.store.update({ where: { id: store.id }, data: { lastScrapedAt: new Date() } });
      totalProducts += products.length;
      console.log(`[ScrapeJob] ${store.name}: saved ${products.length} products`);
    }
    storesCompleted++;
    await updatePipelineState({ storesCompleted, productsScraped: totalProducts });
  }

  // Translate untranslated products
  await updatePipelineState({ status: "translating", currentStore: null });
  await translateNewProducts();

  // Notify embedder service to process new/updated products
  await updatePipelineState({ status: "enriching" });
  await notifyEmbedder();

  // Clean up old price records
  await cleanupOldRecords();

  await updatePipelineState({ status: "done", finishedAt: new Date().toISOString() });
}

async function saveProducts(storeId: number, products: ScrapedProduct[]) {
  // Process in batches of 50 within transactions to reduce SQLite lock contention
  const BATCH = 50;
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    await prisma.$transaction(async (tx) => {
      for (const p of batch) {
        try {
          const searchParts = [p.nameLt, p.categoryLt, p.brand].filter(Boolean);
          const searchIndex = normalizeForIndex(searchParts.join(" "));
          const product = await tx.product.upsert({
            where: {
              storeId_externalId: {
                storeId,
                externalId: p.externalId,
              },
            },
            update: {
              nameLt: p.nameLt,
              categoryLt: p.categoryLt || undefined,
              brand: p.brand || undefined,
              weightValue: p.weightValue || undefined,
              weightUnit: p.weightUnit || undefined,
              imageUrl: p.imageUrl || undefined,
              productUrl: p.productUrl || undefined,
              searchIndex,
            },
            create: {
              storeId,
              externalId: p.externalId,
              nameLt: p.nameLt,
              categoryLt: p.categoryLt || undefined,
              brand: p.brand || undefined,
              weightValue: p.weightValue || undefined,
              weightUnit: p.weightUnit || undefined,
              imageUrl: p.imageUrl || undefined,
              productUrl: p.productUrl || undefined,
              searchIndex,
            },
          });

          await tx.priceRecord.create({
            data: {
              productId: product.id,
              regularPrice: p.regularPrice,
              salePrice: p.salePrice || undefined,
              unitPrice: p.unitPrice || undefined,
              unitLabel: p.unitLabel || undefined,
              loyaltyPrice: p.loyaltyPrice || undefined,
              campaignText: p.campaignText || undefined,
            },
          });
        } catch (err) {
          console.warn(`[ScrapeJob] Product save error (${p.externalId}):`, err);
        }
      }
    }, { timeout: 60000 }).catch(err => {
      console.warn(`[ScrapeJob] Batch transaction error (batch ${i / BATCH + 1}):`, err);
    });
  }
}

async function translateNewProducts() {
  try {
    let totalTranslated = 0;

    // Translate in batches of 200 until all done
    while (true) {
      const untranslated = await prisma.product.findMany({
        where: { nameEn: null },
        select: { id: true, nameLt: true, categoryLt: true },
        take: 200,
      });

      if (untranslated.length === 0) break;

      console.log(`[Translate] Translating batch of ${untranslated.length} products...`);

      const names = untranslated.map((p) => p.nameLt);
      const translatedNames = await translateBatch(names);

      // Translate categories too
      const categories = untranslated
        .map((p) => p.categoryLt)
        .filter((c): c is string => !!c);
      const uniqueCategories = [...new Set(categories)];
      const translatedCategories = await translateBatch(uniqueCategories);
      const catMap = new Map<string, string>();
      uniqueCategories.forEach((c, i) => catMap.set(c, translatedCategories[i]));

      // Update products with translations and rebuild searchIndex
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
          data: {
            nameEn,
            categoryEn,
            searchIndex,
          },
        });
      }

      totalTranslated += untranslated.length;
      console.log(`[Translate] Batch done (${totalTranslated} total so far)`);
    }

    if (totalTranslated > 0) {
      console.log(`[Translate] Finished — translated ${totalTranslated} products total`);
    }
  } catch (err) {
    console.error("[Translate] Error:", err);
  }
}

async function cleanupOldRecords() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: "priceRetentionDays" },
    });
    const days = setting ? parseInt(setting.value, 10) || 90 : 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await prisma.priceRecord.deleteMany({
      where: { scrapedAt: { lt: cutoff } },
    });

    if (result.count > 0) {
      console.log(`[Cleanup] Deleted ${result.count} old price records`);
    }
  } catch (err) {
    console.error("[Cleanup] Error:", err);
  }
}

async function notifyEmbedder() {
  const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
  try {
    const res = await fetch(`${embedderUrl}/process`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      console.log(`[Embedder] Processing complete:`, data);
    } else {
      console.warn(`[Embedder] Process returned ${res.status}`);
    }
  } catch {
    console.warn("[Embedder] Service not available, skipping embedding generation");
  }
}
