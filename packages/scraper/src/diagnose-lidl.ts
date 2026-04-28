/**
 * Diagnostic: dump raw card HTML + parsed prices for the first 10 Lidl products.
 *
 *   docker compose exec scraper npx tsx src/diagnose-lidl.ts
 *
 * Output saved to /tmp/lidl-diagnose.json — share this file to debug price issues.
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const BASE = "https://www.lidl.lt";
const TEST_CATEGORY = "/c/maistas-gerimai-ir-buities-prekes/s10068374";
const MAX_PRODUCTS = 10;
const OUT = "/tmp/lidl-diagnose.json";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "lt-LT",
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  console.log("Loading main page (cookie dismiss)...");
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  // Dismiss cookies
  for (const sel of [
    'button:has-text("SUTINKU")',
    'button:has-text("Sutinku")',
    '#onetrust-accept-btn-handler',
  ]) {
    try {
      const btn = page.locator(sel);
      if (await btn.first().isVisible({ timeout: 3000 })) {
        await btn.first().click();
        await page.waitForTimeout(1000);
        break;
      }
    } catch { /* ignore */ }
  }

  console.log("Loading first subcategory to find product links...");
  const catUrl = `${BASE}${TEST_CATEGORY}`;
  await page.goto(catUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('a[href*="/p/"]', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => {
    document.getElementById("onetrust-consent-sdk")?.remove();
  }).catch(() => {});
  await page.waitForTimeout(2000);

  // Find first subcategory link (/h/) and navigate to it
  const subLinks = await page.$$eval('a[href*="/h/"]', (els) =>
    [...new Set((els as HTMLAnchorElement[]).map((a) => a.href).filter((h) => h.includes("lidl.lt/h/")))].slice(0, 1)
  );

  if (subLinks.length > 0) {
    console.log(`Navigating to subcategory: ${subLinks[0]}`);
    await page.goto(subLinks[0], { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('a[href*="/p/"]', { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => {
      document.getElementById("onetrust-consent-sdk")?.remove();
    }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  const data = await page.evaluate((maxProducts) => {
    const results: Array<{
      externalId: string;
      href: string;
      // Walk strategies
      liCard: { text: string; outerHTML: string } | null;
      articleCard: { text: string; outerHTML: string } | null;
      walkUpCard: {
        text: string;
        outerHTML: string;
        levels: number;
        parentChildCount: number;
      };
      // Price element found
      priceElText: string | null;
      priceElClass: string | null;
      // Image
      imgSrc: string | null;
      imgAlt: string | null;
    }> = [];

    const seen = new Set<string>();
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/p/"]'));

    for (const link of links) {
      if (results.length >= maxProducts) break;

      const href = link.href;
      const idMatch = href.match(/\/p(\d+)(?:[?#/]|$)/);
      const externalId = idMatch?.[1] || "";
      if (!externalId || seen.has(externalId)) continue;
      seen.add(externalId);

      // Strategy 1: closest li
      const liCard = link.closest("li");
      // Strategy 2: closest article
      const articleCard = link.closest("article");

      // Strategy 3: walk-up
      let walkCard: Element = link;
      let levels = 0;
      let parentChildCount = 0;
      for (let i = 0; i < 12; i++) {
        if (!walkCard.parentElement || walkCard.parentElement === document.body) break;
        parentChildCount = walkCard.parentElement.children.length;
        if (parentChildCount > 6) break;
        walkCard = walkCard.parentElement;
        levels++;
      }

      // Price element
      const container = liCard ?? articleCard ?? walkCard;
      const priceEl =
        container.querySelector('[class*="pricebox"]') ??
        container.querySelector('[class*="price-box"]') ??
        container.querySelector('[class*="price"]');

      const img = container.querySelector("img");

      results.push({
        externalId,
        href,
        liCard: liCard
          ? { text: liCard.textContent?.substring(0, 300) || "", outerHTML: liCard.outerHTML.substring(0, 2000) }
          : null,
        articleCard: articleCard
          ? { text: articleCard.textContent?.substring(0, 300) || "", outerHTML: articleCard.outerHTML.substring(0, 2000) }
          : null,
        walkUpCard: {
          text: walkCard.textContent?.substring(0, 300) || "",
          outerHTML: walkCard.outerHTML.substring(0, 2000),
          levels,
          parentChildCount,
        },
        priceElText: priceEl?.textContent?.trim() || null,
        priceElClass: priceEl?.className || null,
        imgSrc: img?.src || img?.getAttribute("data-src") || null,
        imgAlt: img?.alt || null,
      });
    }

    return results;
  }, MAX_PRODUCTS);

  writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`\nDone. ${data.length} products. Results → ${OUT}`);
  console.log("\n--- Quick summary ---");
  for (const d of data) {
    console.log(`\n[${d.externalId}] ${d.href}`);
    console.log(`  li card found: ${d.liCard ? "YES" : "NO"}`);
    console.log(`  article card found: ${d.articleCard ? "YES" : "NO"}`);
    console.log(`  walk-up card: ${d.walkUpCard.levels} levels up, parent had ${d.walkUpCard.parentChildCount} children`);
    console.log(`  price el class: ${d.priceElClass ?? "(none)"}`);
    console.log(`  price el text: ${d.priceElText ?? "(none)"}`);
    console.log(`  walk-up card text: ${d.walkUpCard.text.replace(/\s+/g, " ").trim().substring(0, 120)}`);
    console.log(`  img: ${d.imgSrc ?? "(none)"}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
