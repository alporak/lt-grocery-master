import { Page } from "playwright";
import { BaseScraper, ScrapedProduct } from "./base-scraper.js";

/**
 * Scraper for rimi.lt/e-parduotuve — uses currentPage=N pagination
 * with SH-* category codes.
 */
export class RimiScraper extends BaseScraper {
  private static BASE = "https://www.rimi.lt/e-parduotuve/lt";

  // Top-level category pages to crawl
  private static CATEGORY_PAGES = [
    "/produktai/vaisiai-darzoves-ir-geles/c/SH-2",
    "/produktai/pieno-produktai-ir-kiausiniai/c/SH-3",
    "/produktai/duonos-ir-konditerijos-gaminiai/c/SH-4",
    "/produktai/mesa-vistiena-ir-zuvis/c/SH-5",
    "/produktai/sildomieji-ir-gatavi-produktai/c/SH-19",
    "/produktai/saldytas-maistas/c/SH-6",
    "/produktai/bakaleja/c/SH-2-8",
    "/produktai/gerimai/c/SH-9",
    "/produktai/saldumynai-ir-uzkandziai/c/SH-10",
    "/produktai/alkoholiniai-gerimai/c/SH-11",
    "/produktai/kosmetika-ir-higiena/c/SH-12",
    "/produktai/valymo-ir-buities-prekes/c/SH-13",
    "/produktai/kudikiams-ir-vaikams/c/SH-14",
    "/produktai/gyvunams/c/SH-15",
    "/produktai/virtuvei-ir-namams/c/SH-17",
    "/akcijos",
  ];

  constructor() {
    super("Rimi");
  }

  async scrape(): Promise<ScrapedProduct[]> {
    const page = await this.newPage();
    const allProducts: ScrapedProduct[] = [];

    try {
      this.log("Loading main page...");
      await page.goto(`${RimiScraper.BASE}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForSelector('a[href*="/produktai/"]', { timeout: 15000 }).catch(() => {});
      await this.delay(2000);
      await this.dismissCookies(page);

      const totalCats = RimiScraper.CATEGORY_PAGES.length;
      for (let ci = 0; ci < totalCats; ci++) {
        const catPath = RimiScraper.CATEGORY_PAGES[ci];
        try {
          const catName = this.categoryNameFromPath(catPath);
          this.onProgress?.({ categoriesTotal: totalCats, categoriesCompleted: ci, currentCategory: catName });
          this.log(`Scraping category: ${catName}`);
          const catUrl = `${RimiScraper.BASE}${catPath}`;
          const products = await this.scrapeCategory(page, catUrl, catName);
          allProducts.push(...products);
          await this.delay(1500 + Math.random() * 2000);
        } catch (err) {
          this.log(`Failed ${catPath}: ${err}`);
        }
      }
      this.onProgress?.({ categoriesTotal: totalCats, categoriesCompleted: totalCats });
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
        'button:has-text("Naudoti tik būtinuosius"), button:has-text("Sutikti su visais"), button:has-text("Accept")'
      );
      if (await btn.first().isVisible({ timeout: 3000 })) {
        await btn.first().click();
        await this.delay(500);
      }
    } catch {
      // No cookie banner
    }
  }

  private categoryNameFromPath(path: string): string {
    // Extract readable name from "/produktai/vaisiai-darzoves-ir-geles/c/SH-2"
    const match = path.match(/\/produktai\/([^/]+)\//);
    if (match) return match[1].replace(/-/g, " ");
    if (path.includes("akcijos")) return "Akcijos";
    return path;
  }

  private async scrapeCategory(
    page: Page,
    url: string,
    categoryName: string
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    let currentPage = 1;
    const pageSize = 80;

    while (true) {
      const pageUrl =
        currentPage === 1
          ? `${url}?currentPage=1&pageSize=${pageSize}`
          : `${url}?currentPage=${currentPage}&pageSize=${pageSize}`;

      // For promo pages, use query param format
      const finalUrl = url.includes("?")
        ? `${url}&currentPage=${currentPage}&pageSize=${pageSize}`
        : pageUrl;

      await page.goto(finalUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector('a[href*="/p/"]', { timeout: 15000 }).catch(() => {});
      await this.delay(1500);

      // Extract products from the page
      const pageProducts = await page.$$eval(
        '[data-product-code], .product-grid__item, a[href*="/p/"]',
        (elements: Element[]) => {
          const results: Array<{
            externalId: string;
            name: string;
            url: string;
            priceText: string;
            imageUrl: string | null;
          }> = [];
          const seen = new Set<string>();

          for (const el of elements) {
            // Try to get product code from data attribute
            let externalId =
              el.getAttribute("data-product-code") || "";

            // Find the product link
            const link =
              el.tagName === "A"
                ? (el as HTMLAnchorElement)
                : el.querySelector('a[href*="/p/"]');
            if (!link) continue;
            const href = (link as HTMLAnchorElement).href;

            // Extract product ID from /p/XXXXX
            if (!externalId) {
              const pMatch = href.match(/\/p\/(\d+)/);
              externalId = pMatch ? pMatch[1] : href;
            }

            if (!externalId || seen.has(externalId)) continue;
            seen.add(externalId);

            const cardText = el.textContent?.trim() || "";
            const img = el.querySelector("img");
            const name =
              img?.alt ||
              el
                .querySelector('[class*="name"], [class*="title"]')
                ?.textContent?.trim() ||
              cardText.split(/\d+[.,]\d+/)[0]?.trim().substring(0, 100) ||
              "";

            results.push({
              externalId,
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

      // Check if there's a next page link
      const hasNext = await page
        .$(`a[href*="currentPage=${currentPage + 1}"]`)
        .then((el) => !!el);
      if (!hasNext) break;

      currentPage++;
      await this.delay(1000);
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

    // 1. Strip deposit text (e.g. "Užstatas už tarą: 0,10 €")
    const noDeposit = text.replace(/[Uu]žstatas[^€]+€/g, "");

    // 2. Extract weight/volume unit price from original text — use last occurrence
    //    so a sale item's regular unit price (not the sale unit price) wins.
    const weightUnitMatches = [
      ...text.matchAll(/(\d+[.,]\d+)\s*€\s*\/\s*(kg|l|ml|gab)/gi),
    ];
    if (weightUnitMatches.length > 0) {
      const last = weightUnitMatches[weightUnitMatches.length - 1];
      unitPrice = parseFloat(last[1].replace(",", "."));
      unitLabel = `€/${last[2]}`;
    }

    // 3. Build cleaned text:
    //    - Remove ALL weight/volume unit prices (global replace, not just first)
    //    - Normalise per-piece unit labels ("€/vnt.", "€/pcs.") → "€" so that
    //      Rimi's split-layout price "2\n49\n€/vnt." becomes "2\n49\n€"
    const cleaned = noDeposit
      .replace(/\d+[.,]\d+\s*€\s*\/\s*(kg|l|ml|gab)/gi, "")
      .replace(/€\s*\/\s*(vnt\.?|pcs\.?)/gi, "€");

    // 4. Collect package prices in text order.
    //    Format A: "1,99 €" / "1.99 €"  — standard decimal
    //    Format B: "1 99 €" / "1\n99 €" — Rimi split layout (euros + 2-digit cents)
    const priceEntries: Array<{ value: number; index: number }> = [];

    // Split format first
    const splitRe = /\b(\d+)\s+(\d{2})\s*€/g;
    let m: RegExpExecArray | null;
    while ((m = splitRe.exec(cleaned)) !== null) {
      priceEntries.push({ value: parseFloat(`${m[1]}.${m[2]}`), index: m.index });
    }

    // Decimal format — skip positions already covered by a split match
    const decRe = /(\d+[.,]\d+)\s*€/g;
    while ((m = decRe.exec(cleaned)) !== null) {
      const covered = priceEntries.some((e) => Math.abs(e.index - m!.index) < 6);
      if (!covered) {
        priceEntries.push({
          value: parseFloat(m[1].replace(",", ".")),
          index: m.index,
        });
      }
    }

    priceEntries.sort((a, b) => a.index - b.index);
    const prices = priceEntries.map((e) => e.value);

    // 5. Assign prices: first = sale (if two found), last = regular
    if (prices.length >= 1) regularPrice = prices[0];
    if (prices.length >= 2) {
      salePrice = prices[0];
      regularPrice = prices[prices.length - 1];
    }

    // 6. Campaign text
    const campMatch = text.match(
      /([–-]\d+\s*%|\d+\s*\+\s*\d+|tik\s+[\d.,]+\s*€)/i
    );
    if (campMatch) campaignText = campMatch[0];

    return { regularPrice, salePrice, unitPrice, unitLabel, campaignText };
  }
}
