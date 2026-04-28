import { Page } from "playwright";
import { BaseScraper, ScrapedProduct } from "./base-scraper.js";

/**
 * Scraper for lastmile.lt stores (IKI and PROMO Cash&Carry).
 * Both use the same platform with identical DOM structure.
 */
export class LastmileScraper extends BaseScraper {
  private chainUrl: string;
  private chainSlug: string;

  constructor(
    storeName: string,
    chainSlug: string,
    chainUrl: string
  ) {
    super(storeName);
    this.chainSlug = chainSlug;
    this.chainUrl = chainUrl;
  }

  async scrape(): Promise<ScrapedProduct[]> {
    const page = await this.newPage();
    const allProducts: ScrapedProduct[] = [];

    try {
      // 1. Navigate to chain page and discover categories
      this.log("Loading chain page...");
      await page.goto(this.chainUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector('a[href*="/categories/"]', { timeout: 30000 }).catch(() => {});
      await this.delay(2000);
      await this.dismissCookies(page);

      const categoryLinks = await page.$$eval(
        `a[href*="/chain/${this.chainSlug}/categories/"]`,
        (anchors) =>
          [...new Set(anchors.map((a) => (a as HTMLAnchorElement).href))].filter(
            (h) => !h.includes("undefined")
          )
      );

      this.log(`Found ${categoryLinks.length} categories`);

      // 2. Scrape each category
      for (let ci = 0; ci < categoryLinks.length; ci++) {
        const catUrl = categoryLinks[ci];
        try {
          const catName = decodeURIComponent(
            catUrl.split("/categories/").pop() || ""
          ).replace(/-/g, " ");
          this.onProgress?.({ categoriesTotal: categoryLinks.length, categoriesCompleted: ci, currentCategory: catName });
          this.log(`Scraping category: ${catName}`);
          const products = await this.scrapeCategory(page, catUrl, catName);
          allProducts.push(...products);
          await this.delay(1000 + Math.random() * 2000);
        } catch (err) {
          this.log(`Failed category ${catUrl}: ${err}`);
        }
      }
      this.onProgress?.({ categoriesTotal: categoryLinks.length, categoriesCompleted: categoryLinks.length });
    } finally {
      await page.close();
    }

    // Deduplicate by externalId
    const seen = new Set<string>();
    return allProducts.filter((p) => {
      if (seen.has(p.externalId)) return false;
      seen.add(p.externalId);
      return true;
    });
  }

  private async dismissCookies(page: Page): Promise<void> {
    try {
      const btn = page.locator(
        'button:has-text("Priimti visus"), button:has-text("Leisti"), button:has-text("Accept")'
      );
      if (await btn.first().isVisible({ timeout: 3000 })) {
        await btn.first().click();
        await this.delay(500);
      }
    } catch {
      // Cookie banner not found, that's OK
    }
  }

  private async scrapeCategory(
    page: Page,
    url: string,
    categoryName: string
  ): Promise<ScrapedProduct[]> {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('a[href*="/product/"]', { timeout: 15000 }).catch(() => {});
    await this.delay(1500);

    // Click "Rodyti daugiau" (load more) until all products are loaded.
    // Stop when button disappears OR product count stops growing (stale guard).
    let loadMoreClicks = 0;
    let staleTicks = 0;
    let lastProductCount = 0;
    while (true) {
      try {
        const loadMoreBtn = page.locator(
          'button:has-text("Rodyti daugiau"), button:has-text("rodyti daugiau")'
        );
        if (!(await loadMoreBtn.first().isVisible({ timeout: 3000 }))) break;

        const countBefore = await page.$$eval(
          `a[href*="/chain/${this.getCurrentChainSlug()}/product/"]`,
          (els) => els.length
        );
        await loadMoreBtn.first().click();
        loadMoreClicks++;
        this.log(`  Load more click ${loadMoreClicks}...`);

        // Wait for new products to appear (up to 5s), then a short settle delay
        await page.waitForFunction(
          (prev) => document.querySelectorAll('a[href*="/product/"]').length > prev,
          countBefore,
          { timeout: 5000 }
        ).catch(() => {});
        await this.delay(500);

        const countAfter = await page.$$eval(
          `a[href*="/chain/${this.getCurrentChainSlug()}/product/"]`,
          (els) => els.length
        );
        if (countAfter === lastProductCount) {
          staleTicks++;
          if (staleTicks >= 2) break; // two consecutive non-growing clicks → done
        } else {
          staleTicks = 0;
        }
        lastProductCount = countAfter;
      } catch {
        break;
      }
    }

    if (loadMoreClicks > 0) {
      this.log(`  Clicked load-more ${loadMoreClicks} times`);
    }

    // Extract product data from product cards
    const products = await page.$$eval(
      `a[href*="/chain/${this.getCurrentChainSlug()}/product/"]`,
      (anchors: Element[]) => {
        const results: Array<{
          externalId: string;
          name: string;
          url: string;
          priceText: string;
          imageUrl: string | null;
        }> = [];
        const seen = new Set<string>();

        for (const anchor of anchors) {
          const a = anchor as HTMLAnchorElement;
          const href = a.href;
          // Strip query/hash/trailing slash before extracting ID for stable key
          const cleanHref = href.split("?")[0].split("#")[0].replace(/\/+$/, "");
          const urlParts = cleanHref.split("/product/").pop() || "";
          if (!urlParts) continue;
          // Prefer trailing numeric ID; fall back to clean slug (PROMO URLs have no numeric suffix)
          const idMatch = urlParts.match(/-(\d+)$/);
          const externalId = idMatch ? idMatch[1] : urlParts;

          if (seen.has(externalId)) continue;
          seen.add(externalId);

          const img = a.querySelector("img");
          const cardText = a.textContent?.trim() || "";
          const name = img?.alt || cardText.split(/\d+[.,]\d+\s*€/)[0]?.trim() || cardText.substring(0, 100);

          results.push({
            externalId,
            name,
            url: cleanHref,
            priceText: cardText,
            imageUrl: img?.src || img?.getAttribute("data-src") || null,
          });
        }
        return results;
      }
    );

    return products.map((p) => {
      const prices = this.parsePriceText(p.priceText);
      const weight = this.extractWeight(p.name);

      return {
        externalId: p.externalId,
        nameLt: p.name,
        categoryLt: categoryName,
        productUrl: p.url,
        imageUrl: p.imageUrl || undefined,
        weightValue: weight?.value,
        weightUnit: weight?.unit,
        ...prices,
      };
    }).filter((p) => p.regularPrice > 0);
  }

  private getCurrentChainSlug(): string {
    return this.chainSlug;
  }

  private parsePriceText(text: string): {
    regularPrice: number;
    salePrice?: number;
    unitPrice?: number;
    unitLabel?: string;
    loyaltyPrice?: number;
    campaignText?: string;
  } {
    let regularPrice = 0;
    let salePrice: number | undefined;
    let unitPrice: number | undefined;
    let unitLabel: string | undefined;
    let loyaltyPrice: number | undefined;
    let campaignText: string | undefined;

    // 1. Extract unit price — use last match (regular unit price, not loyalty)
    const unitMatches = [...text.matchAll(/(\d+[.,]\d+)\s*€\s*\/\s*(kg|l|vnt|ml)/gi)];
    if (unitMatches.length > 0) {
      const lastUnit = unitMatches[unitMatches.length - 1];
      unitPrice = parseFloat(lastUnit[1].replace(",", "."));
      unitLabel = `€/${lastUnit[2]}`;
    }

    // 2. Strip unit prices and deposit text before extracting package prices
    const cleaned = text
      .replace(/(\d+[.,]\d+)\s*€\s*\/\s*(kg|l|vnt|ml)/gi, "")
      .replace(/Depozitas\s+\d+[.,]\d+\s*€/gi, "");

    // 3. Find package prices only
    const priceMatches = [...cleaned.matchAll(/(\d+[.,]\d+)\s*€/g)];

    if (priceMatches.length >= 1) {
      regularPrice = parseFloat(priceMatches[0][1].replace(",", "."));
    }

    // 4. Loyalty pricing: first = loyalty, last = regular
    if (text.includes("Lojalumo kortel") && priceMatches.length >= 2) {
      loyaltyPrice = parseFloat(priceMatches[0][1].replace(",", "."));
      regularPrice = parseFloat(priceMatches[priceMatches.length - 1][1].replace(",", "."));
      salePrice = loyaltyPrice;
    } else if (priceMatches.length >= 2) {
      // Non-loyalty sale: first = sale, last = regular (only if different)
      const first = parseFloat(priceMatches[0][1].replace(",", "."));
      const last = parseFloat(priceMatches[priceMatches.length - 1][1].replace(",", "."));
      if (first !== last) {
        salePrice = first;
        regularPrice = last;
      }
    }

    // 5. Campaign text
    const campaignMatch = text.match(
      /(1\+1|2\+1|Gauk \d+ už [\d.,]+ €|[–-]\d+%)/i
    );
    if (campaignMatch) {
      campaignText = campaignMatch[0];
    }

    return { regularPrice, salePrice, unitPrice, unitLabel, loyaltyPrice, campaignText };
  }
}

export class IkiScraper extends LastmileScraper {
  constructor() {
    super("IKI", "IKI", "https://www.lastmile.lt/chain/IKI");
  }
}

export class PromoCashCarryScraper extends LastmileScraper {
  constructor() {
    super(
      "PROMO Cash&Carry",
      "PROMO-CashandCarry",
      "https://www.lastmile.lt/chain/PROMO-CashandCarry"
    );
  }
}
