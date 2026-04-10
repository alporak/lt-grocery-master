import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Page, BrowserContext, Browser } from "playwright";
import { ScrapedProduct } from "./base-scraper.js";

chromium.use(StealthPlugin());

/**
 * Scraper for barbora.lt — uses playwright-extra with stealth plugin
 * to bypass Cloudflare Turnstile bot detection.
 */
export class BarboraScraper {
  private static BASE = "https://barbora.lt";
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  private log(msg: string) {
    console.log(`[Barbora] ${msg}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async run(): Promise<ScrapedProduct[]> {
    this.log("Starting scrape (stealth mode)...");
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      this.context = await this.browser.newContext({
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale: "lt-LT",
        viewport: { width: 1920, height: 1080 },
      });

      const products = await this.scrape();
      this.log(`Scraped ${products.length} products`);
      return products;
    } catch (err) {
      this.log(`Error: ${err}`);
      throw err;
    } finally {
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    }
  }

  private async scrape(): Promise<ScrapedProduct[]> {
    const page = await this.context!.newPage();
    const allProducts: ScrapedProduct[] = [];

    try {
      this.log("Loading main page...");
      await page.goto(BarboraScraper.BASE, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      // Wait for Cloudflare challenge to resolve
      await page.waitForSelector('a[href*="/produktai/"], a[href*="/prekiu-grupe/"]', {
        timeout: 30000,
      }).catch(() => this.log("Timeout waiting for main page content"));
      await this.dismissCookies(page);

      // Discover category links
      const categoryLinks = await page.$$eval(
        'a[href*="/prekiu-grupe/"]',
        (anchors) => [
          ...new Set(
            anchors
              .map((a) => (a as HTMLAnchorElement).href)
              .filter((h) => h.includes("barbora.lt"))
          ),
        ]
      );

      const extraPages = [
        `${BarboraScraper.BASE}/akcijos`,
        `${BarboraScraper.BASE}/aciu-akcijos`,
      ];

      const allLinks = [...new Set([...extraPages, ...categoryLinks])];
      this.log(`Found ${allLinks.length} category/promo pages`);

      for (const url of allLinks) {
        try {
          const catName = decodeURIComponent(
            url.split("/").pop() || ""
          ).replace(/-/g, " ");
          this.log(`Scraping: ${catName}`);
          const products = await this.scrapeCategory(page, url, catName);
          allProducts.push(...products);
          await this.delay(1500 + Math.random() * 2000);
        } catch (err) {
          this.log(`Failed ${url}: ${err}`);
        }
      }
    } finally {
      await page.close();
    }

    // Deduplicate
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
        'button:has-text("Leisti visus"), button:has-text("Sutikti"), button:has-text("Accept")'
      );
      if (await btn.first().isVisible({ timeout: 3000 })) {
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
    const products: ScrapedProduct[] = [];
    let pageNum = 1;
    const maxPages = 20;

    while (pageNum <= maxPages) {
      const pageUrl = pageNum === 1 ? url : `${url}?page=${pageNum}`;
      await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      // Wait for product content or timeout
      await page
        .waitForSelector('a[href*="/produktai/"]', { timeout: 15000 })
        .catch(() => {});

      const pageProducts = await page.$$eval(
        'a[href*="/produktai/"]',
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
            if (!href.includes("/produktai/")) continue;

            const slug = href.split("/produktai/").pop() || "";
            if (!slug || seen.has(slug)) continue;
            seen.add(slug);

            // Walk up to find the product card container
            let card: Element | null = a;
            for (let i = 0; i < 6; i++) {
              if (card.parentElement) card = card.parentElement;
            }
            const cardText = card?.textContent?.trim() || "";

            const img = a.querySelector("img") || card?.querySelector("img");
            const name =
              img?.alt ||
              a.textContent?.trim().split(/\d+[.,]\d+/)[0]?.trim() ||
              slug.replace(/-/g, " ");

            results.push({
              externalId: slug,
              name,
              url: href,
              priceText: cardText,
              imageUrl: img?.src || null,
            });
          }
          return results;
        }
      );

      if (pageProducts.length === 0) break;

      for (const p of pageProducts) {
        const prices = this.parsePriceText(p.priceText);
        const weight = this.extractWeight(p.name);

        products.push({
          externalId: p.externalId,
          nameLt: p.name,
          categoryLt: categoryName,
          productUrl: p.url,
          imageUrl: p.imageUrl || undefined,
          weightValue: weight?.value,
          weightUnit: weight?.unit,
          ...prices,
        });
      }

      this.log(`  Page ${pageNum}: ${pageProducts.length} products`);

      const hasNextPage = await page
        .$(`a[href*="page=${pageNum + 1}"]`)
        .then((el) => !!el);
      if (!hasNextPage) break;

      pageNum++;
      await this.delay(1000 + Math.random() * 1000);
    }

    return products.filter((p) => p.regularPrice > 0);
  }

  private parsePriceText(text: string): {
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

    // 1. Extract unit price first
    const unitMatch = text.match(/(\d+[.,]\d+)\s*€\s*\/\s*(kg|l|vnt|ml)/i);
    if (unitMatch) {
      unitPrice = parseFloat(unitMatch[1].replace(",", "."));
      unitLabel = `€/${unitMatch[2]}`;
    }

    // 2. Strip unit prices before finding package prices
    const cleaned = text.replace(/(\d+[.,]\d+)\s*€\s*\/\s*(kg|l|vnt|ml)/gi, "");

    // 3. Find package prices only
    const priceMatches = [...cleaned.matchAll(/(\d+[.,]\d+)\s*€/g)];
    if (priceMatches.length >= 1) {
      regularPrice = parseFloat(priceMatches[0][1].replace(",", "."));
    }

    // 4. Discount: if % off and two prices, first is sale, last is original
    const discountMatch = text.match(/[–-](\d+)%/);
    if (discountMatch && priceMatches.length >= 2) {
      salePrice = regularPrice;
      regularPrice = parseFloat(
        priceMatches[priceMatches.length - 1][1].replace(",", ".")
      );
    }

    const campMatch = text.match(
      /(\d+\s*(?:už|ar daugiau su)\s*[\d.,]+\s*€|[–-]\d+%|\d+\s*\+\s*\d+)/i
    );
    if (campMatch) campaignText = campMatch[0];

    return { regularPrice, salePrice, unitPrice, unitLabel, campaignText };
  }

  private extractWeight(
    name: string
  ): { value: number; unit: string } | undefined {
    const match = name.match(
      /(\d+(?:[,\.]\d+)?)\s*(kg|g|l|ml|vnt|vnt\.|cl)\b/i
    );
    if (!match) return undefined;
    const value = parseFloat(match[1].replace(",", "."));
    const unit = match[2].toLowerCase().replace(".", "");
    return { value, unit };
  }
}
