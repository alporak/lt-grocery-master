import { runScrapeJob } from "./scrape-job.js";

// One-off run, optionally for a single store
const storeSlug = process.argv[2]; // e.g., --store=iki → iki

async function main() {
  const slug = storeSlug?.replace("--store=", "");
  console.log(
    slug ? `Running scrape for ${slug}...` : "Running scrape for all stores..."
  );
  await runScrapeJob(slug ? [slug] : undefined);
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
