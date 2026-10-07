import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
loadDotEnv({ path: path.join(repositoryRoot, '.env') });

const emptyStringToUndefined = (value: unknown) => value === '' ? undefined : value;

function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_PORT: z.coerce.number().int().positive().max(65535).default(3001),
  APP_BASE_PATH: z.string().default('/'),
  APP_TIME_ZONE: z.string().refine(isIanaTimeZone, 'APP_TIME_ZONE must be a valid IANA timezone.').default('America/Chicago'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().max(65535).default(3306),
  DB_SOCKET: z.preprocess(emptyStringToUndefined, z.string().optional()),
  DB_USER: z.string().min(1).default('capstone_user'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1).default('capstone'),
  SESSION_SECRET: z.string().default('development-only-change-me'),
  DEMO_USER_PASSWORD: z.string().min(8).max(128).default('pawprint-demo-only'),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && value.SESSION_SECRET.length < 32) {
    context.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'Production session secrets must be at least 32 characters.' });
  }
});

export function parseEnvironment(input: NodeJS.ProcessEnv) {
  return envSchema.parse(input);
}

export const env = parseEnvironment(process.env);
