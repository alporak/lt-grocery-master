import cron from "node-cron";
import { runScrapeJob } from "./scrape-job.js";
import prisma from "./db.js";

async function getInterval(): Promise<number> {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: "scrapeIntervalHours" },
    });
    return setting ? parseInt(setting.value, 10) || 24 : 24;
  } catch {
    return 24;
  }
}

async function main() {
  console.log("[Scheduler] Starting scraper service...");
  let running = false;

  // Run once on startup after a short delay
  setTimeout(async () => {
    if (running) return;
    running = true;
    console.log("[Scheduler] Running initial scrape...");
    try {
      await runScrapeJob();
    } finally {
      running = false;
    }
  }, 10_000);

  // Schedule recurring runs
  // Check every hour if it's time to scrape based on the interval setting
  cron.schedule("0 * * * *", async () => {
    if (running) {
      console.log("[Scheduler] Scrape already in progress, skipping.");
      return;
    }
    try {
      const intervalHours = await getInterval();
      const stores = await prisma.store.findMany({
        where: { enabled: true },
        select: { lastScrapedAt: true },
      });

      // Check if any store needs scraping
      const now = Date.now();
      const needsScrape = stores.some((s) => {
        if (!s.lastScrapedAt) return true;
        const elapsed = now - s.lastScrapedAt.getTime();
        return elapsed >= intervalHours * 60 * 60 * 1000;
      });

      if (needsScrape) {
        running = true;
        console.log(
          `[Scheduler] Interval ${intervalHours}h elapsed, running scrape...`
        );
        try {
          await runScrapeJob();
        } finally {
          running = false;
        }
      }
    } catch (err) {
      console.error("[Scheduler] Error:", err);
      running = false;
    }
  });

  console.log("[Scheduler] Cron active. Checking every hour for scrape need.");
}

main().catch((err) => {
  console.error("[Scheduler] Fatal error:", err);
  process.exit(1);
});
