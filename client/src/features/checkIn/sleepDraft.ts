import { deriveSleepDurationMinutes, type SleepInput } from '@capstone/shared';

export function buildSleepInput(qualityScore: number | null, bedtime: string, wakeTime: string): SleepInput | undefined {
  const durationMinutes = bedtime && wakeTime ? deriveSleepDurationMinutes(bedtime, wakeTime) : null;
  if (qualityScore === null && bedtime === '' && wakeTime === '') return undefined;
  return { durationMinutes, qualityScore, bedtime: bedtime || null, wakeTime: wakeTime || null };
}
