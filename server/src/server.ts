import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabasePool } from './db/pool.js';

const app = createApp();
const server = app.listen(env.APP_PORT, '127.0.0.1', () => {
  console.log(`Capstone API listening on http://127.0.0.1:${env.APP_PORT}`);
});

async function shutDown(signal: string) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    await closeDatabasePool();
    process.exit(0);
  });
}

process.on('SIGINT', () => { void shutDown('SIGINT'); });
process.on('SIGTERM', () => { void shutDown('SIGTERM'); });

