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
      for (const catUrl of categoryLinks) {
        try {
          const catName = decodeURIComponent(
            catUrl.split("/categories/").pop() || ""
          ).replace(/-/g, " ");
          this.log(`Scraping category: ${catName}`);
          const products = await this.scrapeCategory(page, catUrl, catName);
          allProducts.push(...products);
          await this.delay(1000 + Math.random() * 2000);
        } catch (err) {
          this.log(`Failed category ${catUrl}: ${err}`);
        }
      }
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

    // Click "Rodyti daugiau" (load more) until all products are loaded
    let loadMoreClicks = 0;
    while (loadMoreClicks < 15) {
      try {
        const loadMoreBtn = page.locator(
          'button:has-text("Rodyti daugiau"), button:has-text("rodyti daugiau")'
        );
        if (await loadMoreBtn.first().isVisible({ timeout: 3000 })) {
          await loadMoreBtn.first().click();
          await this.delay(2000);
          loadMoreClicks++;
          this.log(`  Load more click ${loadMoreClicks}...`);
        } else {
          break;
        }
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
        }> = [];
        const seen = new Set<string>();

        for (const anchor of anchors) {
          const a = anchor as HTMLAnchorElement;
          const href = a.href;
          // Extract product ID from URL (last segment after last dash)
          const urlParts = href.split("/product/").pop() || "";
          const idMatch = urlParts.match(/-(\d+)$/);
          const externalId = idMatch ? idMatch[1] : urlParts;

          if (seen.has(externalId)) continue;
          seen.add(externalId);

          // The card's text contains name and price info
          const cardText = a.textContent?.trim() || "";
          // Product name is typically the first substantial text
          const name = a.querySelector("img")?.alt || cardText.split(/\d+[.,]\d+\s*€/)[0]?.trim() || cardText.substring(0, 100);

          results.push({
            externalId,
            name,
            url: href,
            priceText: cardText,
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

    // Find all price-like patterns (number followed by €)
    const priceMatches = [...text.matchAll(/(\d+[.,]\d+)\s*€/g)];

    if (priceMatches.length >= 1) {
      regularPrice = parseFloat(priceMatches[0][1].replace(",", "."));
    }

    // Unit price pattern: "X.XX € / kg" or "X.XX € / l" etc.
    const unitPriceMatch = text.match(
      /(\d+[.,]\d+)\s*€\s*\/\s*(kg|l|vnt|ml)/i
    );
    if (unitPriceMatch) {
      unitPrice = parseFloat(unitPriceMatch[1].replace(",", "."));
      unitLabel = `€/${unitPriceMatch[2]}`;
    }

    // Check for loyalty price (Lojalumo kortelė)
    if (text.includes("Lojalumo kortel")) {
      // If loyalty card text present, the first price is usually the loyalty price
      // and there's a higher "regular" price after it
      if (priceMatches.length >= 3) {
        loyaltyPrice = parseFloat(priceMatches[0][1].replace(",", "."));
        regularPrice = parseFloat(
          priceMatches[priceMatches.length > 3 ? 2 : priceMatches.length - 1][1].replace(",", ".")
        );
        salePrice = loyaltyPrice;
      }
    } else if (priceMatches.length >= 3) {
      // Has old price (sale scenario without loyalty)
      salePrice = regularPrice;
      regularPrice = parseFloat(priceMatches[2][1].replace(",", "."));
    }

    // Check for campaign text patterns
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
