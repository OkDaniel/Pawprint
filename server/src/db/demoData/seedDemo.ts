import { hash } from 'bcryptjs';
import { env } from '../../config/env.js';
import { getLogicalDate } from '../../checkIns/logicalDate.js';
import { closeDatabasePool, getDatabasePool } from '../pool.js';
import { assertDemoDataEnvironment, DEMO_DATA_SEED, DEMO_USERNAME, generateDemoDataScenario } from './demoDataGenerator.js';
import { seedDemoData } from './demoDataRepository.js';

async function main(): Promise<void> {
  assertDemoDataEnvironment(env.NODE_ENV);
  const endLogicalDate = getLogicalDate(new Date(), env.APP_TIME_ZONE);
  const scenario = generateDemoDataScenario({ endLogicalDate, timeZone: env.APP_TIME_ZONE });
  const passwordHash = await hash(env.DEMO_USER_PASSWORD, 12);
  const summary = await seedDemoData(getDatabasePool(), scenario, passwordHash);

  console.log('\nPawprint demo data created\n');
  console.log(`User: ${DEMO_USERNAME}`);
  console.log(process.env.DEMO_USER_PASSWORD
    ? 'Password: use the value of DEMO_USER_PASSWORD from your local environment'
    : `Password: ${env.DEMO_USER_PASSWORD} (development default; override with DEMO_USER_PASSWORD)`);
  console.log(`Logical range: ${summary.startLogicalDate} -> ${summary.endLogicalDate}`);
  console.log(`Deterministic pattern: ${DEMO_DATA_SEED} (${env.APP_TIME_ZONE})`);
  console.log(`Days represented: ${summary.daysRepresented} / ${summary.totalDays}`);
  console.log(`Check-Ins: ${summary.checkIns}`);
  console.log(`Sleep entries: ${summary.sleepEntries}`);
  console.log(`Mood rows: ${summary.moodRows}`);
  console.log(`Pain rows: ${summary.painRows}`);
  console.log(`Symptom entries: ${summary.symptomEntries}`);
  console.log(`Feeling links: ${summary.feelingLinks}`);
  console.log(`Factor links: ${summary.factorLinks}`);
  console.log(`Multiple-Check-In days: ${summary.multipleCheckInDays}`);
  console.log(`Non-demo users verified unchanged: ${summary.protectedUsersVerified}`);
  if (summary.okidanielCounts) {
    console.log(`okidaniel owned-data counts unchanged: ${JSON.stringify(summary.okidanielCounts.before)}`);
  } else {
    console.log('okidaniel was not present; all existing non-demo users were still verified unchanged.');
  }
}

main().catch((error: unknown) => {
  console.error('Demo-data generation failed.', error);
  process.exitCode = 1;
}).finally(closeDatabasePool);
