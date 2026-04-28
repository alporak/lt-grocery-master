// One-shot migration: canonicalise Barbora product externalIds to bare numeric.
//
// The old scraper used the full URL slug (e.g. "pienas-product-name-123456") as
// externalId. The new scraper extracts the trailing 4+ digit run ("123456") for
// a stable key. Without this migration, every run after the code update would
// insert a NEW row beside the old slug-keyed survivor (upsert key miss).
//
//   docker compose exec scraper npx tsx src/migrate-barbora-externalid.ts
//
// Safe to re-run: rows already bare-numeric are left as-is.
import prisma from "./db.js";

type Row = { id: number; externalId: string; enrichment: string | null };

function targetId(externalId: string): string | null {
  // Only rewrite slug-format IDs that end in a 4+ digit run (e.g. "slug-name-123456")
  if (/^\d+$/.test(externalId)) return null; // already bare numeric — skip
  const m = externalId.match(/(\d{4,})$/);
  return m ? m[1] : null;
}

function pickSurvivor(group: Row[]): { survivor: Row; others: Row[] } {
  const sorted = [...group].sort((a, b) => a.id - b.id);
  const enriched = sorted.find((r) => r.enrichment !== null);
  const survivor = enriched ?? sorted[0];
  return { survivor, others: sorted.filter((r) => r.id !== survivor.id) };
}

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: "barbora" } });
  if (!store) {
    console.error("No store with slug 'barbora' found.");
    process.exit(1);
  }
  const storeId = store.id;

  const rows: Row[] = await prisma.product.findMany({
    where: { storeId },
    select: { id: true, externalId: true, enrichment: true },
  });

  // Group all rows by target bare-numeric ID.
  // Rows whose externalId has no 4+ digit suffix are left untouched.
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

  // Also include any existing bare-numeric rows so we merge slug+numeric dupes.
  // Re-scan: rows already bare-numeric with value matching some target.
  for (const r of rows) {
    if (!/^\d+$/.test(r.externalId)) continue;
    const existing = byTarget.get(r.externalId);
    if (existing) {
      if (!existing.find((e) => e.id === r.id)) existing.push(r);
    }
    // If no slug rows map to this numeric id, leave it alone (skipped above).
  }

  let merged = 0;
  let renamed = 0;
  let unchanged = 0;

  for (const [target, group] of byTarget) {
    const { survivor, others } = pickSurvivor(group);

    if (others.length > 0) {
      const dupeIds = others.map((r) => r.id);
      await prisma.priceRecord.updateMany({
        where: { productId: { in: dupeIds } },
        data: { productId: survivor.id },
      });
      await prisma.product.deleteMany({ where: { id: { in: dupeIds } } });
      merged += dupeIds.length;
    }

    if (survivor.externalId !== target) {
      try {
        await prisma.product.update({
          where: { id: survivor.id },
          data: { externalId: target },
        });
        renamed++;
      } catch (err) {
        console.warn(`[Migrate] Rename failed for id ${survivor.id} → ${target}:`, err);
      }
    } else {
      unchanged++;
    }
  }

  console.log(JSON.stringify({
    store: { id: storeId, slug: store.slug },
    rowsScanned: rows.length,
    skippedNoNumericSuffix: skipped,
    groupsProcessed: byTarget.size,
    rowsMerged: merged,
    survivorRenamed: renamed,
    alreadyCanonical: unchanged,
  }, null, 2));
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
