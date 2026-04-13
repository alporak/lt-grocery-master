'use strict';
// Runs at container startup to apply schema migrations to an existing database.
// Uses the Prisma client (already present in the runner image) so no external
// sqlite3 binary is required.

const { PrismaClient } = require('@prisma/client');

async function run() {
  const prisma = new PrismaClient();

  // Returns true when the column already exists in the table.
  async function colExists(table, col) {
    const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
    return rows.some(r => r.name === col);
  }

  async function addCol(table, col, def) {
    if (!(await colExists(table, col))) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${def}`);
        console.log(`  + ${table}.${col}`);
      } catch (e) {
        console.error(`  ! failed to add ${table}.${col}: ${e.message}`);
      }
    }
  }

  try {
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
        await prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "${name}" ON "${tbl}"("${col}")`
        );
      } catch { /* already exists or unsupported – ignore */ }
    }

    // ProductGroup table (added after initial schema)
    await prisma.$executeRawUnsafe(`
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
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ProductGroup_canonicalCategory_idx" ON "ProductGroup"("canonicalCategory")`
      );
    } catch { /* ignore */ }

    // ScraperConfig table (added after initial schema)
    await prisma.$executeRawUnsafe(`
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
