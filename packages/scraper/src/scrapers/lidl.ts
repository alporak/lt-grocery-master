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

      // Auto-remove any consent overlays that appear on subsequent pages
      await page.route('**/*onetrust*', (route) => route.abort());
      await page.route('**/*cookielaw*', (route) => route.abort());

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
        'button:has-text("SUTINKU"), button:has-text("Sutinku"), button:has-text("Sutikti"), button:has-text("Priimti"), button:has-text("Accept all"), button:has-text("Leisti visus")'
      );
      if (await btn.first().isVisible({ timeout: 4000 })) {
        await btn.first().click();
        await this.delay(1000);
        return;
      }
    } catch {}
    try {
      // OneTrust consent (used on some Lidl pages like Akcijos)
      const otBtn = page.locator('#onetrust-accept-btn-handler');
      if (await otBtn.isVisible({ timeout: 3000 })) {
        await otBtn.click();
        await this.delay(500);
        return;
      }
    } catch {}
    // Fallback: forcibly remove any blocking consent overlay
    await page.evaluate(() => {
      document.getElementById('onetrust-consent-sdk')?.remove();
    }).catch(() => {});
  }

  private async scrapeCategory(
    page: Page,
    url: string,
    categoryName: string
  ): Promise<ScrapedProduct[]> {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page
      .waitForSelector('a[href*="/p/"]', { timeout: 15000 })
      .catch(() => {});
    // Remove any consent overlays that may block interaction
    await page.evaluate(() => {
      document.getElementById('onetrust-consent-sdk')?.remove();
      document.querySelector('.onetrust-pc-dark-filter')?.remove();
    }).catch(() => {});
    await this.delay(1500);

    // Load-more loop with stale guard (same pattern as IKI)
    let prevCount = 0;
    let stale = 0;
    while (stale < 2) {
      const count = await page
        .$$eval('a[href*="/p/"]', (links) =>
          new Set(
            links
              .map((a) => (a as HTMLAnchorElement).href.match(/\/p(\d+)/)?.[1])
              .filter(Boolean)
          ).size
        )
        .catch(() => 0);

      if (count > prevCount) {
        prevCount = count;
        stale = 0;
      } else {
        stale++;
      }

      const moreBtn = await page.$(
        'button:has-text("Daugiau produktų"), button:has-text("Daugiau"), button:has-text("Rodyti daugiau"), a:has-text("Daugiau produktų")'
      );
      if (!moreBtn || !(await moreBtn.isVisible().catch(() => false))) break;

      // Remove consent overlay before each click — it can re-appear after navigation
      await page.evaluate(() => {
        document.getElementById('onetrust-consent-sdk')?.remove();
        document.querySelector('.onetrust-pc-dark-filter')?.remove();
      }).catch(() => {});

      await moreBtn.click();
      await this.delay(2000);
    }

    // Extract products using /p/ links as anchors (resilient to class-name changes)
    const rawProducts = await page.evaluate(() => {
      const results: Array<{
        externalId: string;
        name: string;
        url: string;
        priceText: string;
        imageUrl: string | null;
      }> = [];
      const seen = new Set<string>();

      for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/p/"]'))) {
        const href = link.href;
        const idMatch = href.match(/\/p(\d+)(?:[?#/]|$)/);
        const externalId = idMatch?.[1] || "";
        if (!externalId || seen.has(externalId)) continue;
        seen.add(externalId);

        // Find card container.
        // Try semantic elements first — most reliable.
        // Fall back to walk-up with a higher threshold (6 instead of 3) so cards
        // whose inner wrapper has 4+ elements (image, name, price, badges, button)
        // don't cause the walk to stop one level too early.
        const semanticCard = (link.closest("li") ?? link.closest("article")) as Element | null;
        let card: Element;
        if (semanticCard) {
          card = semanticCard;
        } else {
          card = link;
          for (let i = 0; i < 12; i++) {
            if (!card.parentElement || card.parentElement === document.body) break;
            if (card.parentElement.children.length > 6) break;
            card = card.parentElement;
          }
        }

        // Prefer a dedicated price element inside the card for cleaner text extraction.
        const priceEl =
          card.querySelector<Element>('[class*="pricebox"]') ??
          card.querySelector<Element>('[class*="price-box"]') ??
          card.querySelector<Element>('[class*="price"]');

        const img = card.querySelector("img");
        const name = (img?.alt || link.textContent || "")
          .trim()
          .split("\n")[0]
          ?.trim() || "";
        if (!name) continue;

        results.push({
          externalId,
          name,
          url: href.split("#")[0],
          priceText: priceEl?.textContent || card.textContent || "",
          imageUrl:
            img?.src ||
            img?.getAttribute("data-src") ||
            img?.getAttribute("srcset")?.split(/[,\s]/)[0] ||
            null,
        });
      }
      return results;
    });

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
    loyaltyPrice?: number;
    unitPrice?: number;
    unitLabel?: string;
    campaignText?: string;
  } {
    let regularPrice = 0;
    let salePrice: number | undefined;
    let loyaltyPrice: number | undefined;
    let unitPrice: number | undefined;
    let unitLabel: string | undefined;
    let campaignText: string | undefined;

    // Unit price — two formats:
    //   "14,32 €/kg"  (slash notation)
    //   "1 kg = 14,32 €"  (equation notation — common on Lidl LT)
    const unitSlash = text.match(/(\d+[.,]\d+)\s*€\s*\/\s*(kg|l|g|ml|vnt)/i);
    const unitEq    = text.match(/\d+(?:[.,]\d+)?\s*(kg|l|g|ml|vnt)\s*=\s*(\d+[.,]\d+)\s*€/i);
    if (unitSlash) {
      unitPrice = parseFloat(unitSlash[1].replace(",", "."));
      unitLabel = `€/${unitSlash[2].toLowerCase()}`;
    } else if (unitEq) {
      unitPrice = parseFloat(unitEq[2].replace(",", "."));
      unitLabel  = `€/${unitEq[1].toLowerCase()}`;
    }

    // Strip ALL unit-price expressions so they don't pollute package-price extraction
    const cleaned = text
      .replace(/\d+(?:[.,]\d+)?\s*(?:kg|l|g|ml|vnt)\s*=\s*\d+[.,]\d+\s*€/gi, "")
      .replace(/\d+[.,]\d+\s*€\s*\/\s*(?:kg|l|g|ml|vnt)/gi, "");

    // Package prices remaining (in order of appearance).
    // Collect both decimal format ("3,99 €") and split format ("3 99 €" / "3\n99\n€").
    const priceEntries: Array<{ value: number; index: number }> = [];

    // Split format: integer euros followed immediately by 2-digit cents and €
    // e.g. "3 99 €" or "3\n99\n€" (common on Lidl LT)
    const splitRe = /\b(\d{1,3})\s+(\d{2})\s*€/g;
    let sm: RegExpExecArray | null;
    while ((sm = splitRe.exec(cleaned)) !== null) {
      priceEntries.push({ value: parseFloat(`${sm[1]}.${sm[2]}`), index: sm.index });
    }

    // Decimal format — skip positions already covered by a split match
    const decRe = /(\d+[.,]\d+)\s*€/g;
    let dm: RegExpExecArray | null;
    while ((dm = decRe.exec(cleaned)) !== null) {
      const covered = priceEntries.some((e) => Math.abs(e.index - dm!.index) < 6);
      if (!covered) {
        priceEntries.push({ value: parseFloat(dm[1].replace(",", ".")), index: dm.index });
      }
    }

    priceEntries.sort((a, b) => a.index - b.index);
    const priceMatches = priceEntries; // keep name for consistency below

    if (priceMatches.length >= 1) {
      regularPrice = priceMatches[0].value;
    }

    // Campaign text
    const campMatch = text.match(/([–\-]\d+\s*%|\d+\s*\+\s*\d+)/);
    if (campMatch) campaignText = campMatch[0].replace("–", "-");

    // Second price: loyalty (su Lidl Plus) or regular sale
    if (priceMatches.length >= 2) {
      const secondPrice = priceMatches[1].value;
      const isLidlPlus  = /su\s+lidl\s+plus/i.test(text);
      if (isLidlPlus) {
        loyaltyPrice = secondPrice;
      } else if (campMatch) {
        salePrice = secondPrice;
      }
    }

    return { regularPrice, salePrice, loyaltyPrice, unitPrice, unitLabel, campaignText };
  }
}
