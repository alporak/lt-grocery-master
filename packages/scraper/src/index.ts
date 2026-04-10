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
  let lastHandledRequest = "";

  try {
    const handled = await prisma.settings.findUnique({
      where: { key: "scrapeRequestedHandled" },
    });
    if (handled?.value) {
      lastHandledRequest = handled.value;
    }
  } catch {
    // ignore, fallback to in-memory only
  }

  // Clean up stale "running" logs from previous interrupted runs
  const staleCount = await prisma.scrapeLog.updateMany({
    where: { status: "running" },
    data: { status: "interrupted", finishedAt: new Date() },
  });
  if (staleCount.count > 0) {
    console.log(`[Scheduler] Cleaned up ${staleCount.count} stale 'running' log(s).`);
  }

  // Run on startup only if any store actually needs scraping
  setTimeout(async () => {
    if (running) return;
    try {
      const intervalHours = await getInterval();
      const stores = await prisma.store.findMany({
        where: { enabled: true },
        select: { lastScrapedAt: true },
      });

      const now = Date.now();
      const needsScrape = stores.some((s) => {
        if (!s.lastScrapedAt) return true;
        const elapsed = now - s.lastScrapedAt.getTime();
        return elapsed >= intervalHours * 60 * 60 * 1000;
      });

      if (!needsScrape) {
        console.log(
          `[Scheduler] All stores scraped within ${intervalHours}h, skipping startup scrape.`
        );
        return;
      }

      running = true;
      console.log("[Scheduler] Stores need scraping, running initial scrape...");
      try {
        await runScrapeJob();
      } finally {
        running = false;
      }
    } catch (err) {
      console.error("[Scheduler] Startup check error:", err);
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

  // Manual trigger: poll scrapeRequested every 30s
  cron.schedule("*/30 * * * * *", async () => {
    if (running) return;
    try {
      const req = await prisma.settings.findUnique({
        where: { key: "scrapeRequested" },
      });
      const requestedValue = req?.value || "";
      if (!requestedValue || requestedValue === lastHandledRequest) {
        return;
      }

      running = true;
      console.log(`[Scheduler] Manual scrape requested (${requestedValue}), running now...`);
      try {
        await runScrapeJob();
        lastHandledRequest = requestedValue;
        await prisma.settings.upsert({
          where: { key: "scrapeRequestedHandled" },
          update: { value: requestedValue },
          create: { key: "scrapeRequestedHandled", value: requestedValue },
        });
      } finally {
        running = false;
      }
    } catch (err) {
      console.error("[Scheduler] Manual scrape trigger error:", err);
      running = false;
    }
  });

  console.log("[Scheduler] Cron active. Checking every hour for scrape need.");
}

main().catch((err) => {
  console.error("[Scheduler] Fatal error:", err);
  process.exit(1);
});
