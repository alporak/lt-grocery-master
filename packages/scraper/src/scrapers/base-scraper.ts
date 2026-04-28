import { chromium, Browser, BrowserContext, Page } from "playwright";

export interface ScrapeProgress {
  categoriesTotal: number;
  categoriesCompleted: number;
  currentCategory?: string;
}

export type ProgressCallback = (info: ScrapeProgress) => void;

export interface ScrapedProduct {
  externalId: string;
  nameLt: string;
  categoryLt?: string;
  brand?: string;
  weightValue?: number;
  weightUnit?: string;
  imageUrl?: string;
  productUrl?: string;
  regularPrice: number;
  salePrice?: number;
  unitPrice?: number;
  unitLabel?: string;
  loyaltyPrice?: number;
  campaignText?: string;
}

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected headless: boolean;
  protected storeName: string;
  protected onProgress?: ProgressCallback;
  protected requiresBrowser = true;

  setProgressCallback(cb: ProgressCallback) {
    this.onProgress = cb;
  }

  constructor(storeName: string) {
    this.storeName = storeName;
    this.headless = process.env.SCRAPE_HEADLESS !== "false";
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });
    this.context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "lt-LT",
      viewport: { width: 1920, height: 1080 },
      javaScriptEnabled: true,
    });
    // Remove navigator.webdriver property
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.browser = null;
    this.context = null;
  }

  protected async newPage(): Promise<Page> {
    if (!this.context) throw new Error("Browser not initialized");
    return this.context.newPage();
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected log(msg: string): void {
    console.log(`[${this.storeName}] ${msg}`);
  }

  protected parsePrice(text: string): number | undefined {
    if (!text) return undefined;
    const cleaned = text.replace(/[^\d,.\-]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  protected extractWeight(
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

  abstract scrape(): Promise<ScrapedProduct[]>;

  async run(): Promise<ScrapedProduct[]> {
    try {
      if (this.requiresBrowser) await this.init();
      this.log("Starting scrape...");
      const products = await this.scrape();
      this.log(`Scraped ${products.length} products`);
      return products;
    } catch (err) {
      this.log(`Error: ${err}`);
      throw err;
    } finally {
      if (this.requiresBrowser) await this.close();
    }
  }
}
