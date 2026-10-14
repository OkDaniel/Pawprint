import { EconomyService } from '../economy/economyService.js';
import { closeDatabasePool } from './pool.js';

async function main(): Promise<void> {
  const [userIdText, start, end, confirmation] = process.argv.slice(2);
  const userId = Number(userIdText);
  if (!Number.isSafeInteger(userId) || userId < 1 || !start || !end || confirmation !== '--confirm') {
    throw new Error('Usage: npm run db:repair-rewards -- <user-id> <YYYY-MM-DD> <YYYY-MM-DD> --confirm');
  }
  const result = await new EconomyService().repairRewardRange(userId, start, end);
  console.log(`Inspected ${result.inspectedDates.length} bounded post-launch logical dates for user ${userId}.`);
  console.log(`Rewards granted: ${result.rewardsGranted}.`);
}

main().catch((error: unknown) => {
  console.error('Economy reward repair failed.', error);
  process.exitCode = 1;
}).finally(closeDatabasePool);
