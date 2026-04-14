import { Page } from "playwright";
import { BaseScraper, ScrapedProduct } from "./base-scraper.js";

/**
 * Scraper for lidl.lt — discovers subcategories from top-level category pages,
 * then loads all products via "Daugiau produktų" load-more button.
 */
export class LidlScraper extends BaseScraper {
  private static BASE = "https://www.lidl.lt";

  // Top-level categories to discover subcategories from
  private static TOP_CATEGORIES = [
    { path: "/c/maistas-gerimai-ir-buities-prekes/s10068374", name: "Maistas ir gėrimai" },
    { path: "/c/alkoholiniai-gerimai/s10019968",              name: "Alkoholiniai gėrimai" },
  ];

  // Standalone pages scraped directly (no subcategory discovery)
  private static EXTRA_PAGES = [
    { path: "/c/svarbiausios-sios-savaites-akcijos/a10023711", name: "Akcijos" },
  ];

  constructor() {
    super("Lidl");
  }

  async scrape(): Promise<ScrapedProduct[]> {
    const page = await this.newPage();
    const allProducts: ScrapedProduct[] = [];

    try {
      // Load main page once to dismiss cookies
      await page.goto(LidlScraper.BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
      await this.dismissCookies(page);

      // Discover subcategories for each top-level category
      const categories: Array<{ url: string; name: string }> = [];

      for (const top of LidlScraper.TOP_CATEGORIES) {
        const topUrl = `${LidlScraper.BASE}${top.path}`;
        await page.goto(topUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        await this.delay(1500);

        const subLinks = await page.$$eval(
          'a[href*="/h/"]',
          (anchors) => [
            ...new Set(
              (anchors as HTMLAnchorElement[])
                .map((a) => a.href)
                .filter((h) => h.includes("lidl.lt/h/"))
            ),
          ]
        );

        if (subLinks.length > 0) {
          for (const href of subLinks) {
            const slug = href.split("/h/")[1]?.split("/")[0] || "";
            const name = decodeURIComponent(slug).replace(/-/g, " ");
            categories.push({ url: href, name });
          }
        } else {
          // No subcategories found — scrape top-level directly
          categories.push({ url: topUrl, name: top.name });
        }
      }

      // Add standalone extra pages
      for (const extra of LidlScraper.EXTRA_PAGES) {
        categories.push({ url: `${LidlScraper.BASE}${extra.path}`, name: extra.name });
      }

      // Deduplicate by URL
      const seenUrl = new Set<string>();
      const uniqueCats = categories.filter(
        (c) => !seenUrl.has(c.url) && (seenUrl.add(c.url), true)
      );

      const totalCats = uniqueCats.length;
      for (let ci = 0; ci < totalCats; ci++) {
        const { url, name } = uniqueCats[ci];
        this.onProgress?.({
          categoriesTotal: totalCats,
          categoriesCompleted: ci,
          currentCategory: name,
        });
        this.log(`Scraping: ${name}`);
        try {
          const products = await this.scrapeCategory(page, url, name);
          allProducts.push(...products);
          await this.delay(1500 + Math.random() * 2000);
        } catch (err) {
          this.log(`Failed ${url}: ${err}`);
        }
      }
      this.onProgress?.({ categoriesTotal: totalCats, categoriesCompleted: totalCats });
    } finally {
      await page.close();
    }

    // Deduplicate products by externalId
    const seenP = new Set<string>();
    return allProducts.filter(
      (p) => !seenP.has(p.externalId) && (seenP.add(p.externalId), true)
    );
  }

  private async dismissCookies(page: Page): Promise<void> {
    try {
      const btn = page.locator(
        'button:has-text("Sutikti"), button:has-text("Priimti"), button:has-text("Accept all"), button:has-text("Leisti visus")'
      );
      if (await btn.first().isVisible({ timeout: 4000 })) {
        await btn.first().click();
        await this.delay(500);
      }
    } catch {
      // No cookie banner
    }
  }

  private async scrapeCategory(
    page: Page,
    url: string,
    categoryName: string
  ): Promise<ScrapedProduct[]> {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page
      .waitForSelector('article, [class*="product"], [class*="Product"]', { timeout: 15000 })
      .catch(() => {});
    await this.delay(1000);

    // Load-more loop with stale guard (same pattern as IKI)
    let prevCount = 0;
    let stale = 0;
    while (stale < 2) {
      const count = await page
        .$$eval(
          'article[class*="product"], article[class*="Product"], [data-product-id], [class*="ProductItem"], [class*="product-item"]',
          (els) => els.length
        )
        .catch(() => 0);

      if (count > prevCount) {
        prevCount = count;
        stale = 0;
      } else {
        stale++;
      }

      const moreBtn = await page.$(
        'button:has-text("Daugiau produktų"), button:has-text("Daugiau"), button:has-text("Rodyti daugiau")'
      );
      if (!moreBtn || !(await moreBtn.isVisible().catch(() => false))) break;

      await moreBtn.click();
      await this.delay(2000);
    }

    // Extract products from all loaded cards
    const rawProducts = await page.$$eval(
      'article[class*="product"], article[class*="Product"], [data-product-id], [class*="ProductItem"], [class*="product-item"]',
      (elements) => {
        const results: Array<{
          externalId: string;
          name: string;
          url: string;
          priceText: string;
          imageUrl: string | null;
        }> = [];
        const seen = new Set<string>();

        for (const el of elements) {
          // Product link — Lidl uses /p/ paths
          const link =
            (el.querySelector('a[href*="/p/"]') as HTMLAnchorElement | null) ||
            (el.closest('a[href*="/p/"]') as HTMLAnchorElement | null);
          const href = link?.href || "";

          // Extract numeric ID: e.g. /p/some-product/p123456 → "123456"
          const idMatch = href.match(/\/p(\d+)(?:[/?]|$)/) || href.match(/[?&]productId=(\d+)/);
          // Fallback: use last URL segment
          const externalId = idMatch ? idMatch[1] : href.split("/").filter(Boolean).pop() || "";

          if (!externalId || seen.has(externalId)) continue;
          seen.add(externalId);

          const img = el.querySelector("img");
          const nameEl = el.querySelector(
            '[class*="title"], [class*="name"], [class*="Title"], [class*="Name"], h2, h3'
          );
          const name = (nameEl?.textContent || img?.alt || "").trim();

          results.push({
            externalId,
            name,
            url: href,
            priceText: el.textContent?.trim() || "",
            imageUrl: img?.src || null,
          });
        }
        return results;
      }
    );

    const products: ScrapedProduct[] = [];
    for (const p of rawProducts) {
      const prices = this.parseLidlPrice(p.priceText);
      const weight = this.extractWeight(p.name);
      products.push({
        externalId: p.externalId,
        nameLt: p.name,
        categoryLt: categoryName,
        productUrl: p.url || undefined,
        imageUrl: p.imageUrl || undefined,
        weightValue: weight?.value,
        weightUnit: weight?.unit,
        ...prices,
      });
    }

    this.log(`  ${categoryName}: ${products.length} products`);
    return products.filter((p) => p.regularPrice > 0);
  }

  private parseLidlPrice(text: string): {
    regularPrice: number;
    salePrice?: number;
    unitPrice?: number;
    unitLabel?: string;
    campaignText?: string;
  } {
    let regularPrice = 0;
    let salePrice: number | undefined;
    let unitPrice: number | undefined;
    let unitLabel: string | undefined;
    let campaignText: string | undefined;

    // Unit price (e.g. "2,99 €/kg")
    const unitMatch = text.match(/(\d+[.,]\d+)\s*€\s*\/\s*(kg|l|vnt|ml)/i);
    if (unitMatch) {
      unitPrice = parseFloat(unitMatch[1].replace(",", "."));
      unitLabel = `€/${unitMatch[2]}`;
    }

    // Strip unit prices before extracting package prices
    const cleaned = text.replace(/(\d+[.,]\d+)\s*€\s*\/\s*(kg|l|vnt|ml)/gi, "");
    const priceMatches = [...cleaned.matchAll(/(\d+[.,]\d+)\s*€/g)];

    if (priceMatches.length >= 1) {
      regularPrice = parseFloat(priceMatches[0][1].replace(",", "."));
    }

    // If discount % present and two prices: first=sale price, last=original
    const discountMatch = text.match(/[–\-](\d+)\s*%/);
    if (discountMatch && priceMatches.length >= 2) {
      salePrice = regularPrice;
      regularPrice = parseFloat(
        priceMatches[priceMatches.length - 1][1].replace(",", ".")
      );
    }

    const campMatch = text.match(/([–\-]\d+\s*%|\d+\s*\+\s*\d+)/);
    if (campMatch) campaignText = campMatch[0];

    return { regularPrice, salePrice, unitPrice, unitLabel, campaignText };
  }
}
