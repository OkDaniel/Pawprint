import mysql, { type Pool, type PoolOptions } from 'mysql2/promise';
import { env } from '../config/env.js';

let pool: Pool | undefined;

export function databaseConnectionOptions(): PoolOptions {
  const transport = env.DB_SOCKET
    ? { socketPath: env.DB_SOCKET }
    : { host: env.DB_HOST, port: env.DB_PORT };

  return {
    ...transport,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: 10,
    timezone: 'Z',
  };
}

export function getDatabasePool(): Pool {
  pool ??= mysql.createPool(databaseConnectionOptions());
  return pool;
}

export async function checkDatabaseConnection(): Promise<void> {
  await getDatabasePool().query('SELECT 1');
}

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
