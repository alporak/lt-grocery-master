// Diagnostic: snapshot RIMI externalId state to decide fix branch for the
// "thousands of new products every run" symptom.
//
// Read-only. Run against the live SQLite DB:
//   docker compose exec scraper npx tsx src/diagnose-rimi.ts
//
// Interpretation:
//   - bucket.bareNum === distinct and numericSuffixDupGroups === 0
//     → Upsert working; "new count" is genuine churn or UI terminology.
//   - bucket.ltPrefix > 0 || bucket.slugLike > 0 || numericSuffixDupGroups > 0
//     → Legacy RIMI rows have non-bare-numeric externalIds that don't match
//       what the current scraper emits, so every run CREATEs duplicates.
//       Run migrate-rimi-externalid.ts.
//   - collisions > 0 (on exact externalId)
//     → Unique constraint drifted; reapply prisma schema.
import prisma from "./db.js";

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: "rimi" } });
  if (!store) {
    console.error("No store with slug 'rimi' found.");
    process.exit(1);
  }

  const total = await prisma.product.count({ where: { storeId: store.id } });

  const grouped = await prisma.product.groupBy({
    by: ["externalId"],
    where: { storeId: store.id },
    _count: { _all: true },
  });
  const distinct = grouped.length;
  const collisions = grouped.filter((g) => g._count._all > 1).length;

  const bucket = { bareNum: 0, ltPrefix: 0, slugLike: 0, other: 0 };
  for (const g of grouped) {
    const id = g.externalId;
    if (/^\d+$/.test(id)) bucket.bareNum++;
    else if (/^LT-\d+$/i.test(id)) bucket.ltPrefix++;
    else if (/^[a-z0-9-]+$/i.test(id) && isNaN(Number(id))) bucket.slugLike++;
    else bucket.other++;
  }

  // Pass-2-style: products whose externalIds share the same 4+ digit numeric
  // suffix. These are candidates to be merged by the existing dedup pass.
  const suffixGroups = new Map<string, string[]>();
  for (const g of grouped) {
    const m = g.externalId.match(/(\d{4,})$/);
    if (!m) continue;
    const arr = suffixGroups.get(m[1]) ?? [];
    arr.push(g.externalId);
    suffixGroups.set(m[1], arr);
  }
  const dupSuffixGroups = [...suffixGroups.values()].filter((v) => v.length > 1);

  // Sample a few non-bare-numeric IDs to eyeball format
  const samples = grouped
    .filter((g) => !/^\d+$/.test(g.externalId))
    .slice(0, 10)
    .map((g) => g.externalId);

  console.log(JSON.stringify(
    {
      store: { id: store.id, slug: store.slug, name: store.name },
      total,
      distinct,
      collisionsOnExactId: collisions,
      formatBucket: bucket,
      numericSuffixDupGroups: dupSuffixGroups.length,
      numericSuffixDupSample: dupSuffixGroups.slice(0, 5),
      nonNumericSample: samples,
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
