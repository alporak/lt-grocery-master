import prisma from "./db.js";
import { ScrapedProduct } from "./scrapers/base-scraper.js";
import { IkiScraper, PromoCashCarryScraper } from "./scrapers/lastmile.js";
import { BarboraScraper } from "./scrapers/barbora.js";
import { RimiScraper } from "./scrapers/rimi.js";
import { LidlScraper } from "./scrapers/lidl.js";

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
    newProducts: 0,
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
  let totalNew = 0;
  let storesCompleted = 0;
  for (const { store, products } of results) {
    if (products.length > 0) {
      const { saved, newCount } = await saveProducts(store.id, products);
      await prisma.store.update({ where: { id: store.id }, data: { lastScrapedAt: new Date() } });
      totalProducts += saved;
      totalNew += newCount;
      console.log(
        `[ScrapeJob] ${store.name}: saved ${saved} products` +
        (newCount > 0 ? ` (${newCount} new, need enrichment)` : "")
      );
    }
    storesCompleted++;
    await updatePipelineState({ storesCompleted, productsScraped: totalProducts, newProducts: totalNew });
  }

  if (totalNew > 0) {
    console.log(`[ScrapeJob] ${totalNew} new products found across all stores — enrich manually`);
  }

  // Deduplicate products that share the same productUrl within a store
  await updatePipelineState({ status: "deduplicating" });
  await deduplicateProducts();

  // Clean up old price records
  await cleanupOldRecords();

  await updatePipelineState({
    status: "done",
    currentStore: null,
    finishedAt: new Date().toISOString(),
    newProducts: totalNew,
  });
}

/**
 * Save scraped products to DB.
 *
 * For each product:
 *   - EXISTING (already in DB by storeId+externalId): update details + add price record
 *   - NEW: create product row + add initial price record, no enrichment triggered
 *
 * Returns: { saved, newCount } — saved = total upserted, newCount = newly created products
 */
async function saveProducts(
  storeId: number,
  products: ScrapedProduct[]
): Promise<{ saved: number; newCount: number }> {
  // Pre-fetch known externalIds for this store so we can distinguish new vs existing
  const existingRows = await prisma.product.findMany({
    where: { storeId },
    select: { externalId: true },
  });
  const knownIds = new Set(existingRows.map((r) => r.externalId));

  let saved = 0;
  let newCount = 0;

  // Process in batches of 50 within transactions to reduce SQLite lock contention
  const BATCH = 50;
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    await prisma.$transaction(async (tx) => {
      for (const p of batch) {
        try {
          const isNew = !knownIds.has(p.externalId);

          const searchParts = [p.nameLt, p.categoryLt, p.brand].filter(Boolean);
          const searchIndex = normalizeForIndex(searchParts.join(" "));

          const product = await tx.product.upsert({
            where: { storeId_externalId: { storeId, externalId: p.externalId } },
            update: {
              nameLt: p.nameLt,
              // Use null to actively clear removed fields, undefined to preserve existing
              categoryLt: p.categoryLt || null,
              brand: p.brand || null,
              weightValue: p.weightValue ?? null,
              weightUnit: p.weightUnit || null,
              imageUrl: p.imageUrl || null,
              productUrl: p.productUrl || null,
              searchIndex,
            },
            create: {
              storeId,
              externalId: p.externalId,
              nameLt: p.nameLt,
              categoryLt: p.categoryLt || null,
              brand: p.brand || null,
              weightValue: p.weightValue ?? null,
              weightUnit: p.weightUnit || null,
              imageUrl: p.imageUrl || null,
              productUrl: p.productUrl || null,
              searchIndex,
            },
          });

          // Always record the price — both for new products (initial price) and
          // existing ones (price change tracking)
          await tx.priceRecord.create({
            data: {
              productId: product.id,
              regularPrice: p.regularPrice,
              salePrice: p.salePrice ?? null,
              unitPrice: p.unitPrice ?? null,
              unitLabel: p.unitLabel || null,
              loyaltyPrice: p.loyaltyPrice ?? null,
              campaignText: p.campaignText || null,
            },
          });

          if (isNew) {
            newCount++;
            knownIds.add(p.externalId); // prevent double-counting within batches
          }
          saved++;
        } catch (err) {
          console.warn(`[ScrapeJob] Product save error (${p.externalId}):`, err);
        }
      }
    }, { timeout: 60000 }).catch(err => {
      console.warn(`[ScrapeJob] Batch transaction error (batch ${i / BATCH + 1}):`, err);
    });
  }

  return { saved, newCount };
}

/**
 * Multi-pass deduplication within each store.
 *
 * Pass 0 — RIMI externalId canonicalisation: rewrites any non-bare-numeric
 *   RIMI externalId ("LT-12345", slug-suffixed, etc.) to its last 4+ digit
 *   run. Without this, every subsequent scrape CREATEs a new row against the
 *   legacy one (upsert key misses) and inflates "new products" forever.
 *   Pass 2 merges the rows but leaves externalIds untouched — so the leak
 *   repeats next run. Pass 0 closes that leak permanently.
 *
 * Pass 1 — URL-normalised: strip query/hash/trailing-slash, lowercase.
 *   Catches query-param variants of the same product page.
 *
 * Pass 2 — externalId numeric-suffix: "LT-12345" and "12345" in the same store
 *   are the same item. Rimi historically emitted both formats, creating ~6 500
 *   duplicate rows. Kept as a safety net for non-RIMI stores and pre-Pass-0
 *   residue.
 *
 * Pass 3 — name + imageUrl (conservative): same normalised Lithuanian name AND
 *   same imageUrl within a store. Guards against renamed externalIds with no
 *   stable URL.
 *
 * In every pass: prefer the enriched product as survivor, otherwise keep the
 * oldest row (lowest id). Price records are re-parented; duplicate rows deleted.
 */
async function deduplicateProducts(): Promise<number> {
  let totalRemoved = 0;

  // ── helpers ──────────────────────────────────────────────────────────────

  function pickSurvivor<T extends { id: number; enrichment: string | null }>(
    group: T[]
  ): { survivorId: number; dupeIds: number[] } {
    const sorted = [...group].sort((a, b) => a.id - b.id);
    const enriched = sorted.find((p) => p.enrichment !== null);
    const survivor = enriched ?? sorted[0];
    return {
      survivorId: survivor.id,
      dupeIds: sorted.filter((p) => p.id !== survivor.id).map((p) => p.id),
    };
  }

  async function mergeDupes(survivorId: number, dupeIds: number[]) {
    if (dupeIds.length === 0) return;
    await prisma.priceRecord.updateMany({
      where: { productId: { in: dupeIds } },
      data: { productId: survivorId },
    });
    await prisma.product.deleteMany({ where: { id: { in: dupeIds } } });
  }

  // ── Pass 0: RIMI externalId canonicalisation ─────────────────────────────
  // Rewrites survivor externalId to bare last-4+digit run so subsequent
  // upserts match instead of inserting.
  {
    const rimi = await prisma.store.findFirst({ where: { slug: "rimi" }, select: { id: true } });
    if (rimi) {
      const rows = await prisma.product.findMany({
        where: { storeId: rimi.id },
        select: { id: true, externalId: true, enrichment: true },
      });

      const target = (eid: string): string | null => {
        const m = eid.match(/(\d{4,})(?!.*\d{4,})/); // last 4+ digit run
        return m ? m[1] : null;
      };

      const byTarget = new Map<string, typeof rows>();
      for (const p of rows) {
        const t = target(p.externalId);
        if (!t) continue;
        if (!byTarget.has(t)) byTarget.set(t, []);
        byTarget.get(t)!.push(p);
      }

      let pass0Merged = 0;
      let pass0Renamed = 0;
      for (const [t, group] of byTarget) {
        const { survivorId, dupeIds } = pickSurvivor(group);
        if (dupeIds.length > 0) {
          await mergeDupes(survivorId, dupeIds);
          pass0Merged += dupeIds.length;
        }
        const survivor = group.find((p) => p.id === survivorId)!;
        if (survivor.externalId !== t) {
          // Guard against a collision with a row outside this target group.
          // Shouldn't happen (any row with suffix `t` would be in this group),
          // but catch unique-constraint violation defensively.
          try {
            await prisma.product.update({ where: { id: survivorId }, data: { externalId: t } });
            pass0Renamed++;
          } catch (err) {
            console.warn(`[Dedup] Pass 0 rename failed for id ${survivorId} → ${t}:`, err);
          }
        }
      }
      if (pass0Merged > 0 || pass0Renamed > 0) {
        console.log(`[Dedup] Pass 0 (Rimi externalId canon): merged ${pass0Merged}, renamed ${pass0Renamed}`);
      }
      totalRemoved += pass0Merged;
    }
  }

  // ── Pass 1: URL-normalised ────────────────────────────────────────────────
  {
    const rows = await prisma.product.findMany({
      where: { productUrl: { not: null } },
      select: { id: true, storeId: true, productUrl: true, enrichment: true },
    });

    const groups = new Map<string, typeof rows>();
    for (const p of rows) {
      const norm = p.productUrl!
        .split("?")[0].split("#")[0].toLowerCase().replace(/\/$/, "");
      const key = `${p.storeId}::${norm}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    let pass1 = 0;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const { survivorId, dupeIds } = pickSurvivor(group);
      await mergeDupes(survivorId, dupeIds);
      pass1 += dupeIds.length;
    }
    if (pass1 > 0) console.log(`[Dedup] Pass 1 (URL norm): removed ${pass1}`);
    totalRemoved += pass1;
  }

  // ── Pass 2: externalId numeric-suffix ────────────────────────────────────
  {
    const rows = await prisma.product.findMany({
      select: { id: true, storeId: true, externalId: true, enrichment: true },
    });

    const groups = new Map<string, typeof rows>();
    for (const p of rows) {
      const m = p.externalId.match(/(\d{4,})$/); // 4+ digit suffix
      if (!m) continue;
      const key = `${p.storeId}::${m[1]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    let pass2 = 0;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      if (new Set(group.map((p) => p.externalId)).size < 2) continue; // already same id
      const { survivorId, dupeIds } = pickSurvivor(group);
      await mergeDupes(survivorId, dupeIds);
      pass2 += dupeIds.length;
    }
    if (pass2 > 0) console.log(`[Dedup] Pass 2 (externalId suffix): removed ${pass2}`);
    totalRemoved += pass2;
  }

  // ── Pass 3: normalised name + imageUrl (conservative) ────────────────────
  {
    const rows = await prisma.product.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, storeId: true, nameLt: true, imageUrl: true, enrichment: true },
    });

    const normName = (s: string) =>
      s.toLowerCase()
        .replace(/\d+\s*(kg|g|ml|l|vnt|pak)/gi, "")
        .replace(/[,.\-–]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const groups = new Map<string, typeof rows>();
    for (const p of rows) {
      const nn = normName(p.nameLt);
      if (!nn || nn.length < 4) continue;
      const key = `${p.storeId}::${nn}::${p.imageUrl}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    let pass3 = 0;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const { survivorId, dupeIds } = pickSurvivor(group);
      await mergeDupes(survivorId, dupeIds);
      pass3 += dupeIds.length;
    }
    if (pass3 > 0) console.log(`[Dedup] Pass 3 (name+image): removed ${pass3}`);
    totalRemoved += pass3;
  }

  if (totalRemoved > 0) {
    console.log(`[Dedup] Total removed: ${totalRemoved} duplicate product(s)`);
  }
  return totalRemoved;
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
