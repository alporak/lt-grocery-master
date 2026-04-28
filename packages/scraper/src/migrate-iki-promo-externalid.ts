// One-shot migration: canonicalise IKI and PROMO Cash&Carry product externalIds
// to bare numeric.
//
// The old scraper used the full URL slug as fallback externalId when a product
// URL had no trailing numeric segment. The new scraper skips products without a
// stable numeric ID. For products that DO have a numeric suffix, the new scraper
// emits just that number — so existing slug-keyed DB rows must be renamed to
// match, otherwise every run inserts duplicates.
//
//   docker compose exec scraper npx tsx src/migrate-iki-promo-externalid.ts
//
// Safe to re-run: rows already bare-numeric are left as-is.
import prisma from "./db.js";

type Row = { id: number; externalId: string; enrichment: string | null };

function targetId(externalId: string): string | null {
  if (/^\d+$/.test(externalId)) return null; // already bare numeric — skip
  const m = externalId.match(/-(\d{4,})$/);
  return m ? m[1] : null;
}

function pickSurvivor(group: Row[]): { survivor: Row; others: Row[] } {
  const sorted = [...group].sort((a, b) => a.id - b.id);
  const enriched = sorted.find((r) => r.enrichment !== null);
  const survivor = enriched ?? sorted[0];
  return { survivor, others: sorted.filter((r) => r.id !== survivor.id) };
}

async function migrateStore(storeSlug: string) {
  const store = await prisma.store.findFirst({ where: { slug: storeSlug } });
  if (!store) {
    console.warn(`No store with slug '${storeSlug}' — skipping.`);
    return;
  }
  const storeId = store.id;

  const rows: Row[] = await prisma.product.findMany({
    where: { storeId },
    select: { id: true, externalId: true, enrichment: true },
  });

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

  // Include existing bare-numeric rows that match a target so slug+numeric dupes merge
  for (const r of rows) {
    if (!/^\d+$/.test(r.externalId)) continue;
    const existing = byTarget.get(r.externalId);
    if (existing && !existing.find((e) => e.id === r.id)) existing.push(r);
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

async function main() {
  await migrateStore("iki");
  await migrateStore("promo-cash-and-carry");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
