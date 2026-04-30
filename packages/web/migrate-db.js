'use strict';
// Runs at container startup to apply schema migrations to an existing database.
// Uses the sqlite3 CLI (installed via apk in the runner image) for reliable,
// synchronous DDL execution — avoids Prisma async/WAL quirks with ALTER TABLE.

const { execSync } = require('child_process');

const DB = (process.env.DATABASE_URL || '').replace(/^file:/, '');
if (!DB) { console.error('DATABASE_URL not set'); process.exit(0); }

function run(sql) {
  execSync(`sqlite3 "${DB}"`, { input: sql + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function query(sql) {
  return execSync(`sqlite3 "${DB}" ${JSON.stringify(sql)}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function colExists(table, col) {
  try {
    const ddl = query(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`).toLowerCase();
    return ddl.includes('"' + col.toLowerCase() + '"');
  } catch { return false; }
}

function tableExists(name) {
  return query(`SELECT count(*) FROM sqlite_master WHERE type='table' AND name='${name}'`) === '1';
}

function addCol(table, col, def) {
  if (colExists(table, col)) return;
  run(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${def};`);
  if (!colExists(table, col)) {
    console.error(`  ! failed to add ${table}.${col}`);
    return;
  }
  console.log(`  + ${table}.${col}`);
}

try {
  // Auth tables (next-auth Prisma adapter — created after initial schema)
  if (!tableExists('User')) {
    run(`
      CREATE TABLE "User" (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        email TEXT UNIQUE,
        emailVerified DATETIME,
        image TEXT
      );
    `);
    console.log('  + User table');
  }
  if (!tableExists('Account')) {
    run(`
      CREATE TABLE "Account" (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        providerAccountId TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at INTEGER,
        token_type TEXT,
        scope TEXT,
        id_token TEXT,
        session_state TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
    `);
    console.log('  + Account table');
  }
  if (!tableExists('Session')) {
    run(`
      CREATE TABLE "Session" (
        id TEXT PRIMARY KEY NOT NULL,
        sessionToken TEXT NOT NULL UNIQUE,
        userId TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        expires DATETIME NOT NULL
      );
    `);
    console.log('  + Session table');
  }
  if (!tableExists('VerificationToken')) {
    run(`
      CREATE TABLE "VerificationToken" (
        identifier TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires DATETIME NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
    `);
    console.log('  + VerificationToken table');
  }

  // Product columns added after initial schema
  addCol('Product', 'searchIndex',       'TEXT');
  addCol('Product', 'barcode',           'TEXT');
  addCol('Product', 'canonicalCategory', 'TEXT');
  addCol('Product', 'subcategory',       'TEXT');
  addCol('Product', 'enrichment',        'TEXT');
  addCol('Product', 'enrichedAt',        'DATETIME');
  addCol('Product', 'enrichmentVersion', 'INTEGER');
  addCol('Product', 'reviewedAt',        'DATETIME');
  addCol('Product', 'productGroupId',    'INTEGER');

  // GroceryListItem columns added after initial schema
  addCol('GroceryListItem', 'pinnedProductGroupId', 'INTEGER');
  addCol('GroceryListItem', 'preferredBrand',       'TEXT');
  addCol('GroceryListItem', 'pinnedProductId',      'INTEGER');

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
    try { run(`CREATE INDEX IF NOT EXISTS "${name}" ON "${tbl}"("${col}");`); } catch { /* ignore */ }
  }

  // ProductGroup table (added after initial schema)
  if (!tableExists('ProductGroup')) {
    run(`
      CREATE TABLE "ProductGroup" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        nameEn TEXT,
        canonicalCategory TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "ProductGroup_canonicalCategory_idx" ON "ProductGroup"("canonicalCategory");
    `);
  }

  // ScraperConfig table (added after initial schema)
  if (!tableExists('ScraperConfig')) {
    run(`
      CREATE TABLE "ScraperConfig" (
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
      );
    `);
  }

  // WAL mode + busy timeout
  run('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=15000;');

  console.log('Migration complete.');
} catch (e) {
  console.error('Migration error (non-fatal):', e.message);
  process.exit(0);
}
