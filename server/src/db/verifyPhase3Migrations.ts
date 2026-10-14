import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { closeDatabasePool, getDatabasePool } from './pool.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const migrationsDirectory = path.join(root, 'database/migrations');
const tableNames = [
  'user_symptom_preferences', 'user_feeling_preferences', 'user_factor_preferences',
  'user_decoration_inventory', 'room_floor_placements', 'user_room_layouts',
  'coin_transactions', 'user_wallets', 'user_cat_coats', 'symptom_entries',
  'check_in_feelings', 'check_in_factors', 'check_in_moods', 'check_in_pain',
  'sleep_entries', 'check_ins', 'symptoms', 'feelings', 'factors', 'sessions', 'users',
] as const;

async function main(): Promise<void> {
  const pool = getDatabasePool();
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
  if (files.length !== 12) throw new Error(`Expected 12 migrations, found ${files.length}.`);
  const migrations = await Promise.all(files.map(async (filename) => ({
    filename,
    sql: await readFile(path.join(migrationsDirectory, filename), 'utf8'),
  })));

  const freshPrefix = 'p3f_';
  const upgradePrefix = 'p3u_';
  await cleanup(pool, freshPrefix);
  await cleanup(pool, upgradePrefix);
  try {
    for (const migration of migrations) await applyMigration(pool, freshPrefix, migration.sql);
    const freshTables = await countTables(pool, freshPrefix);
    if (freshTables !== tableNames.length) throw new Error(`Fresh install created ${freshTables}/${tableNames.length} expected tables.`);

    for (const migration of migrations.slice(0, 5)) await applyMigration(pool, upgradePrefix, migration.sql);
    const validUserId = await insertLegacyUser(pool, upgradePrefix, 'phase3_valid', 'mochi-orange');
    await applyMigration(pool, upgradePrefix, migrations[5]!.sql);
    const invalidUserId = await insertInvalidLegacyUser(pool, upgradePrefix);
    for (const migration of migrations.slice(6)) await applyMigration(pool, upgradePrefix, migration.sql);

    const [walletRows] = await pool.query<Array<RowDataPacket & { user_id: number; coin_balance: number }>>(
      `SELECT user_id, coin_balance FROM ${upgradePrefix}user_wallets ORDER BY user_id`,
    );
    if (walletRows.length !== 2 || walletRows.some(({ coin_balance }) => Number(coin_balance) !== 0)) {
      throw new Error('Upgrade wallet backfill did not create exactly two zero-balance wallets.');
    }
    const [coatRows] = await pool.query<Array<RowDataPacket & { user_id: number; coat_id: string }>>(
      `SELECT user_id, coat_id FROM ${upgradePrefix}user_cat_coats ORDER BY user_id`,
    );
    const coats = new Map(coatRows.map((row) => [Number(row.user_id), row.coat_id]));
    if (coats.get(validUserId) !== 'mochi-orange' || coats.get(invalidUserId) !== 'mochi-classic') {
      throw new Error('Owned-coat backfill did not preserve the valid coat and Classic-fallback the invalid coat.');
    }

    // Simulate a missing migration-runner record after DDL auto-commit. Every
    // Phase 3 file must be safe to inspect/reapply rather than blindly failing.
    for (const migration of migrations.slice(6)) await applyMigration(pool, upgradePrefix, migration.sql);
    if (await countRows(pool, `${upgradePrefix}user_wallets`) !== 2 || await countRows(pool, `${upgradePrefix}user_cat_coats`) !== 2) {
      throw new Error('Repeated backfills created duplicate rows.');
    }

    await verifyConstraints(pool, upgradePrefix, validUserId, invalidUserId);
    await pool.execute(`DELETE FROM ${upgradePrefix}users WHERE id = ?`, [validUserId]);
    if (await countOwnedRows(pool, upgradePrefix, validUserId) !== 0) throw new Error('Account-delete cascades left Phase 3 rows behind.');

    console.log('Phase 3 fresh-install migration verification: PASS (12/12 files).');
    console.log('Phase 3 upgrade migration verification: PASS (wallet and coat backfills, including Classic fallback).');
    console.log('Phase 3 constraint verification: PASS (request pair/unique, wallet CHECK, floor CHECK, composite ownership FK).');
    console.log('Phase 3 repetition/cascade verification: PASS.');
  } finally {
    await cleanup(pool, freshPrefix);
    await cleanup(pool, upgradePrefix);
  }
}

async function applyMigration(pool: Pool, prefix: string, sql: string): Promise<void> {
  await executeStatements(pool, transformSql(sql, prefix).split('-- statement-breakpoint'));
}

async function executeStatements(pool: Pool, statements: string[]): Promise<void> {
  for (const statement of statements.map((value) => value.trim()).filter(Boolean)) await pool.query(statement);
}

function transformSql(sql: string, prefix: string): string {
  assertPrefix(prefix);
  let transformed = sql;
  for (const table of [...tableNames].sort((left, right) => right.length - left.length)) {
    transformed = transformed.replace(new RegExp(`\\b${table}\\b`, 'g'), `${prefix}${table}`);
  }
  transformed = transformed.replace(/\bCONSTRAINT\s+IF\s+NOT\s+EXISTS\s+([A-Za-z0-9_]+)/gi, `CONSTRAINT IF NOT EXISTS ${prefix}$1`);
  transformed = transformed.replace(/\bCONSTRAINT\s+(?!IF\b)([A-Za-z0-9_]+)/gi, `CONSTRAINT ${prefix}$1`);
  return transformed;
}

async function insertLegacyUser(pool: Pool, prefix: string, username: string, appearance: string): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${prefix}users (username, password_hash, cat_appearance_key) VALUES (?, 'hash', ?)`,
    [username, appearance],
  );
  return result.insertId;
}

async function insertInvalidLegacyUser(pool: Pool, prefix: string): Promise<number> {
  await pool.query('SET SESSION check_constraint_checks = OFF');
  try {
    return await insertLegacyUser(pool, prefix, 'phase3_invalid', 'unknown-legacy-coat');
  } finally {
    await pool.query('SET SESSION check_constraint_checks = ON');
  }
}

async function verifyConstraints(pool: Pool, prefix: string, userOne: number, userTwo: number): Promise<void> {
  await expectDatabaseRejection(() => pool.execute(
    `INSERT INTO ${prefix}check_ins (user_id, occurred_at, logical_date, client_request_id) VALUES (?, NOW(), CURRENT_DATE, ?)`,
    [userOne, '11111111-1111-4111-8111-111111111111'],
  ));
  await pool.execute(
    `INSERT INTO ${prefix}check_ins (user_id, occurred_at, logical_date, client_request_id, create_request_hash)
     VALUES (?, NOW(), CURRENT_DATE, ?, UNHEX(SHA2('one', 256)))`,
    [userOne, '11111111-1111-4111-8111-111111111111'],
  );
  await expectDatabaseRejection(() => pool.execute(
    `INSERT INTO ${prefix}check_ins (user_id, occurred_at, logical_date, client_request_id, create_request_hash)
     VALUES (?, NOW(), CURRENT_DATE, ?, UNHEX(SHA2('one', 256)))`,
    [userOne, '11111111-1111-4111-8111-111111111111'],
  ));
  await expectDatabaseRejection(() => pool.execute(
    `UPDATE ${prefix}user_wallets SET coin_balance = -1 WHERE user_id = ?`, [userOne],
  ));

  const purchaseOne = await insertPurchaseLedger(pool, prefix, userOne, 'probe-one');
  const purchaseTwo = await insertPurchaseLedger(pool, prefix, userTwo, 'probe-two');
  const [inventory] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${prefix}user_decoration_inventory
       (user_id, product_id, selected_variant_id, purchase_transaction_id)
     VALUES (?, 'decor_yarn_ball', 'decor_yarn_ball_base', ?)`, [userOne, purchaseOne],
  );
  await pool.execute(`INSERT INTO ${prefix}user_room_layouts (user_id) VALUES (?), (?)`, [userOne, userTwo]);
  await expectDatabaseRejection(() => pool.execute(
    `INSERT INTO ${prefix}room_floor_placements (inventory_instance_id, user_id, grid_u, grid_v)
     VALUES (?, ?, 2, 2)`, [inventory.insertId, userTwo],
  ));
  await expectDatabaseRejection(() => pool.execute(
    `INSERT INTO ${prefix}room_floor_placements (inventory_instance_id, user_id, grid_u, grid_v)
     VALUES (?, ?, 17, 2)`, [inventory.insertId, userOne],
  ));
  void purchaseTwo;
}

async function insertPurchaseLedger(pool: Pool, prefix: string, userId: number, key: string): Promise<number> {
  const [grant] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${prefix}coin_transactions (user_id, amount, transaction_type, idempotency_key)
     VALUES (?, 1, 'DEV_GRANT', ?)`, [userId, `grant:${key}`],
  );
  void grant;
  const [purchase] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${prefix}coin_transactions (user_id, amount, transaction_type, idempotency_key, product_id)
     VALUES (?, -1, 'PURCHASE', ?, 'decor_yarn_ball')`, [userId, `purchase:${key}`],
  );
  return purchase.insertId;
}

async function expectDatabaseRejection(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error('Expected MariaDB to reject an invalid Phase 3 row.');
}

async function countTables(pool: Pool, prefix: string): Promise<number> {
  const [rows] = await pool.execute<Array<RowDataPacket & { count: number | string }>>(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE ?`, [`${prefix}%`],
  );
  return Number(rows[0]?.count ?? 0);
}

async function countRows(pool: Pool, table: string): Promise<number> {
  const [rows] = await pool.query<Array<RowDataPacket & { count: number | string }>>(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(rows[0]?.count ?? 0);
}

async function countOwnedRows(pool: Pool, prefix: string, userId: number): Promise<number> {
  const ownedTables = ['user_wallets', 'coin_transactions', 'user_cat_coats', 'user_decoration_inventory', 'user_room_layouts', 'room_floor_placements'];
  let total = 0;
  for (const table of ownedTables) {
    const [rows] = await pool.execute<Array<RowDataPacket & { count: number | string }>>(
      `SELECT COUNT(*) AS count FROM ${prefix}${table} WHERE user_id = ?`, [userId],
    );
    total += Number(rows[0]?.count ?? 0);
  }
  return total;
}

async function cleanup(pool: Pool, prefix: string): Promise<void> {
  assertPrefix(prefix);
  await pool.query('SET SESSION FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tableNames) await pool.query(`DROP TABLE IF EXISTS ${prefix}${table}`);
  } finally {
    await pool.query('SET SESSION FOREIGN_KEY_CHECKS = 1');
  }
}

function assertPrefix(prefix: string): void {
  if (prefix !== 'p3f_' && prefix !== 'p3u_') throw new Error('Unsafe disposable migration prefix.');
}

main().catch((error: unknown) => {
  console.error('Phase 3 migration verification failed.', error);
  process.exitCode = 1;
}).finally(closeDatabasePool);
