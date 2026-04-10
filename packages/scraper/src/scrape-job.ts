import prisma from "./db.js";
import { ScrapedProduct } from "./scrapers/base-scraper.js";
import { IkiScraper, PromoCashCarryScraper } from "./scrapers/lastmile.js";
import { BarboraScraper } from "./scrapers/barbora.js";
import { RimiScraper } from "./scrapers/rimi.js";
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
};

export async function runScrapeJob(storeSlug?: string) {
  const stores = await prisma.store.findMany({
    where: {
      enabled: true,
      ...(storeSlug ? { slug: storeSlug } : {}),
    },
  });

  for (const store of stores) {
    const createScraper = SCRAPER_MAP[store.slug];
    if (!createScraper) {
      console.log(`[ScrapeJob] No scraper for store: ${store.slug}`);
      continue;
    }

    console.log(`[ScrapeJob] Scraping ${store.name}...`);
    const scraper = createScraper();

    // Create a log entry
    const log = await prisma.scrapeLog.create({
      data: { storeId: store.id, status: "running" },
    });

    try {
      const products = await scraper.run();
      await saveProducts(store.id, products);
      await prisma.store.update({
        where: { id: store.id },
        data: { lastScrapedAt: new Date() },
      });
      await prisma.scrapeLog.update({
        where: { id: log.id },
        data: {
          status: "success",
          productCount: products.length,
          finishedAt: new Date(),
        },
      });
      console.log(
        `[ScrapeJob] ${store.name}: saved ${products.length} products`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.scrapeLog.update({
        where: { id: log.id },
        data: {
          status: "error",
          errorMessage: message.substring(0, 500),
          finishedAt: new Date(),
        },
      });
      console.error(`[ScrapeJob] ${store.name} failed:`, err);
    }
  }

  // Translate untranslated products
  await translateNewProducts();

  // Notify embedder service to process new/updated products
  await notifyEmbedder();

  // Clean up old price records
  await cleanupOldRecords();
}

async function saveProducts(storeId: number, products: ScrapedProduct[]) {
  for (const p of products) {
    try {
      // Upsert product — searchIndex includes all searchable fields
      const searchParts = [p.nameLt, p.categoryLt, p.brand].filter(Boolean);
      const searchIndex = normalizeForIndex(searchParts.join(" "));
      const product = await prisma.product.upsert({
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

      // Append price record (always create, never update — for history)
      await prisma.priceRecord.create({
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
      // Skip individual product errors (e.g., constraint violations)
      console.warn(`[ScrapeJob] Product save error (${p.externalId}):`, err);
    }
  }
}

async function translateNewProducts() {
  try {
    const untranslated = await prisma.product.findMany({
      where: { nameEn: null },
      select: { id: true, nameLt: true, categoryLt: true },
      take: 200,
    });

    if (untranslated.length === 0) return;

    console.log(`[Translate] Translating ${untranslated.length} products...`);

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

      // Rebuild searchIndex to include English name
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

    console.log(`[Translate] Done translating ${untranslated.length} products`);
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
