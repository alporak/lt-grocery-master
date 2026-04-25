// One-shot idempotent migration: normalise every RIMI product's externalId to
// a bare numeric (the last 4+ digit run). Historical runs emitted mixed
// formats ("LT-12345", slugs, etc.); the scraper now always emits bare
// numeric IDs. Without this migration, every repeat run CREATEs a new row
// against the legacy one, inflating the "new products" counter.
//
//   docker compose exec scraper npx tsx src/migrate-rimi-externalid.ts
//
// Safe to re-run: rows already bare-numeric are left alone.
import prisma from "./db.js";

type Row = {
  id: number;
  externalId: string;
  enrichment: string | null;
};

function targetId(externalId: string): string | null {
  const m = externalId.match(/(\d{4,})(?!.*\d{4,})/); // last 4+ digit run
  return m ? m[1] : null;
}

function pickSurvivor(group: Row[]): { survivor: Row; others: Row[] } {
  const sorted = [...group].sort((a, b) => a.id - b.id);
  const enriched = sorted.find((r) => r.enrichment !== null);
  const survivor = enriched ?? sorted[0];
  return { survivor, others: sorted.filter((r) => r.id !== survivor.id) };
}

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: "rimi" } });
  if (!store) {
    console.error("No store with slug 'rimi' found.");
    process.exit(1);
  }
  const storeId = store.id;

  const rows: Row[] = await prisma.product.findMany({
    where: { storeId },
    select: { id: true, externalId: true, enrichment: true },
  });

  // Group every row (bare or not) by its target bare-numeric id.
  // Rows whose externalId has no 4+ digit run are skipped with a warning.
  const byTarget = new Map<string, Row[]>();
  let skipped = 0;
  for (const r of rows) {
    const target = targetId(r.externalId);
    if (!target) {
      skipped++;
      continue;
    }
    const arr = byTarget.get(target) ?? [];
    arr.push(r);
    byTarget.set(target, arr);
  }

  let merged = 0;
  let renamed = 0;
  let unchanged = 0;

  for (const [target, group] of byTarget) {
    const { survivor, others } = pickSurvivor(group);

    // Merge duplicates into the survivor
    if (others.length > 0) {
      const dupeIds = others.map((r) => r.id);
      await prisma.priceRecord.updateMany({
        where: { productId: { in: dupeIds } },
        data: { productId: survivor.id },
      });
      await prisma.product.deleteMany({ where: { id: { in: dupeIds } } });
      merged += dupeIds.length;
    }

    // Rename the survivor if its externalId isn't already the target
    if (survivor.externalId !== target) {
      await prisma.product.update({
        where: { id: survivor.id },
        data: { externalId: target },
      });
      renamed++;
    } else {
      unchanged++;
    }
  }

  console.log(JSON.stringify(
    {
      store: { id: storeId, slug: store.slug },
      rowsScanned: rows.length,
      skippedNoNumericSuffix: skipped,
      groupsProcessed: byTarget.size,
      rowsMerged: merged,
      survivorRenamed: renamed,
      alreadyCanonical: unchanged,
    },
    null,
    2,
  ));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
