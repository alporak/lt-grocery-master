import cron from "node-cron";
import { runScrapeJob, syncDataRepo } from "./scrape-job.js";
import prisma from "./db.js";
import * as http from "http";

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

async function isScheduledScrapeEnabled(): Promise<boolean> {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: "scheduledScrapeEnabled" },
    });
    if (!setting) return false;
    const v = setting.value.replace(/^"|"$/g, "");
    return v === "true";
  } catch {
    return false;
  }
}

async function main() {
  console.log("[Scheduler] Starting scraper service...");

  const healthServer = http.createServer((_req, res) => {
    if (_req.method === "GET" && (_req.url === "/health" || _req.url === "/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  healthServer.listen(9000, "0.0.0.0", () => {
    console.log("[Health] Scraper health server listening on :9000");
  });
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

  // Schedule recurring runs
  // Check every hour if it's time to scrape based on the interval setting
  cron.schedule("0 * * * *", async () => {
    if (running) {
      console.log("[Scheduler] Scrape already in progress, skipping.");
      return;
    }
    try {
      const enabled = await isScheduledScrapeEnabled();
      if (!enabled) {
        console.log("[Scheduler] Scheduled scraping disabled, skipping.");
        return;
      }

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
        // Check if specific stores were requested
        let storeSlugs: string[] | undefined;
        try {
          const storesSetting = await prisma.settings.findUnique({ where: { key: "scrapeRequestedStores" } });
          if (storesSetting?.value) {
            const parsed = JSON.parse(storesSetting.value);
            if (Array.isArray(parsed) && parsed.length > 0) storeSlugs = parsed;
          }
        } catch { /* ignore */ }
        await runScrapeJob(storeSlugs);
        lastHandledRequest = requestedValue;
        await prisma.settings.upsert({
          where: { key: "scrapeRequestedHandled" },
          update: { value: requestedValue },
          create: { key: "scrapeRequestedHandled", value: requestedValue },
        });
      } catch (err) {
        // Mark pipeline as errored so the UI knows
        try {
          const existing = await prisma.settings.findUnique({ where: { key: "pipelineState" } });
          const state = existing?.value ? JSON.parse(existing.value) : {};
          state.status = "error";
          state.error = err instanceof Error ? err.message : String(err);
          state.finishedAt = new Date().toISOString();
          state.updatedAt = new Date().toISOString();
          await prisma.settings.upsert({
            where: { key: "pipelineState" },
            update: { value: JSON.stringify(state) },
            create: { key: "pipelineState", value: JSON.stringify(state) },
          });
        } catch { /* best-effort */ }
        throw err;
      } finally {
        running = false;
      }
    } catch (err) {
      console.error("[Scheduler] Manual scrape trigger error:", err);
      running = false;
    }
  });

  // Data-sync trigger: poll dataSyncRequested every 30s (set by web after enrichment)
  let lastHandledSync = "";
  cron.schedule("*/30 * * * * *", async () => {
    if (running) return;
    try {
      const req = await prisma.settings.findUnique({ where: { key: "dataSyncRequested" } });
      const val = req?.value || "";
      if (!val || val === lastHandledSync) return;
      lastHandledSync = val;
      await prisma.settings.upsert({
        where: { key: "dataSyncRequested" },
        update: { value: "" },
        create: { key: "dataSyncRequested", value: "" },
      });
      console.log(`[Scheduler] Data sync requested (${val}), syncing repo...`);
      await syncDataRepo("enrich");
    } catch (err) {
      console.error("[Scheduler] Data sync trigger error:", err);
    }
  });

  console.log("[Scheduler] Cron active. Checking every hour for scrape need.");
}

main().catch((err) => {
  console.error("[Scheduler] Fatal error:", err);
  process.exit(1);
});
