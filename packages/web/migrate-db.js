'use strict';
// Runs at container startup to apply schema migrations to an existing database.
// Uses the Prisma client (already present in the runner image) so no external
// sqlite3 binary is required.

const { PrismaClient } = require('@prisma/client');

async function run() {
  const prisma = new PrismaClient();

  // Checkpoint WAL before reading schema so colExists sees fully committed state.
  async function checkpoint() {
    try { await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* ignore */ }
  }

  // Returns true when the column already exists in the table.
  // Uses sqlite_master to read the committed schema, not WAL-buffered PRAGMA.
  async function colExists(table, col) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, table
    );
    if (!rows || rows.length === 0) return false;
    const ddl = (rows[0].sql || '').toLowerCase();
    return ddl.includes('"' + col.toLowerCase() + '"') || ddl.includes(' ' + col.toLowerCase() + ' ') || ddl.includes(' ' + col.toLowerCase() + ')');
  }

  async function addCol(table, col, def) {
    if (await colExists(table, col)) return;
    // Use $queryRawUnsafe for ALTER: Prisma 6.19+ SQLite driver throws
    // "Execute returned results, which is not allowed in SQLite" from
    // $executeRawUnsafe on ALTER TABLE even though the change applies.
    // $queryRawUnsafe tolerates both result-returning and no-result queries.
    try {
      await prisma.$queryRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${def}`);
    } catch (e) {
      // Re-check: the ALTER may have applied anyway (known Prisma quirk).
      if (!(await colExists(table, col))) {
        console.error(`  ! failed to add ${table}.${col}: ${e.message}`);
        return;
      }
    }
    try { await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* ignore */ }
    console.log(`  + ${table}.${col}`);
  }

  try {
    await checkpoint();

    // Product columns added after initial schema
    await addCol('Product', 'searchIndex',       'TEXT');
    await addCol('Product', 'barcode',            'TEXT');
    await addCol('Product', 'canonicalCategory',  'TEXT');
    await addCol('Product', 'subcategory',        'TEXT');
    await addCol('Product', 'enrichment',         'TEXT');
    await addCol('Product', 'enrichedAt',         'DATETIME');
    await addCol('Product', 'enrichmentVersion',  'INTEGER');
    await addCol('Product', 'reviewedAt',         'DATETIME');
    await addCol('Product', 'productGroupId',     'INTEGER');

    // GroceryListItem columns added after initial schema
    await addCol('GroceryListItem', 'pinnedProductGroupId', 'INTEGER');
    await addCol('GroceryListItem', 'preferredBrand',       'TEXT');
    await addCol('GroceryListItem', 'pinnedProductId',      'INTEGER');

    // Indexes
    const idxs = [
      ['Product_searchIndex_idx',       'Product', 'searchIndex'],
      ['Product_canonicalCategory_idx', 'Product', 'canonicalCategory'],
      ['Product_subcategory_idx',       'Product', 'subcategory'],
      ['Product_brand_idx',             'Product', 'brand'],
      ['Product_reviewedAt_idx',        'Product', 'reviewedAt'],
      ['Product_productGroupId_idx',    'Product', 'productGroupId'],
    ];
    for (const [name, tbl, col] of idxs) {
      try {
        await prisma.$queryRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "${name}" ON "${tbl}"("${col}")`
        );
      } catch { /* already exists or unsupported – ignore */ }
    }

    // ProductGroup table (added after initial schema)
    await prisma.$queryRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductGroup" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        nameEn TEXT,
        canonicalCategory TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try {
      await prisma.$queryRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ProductGroup_canonicalCategory_idx" ON "ProductGroup"("canonicalCategory")`
      );
    } catch { /* ignore */ }

    // ScraperConfig table (added after initial schema)
    await prisma.$queryRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ScraperConfig" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        storeName TEXT NOT NULL,
        chain TEXT NOT NULL DEFAULT 'CUSTOM',
        containerSel TEXT NOT NULL,
        nameSel TEXT NOT NULL,
        priceSel TEXT NOT NULL,
        linkSel TEXT,
        imageSel TEXT,
        categorySel TEXT,
        paginationSel TEXT,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        lastRunAt DATETIME,
        lastRunCount INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // SQLite performance settings (both return result rows → use $queryRawUnsafe)
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=15000');

    console.log('Migration complete.');
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(e => {
  // Log but don't abort startup — a migration warning is better than a dead container.
  console.error('Migration error (non-fatal):', e.message);
  process.exit(0);
});
