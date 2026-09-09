import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabasePool, getDatabasePool } from './pool.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');

async function seed(): Promise<void> {
  const directory = path.join(root, 'database/seeds');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  for (const filename of files) {
    await getDatabasePool().query(await readFile(path.join(directory, filename), 'utf8'));
    console.log(`Seeded ${filename}`);
  }
}

seed().catch((error: unknown) => {
  console.error('Seed failed. Run npm run db:migrate first.', error);
  process.exitCode = 1;
}).finally(closeDatabasePool);
