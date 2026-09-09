import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabasePool, getDatabasePool } from './pool.js';
import type { RowDataPacket } from 'mysql2';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const migrationsDirectory = path.join(root, 'database/migrations');

async function migrate(): Promise<void> {
  const pool = getDatabasePool();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);

  const [rows] = await pool.query<Array<RowDataPacket & { filename: string }>>('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.filename));
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();

  for (const filename of files) {
    if (applied.has(filename)) continue;
    const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
    const statements = sql.split('-- statement-breakpoint').map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await pool.query(statement);
    await pool.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
    console.log(`Applied ${filename}`);
  }
}

migrate().catch((error: unknown) => {
  console.error('Migration failed.', error);
  process.exitCode = 1;
}).finally(closeDatabasePool);
