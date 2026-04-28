import { BaseScraper, ScrapedProduct } from "./base-scraper.js";

/**
 * Scraper for rimi.lt/e-parduotuve — sitemap-driven, HTTP-only (no browser).
 *
 * Stage 1: discover all LT product URLs from the public XML sitemaps.
 * Stage 2: HTTP-GET each product page, extract structured price/name data
 *          from the embedded JSON-LD block (server-rendered, no JS required).
 *
 * Advantages over the old category-page approach:
 *  - No Playwright → no cookie wall, no zombie processes, no pagination loops
 *  - Stable externalId: bare numeric ID from /p/{N} in URL
 *  - Full product catalogue coverage (sitemap is authoritative)
 */
export class RimiScraper extends BaseScraper {
  protected requiresBrowser = false;

  private static SITEMAP_INDEX =
    "https://www.rimi.lt/e-parduotuve/sitemap.xml";
  private static CONCURRENCY = 10;
  private static RETRY_DELAY_MS = 2000;

  constructor() {
    super("Rimi");
  }

  async scrape(): Promise<ScrapedProduct[]> {
    // ── Stage 1: collect all LT product URLs from sitemaps ──────────────────
    this.log("Fetching sitemap index...");
    const sitemapUrls = await this.fetchLtProductSitemapUrls();
    this.log(`Found ${sitemapUrls.length} LT product sitemap(s)`);

    const allProductUrls: string[] = [];
    for (let i = 0; i < sitemapUrls.length; i++) {
      this.onProgress?.({
        categoriesTotal: sitemapUrls.length,
        categoriesCompleted: i,
        currentCategory: `sitemap ${i + 1}/${sitemapUrls.length}`,
      });
      const urls = await this.fetchProductUrlsFromSitemap(sitemapUrls[i]);
      allProductUrls.push(...urls);
      this.log(`  Sitemap ${i + 1}: ${urls.length} products (total ${allProductUrls.length})`);
    }
    this.onProgress?.({
      categoriesTotal: sitemapUrls.length,
      categoriesCompleted: sitemapUrls.length,
      currentCategory: "fetching product details",
    });

    // ── Stage 2: fetch each product page for price/name via JSON-LD ─────────
    this.log(`Fetching details for ${allProductUrls.length} products (concurrency=${RimiScraper.CONCURRENCY})...`);
    const products: ScrapedProduct[] = [];
    let fetched = 0;

    await this.withConcurrency(allProductUrls, RimiScraper.CONCURRENCY, async (url) => {
      const product = await this.fetchProductDetail(url);
      if (product) {
        products.push(product);
      }
      fetched++;
      if (fetched % 200 === 0) {
        this.log(`  Progress: ${fetched}/${allProductUrls.length} fetched, ${products.length} parsed`);
      }
    });

    this.log(`Done: ${products.length} products with prices`);
    return products;
  }

  // ── Sitemap helpers ────────────────────────────────────────────────────────

  private async fetchLtProductSitemapUrls(): Promise<string[]> {
    const xml = await this.fetchText(RimiScraper.SITEMAP_INDEX);
    const locMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)];
    return locMatches
      .map((m) => m[1].trim())
      .filter((u) => u.includes("/sitemaps/products/") && u.includes("_lt_"));
  }

  private async fetchProductUrlsFromSitemap(sitemapUrl: string): Promise<string[]> {
    const xml = await this.fetchText(sitemapUrl);
    const locMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)];
    return locMatches
      .map((m) => m[1].trim())
      .filter((u) => u.includes("/p/"));
  }

  // ── Product detail via JSON-LD ─────────────────────────────────────────────

  private async fetchProductDetail(url: string): Promise<ScrapedProduct | null> {
    const externalIdMatch = url.match(/\/p\/(\d+)(?:[?#/]|$)/);
    if (!externalIdMatch) return null;
    const externalId = externalIdMatch[1];

    // Extract top-level category from URL path
    // URL shape: /e-parduotuve/lt/produktai/{category}/{...}/{slug}/p/{id}
    const catMatch = url.match(/\/produktai\/([^/]+)\//);
    const categoryLt = catMatch ? catMatch[1].replace(/-/g, " ") : undefined;

    try {
      const html = await this.fetchText(url, 1);

      // Extract all JSON-LD blocks
      const ldBlocks: string[] = [];
      const ldRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      let m: RegExpExecArray | null;
      while ((m = ldRe.exec(html)) !== null) {
        ldBlocks.push(m[1]);
      }

      for (const block of ldBlocks) {
        const parsed = this.parseJsonSafe(block);
        if (!parsed || parsed["@type"] !== "Product") continue;

        const nameLt = (parsed.name as string | undefined)?.trim();
        if (!nameLt) continue;

        const imageUrl: string | undefined =
          typeof parsed.image === "string"
            ? parsed.image
            : Array.isArray(parsed.image)
            ? (parsed.image[0] as string)
            : undefined;

        const brand: string | undefined =
          typeof parsed.brand === "object" && parsed.brand !== null
            ? (parsed.brand as { name?: string }).name
            : undefined;

        const offers = Array.isArray(parsed.offers)
          ? (parsed.offers as unknown[])
          : parsed.offers
          ? [parsed.offers]
          : [];

        const prices = this.extractPrices(offers);
        if (!prices || prices.regularPrice <= 0) continue;

        const weight = this.extractWeight(nameLt);

        const cleanUrl = url.split("?")[0].split("#")[0];

        return {
          externalId,
          nameLt,
          categoryLt,
          brand,
          productUrl: cleanUrl,
          imageUrl,
          weightValue: weight?.value,
          weightUnit: weight?.unit,
          ...prices,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private extractPrices(offers: unknown[]): {
    regularPrice: number;
    salePrice?: number;
    unitPrice?: number;
    unitLabel?: string;
    campaignText?: string;
  } | null {
    if (offers.length === 0) return null;

    const prices: number[] = [];
    for (const offer of offers) {
      if (typeof offer !== "object" || offer === null) continue;
      const o = offer as Record<string, unknown>;
      if (typeof o.price === "number" && o.price > 0) {
        prices.push(o.price);
      } else if (typeof o.price === "string") {
        const v = parseFloat(o.price);
        if (!isNaN(v) && v > 0) prices.push(v);
      }
    }

    if (prices.length === 0) return null;

    const regularPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const salePrice = minPrice < regularPrice ? minPrice : undefined;

    return { regularPrice, salePrice };
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  private async fetchText(url: string, retries = 1): Promise<string> {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "lt-LT,lt;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { headers });
        if (res.ok) return await res.text();
        if (res.status === 429 && attempt < retries) {
          await this.delay(RimiScraper.RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        return "";
      } catch {
        if (attempt < retries) {
          await this.delay(RimiScraper.RETRY_DELAY_MS);
          continue;
        }
        return "";
      }
    }
    return "";
  }

  private parseJsonSafe(text: string): Record<string, unknown> | null {
    try {
      const val = JSON.parse(text.trim());
      return typeof val === "object" && val !== null ? (val as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  private async withConcurrency<T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>
  ): Promise<void> {
    const queue = [...items];
    let active = 0;

    await new Promise<void>((resolve, reject) => {
      const next = () => {
        if (queue.length === 0 && active === 0) {
          resolve();
          return;
        }
        while (active < limit && queue.length > 0) {
          const item = queue.shift()!;
          active++;
          fn(item)
            .then(() => {
              active--;
              next();
            })
            .catch(reject);
        }
      };
      next();
    });
  }
}
