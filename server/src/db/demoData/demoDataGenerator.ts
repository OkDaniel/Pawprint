import { deriveSleepDurationMinutes } from '@capstone/shared';
import { getLogicalDate } from '../../checkIns/logicalDate.js';

export const DEMO_USERNAME = 'pawprint_demo';
export const DEMO_CAT_NAME = 'Mochi';
export const DEMO_CAT_APPEARANCE = 'mochi-orange' as const;
export const DEMO_HISTORY_DAYS = 45;
export const DEMO_DATA_SEED = 'pawprint-demo-v1';

export interface DemoSymptomMeasurement {
  slug: string;
  severity: number;
}

export interface DemoFactorMeasurement {
  slug: string;
  intensity: number;
}

export interface DemoCheckIn {
  logicalDate: string;
  occurredAt: Date;
  mood: number;
  feelingSlugs: string[];
  pain: number | null;
  symptoms: DemoSymptomMeasurement[];
  factors: DemoFactorMeasurement[];
}

export interface DemoSleepEntry {
  logicalDate: string;
  bedtime: string;
  wakeTime: string;
  durationMinutes: number;
  qualityScore: number | null;
}

export interface DemoDataScenario {
  seed: string;
  timeZone: string;
  startLogicalDate: string;
  endLogicalDate: string;
  checkIns: DemoCheckIn[];
  sleepEntries: DemoSleepEntry[];
}

interface GenerateDemoDataOptions {
  endLogicalDate: string;
  timeZone: string;
}

export function assertDemoDataEnvironment(nodeEnv: string): void {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to generate Pawprint demo data in production. No database writes were attempted.');
  }
}

const feelingPools = {
  high: ['happy', 'grateful', 'calm', 'content', 'excited', 'hopeful'],
  middle: ['okay', 'calm', 'tired', 'hopeful', 'content', 'uncertain'],
  low: ['anxious', 'tired', 'overwhelmed', 'stressed', 'frustrated', 'sad'],
} as const;

const symptomSlugs = [
  'headache', 'muscle-pain', 'fatigue', 'nausea',
  'anxiety', 'irritability', 'brain-fog', 'difficulty-focusing',
] as const;

const timeSlots = [
  ['07:45', '08:20', '09:05'],
  ['12:35', '14:10', '15:40'],
  ['18:15', '19:30', '21:05'],
] as const;

const bedtimePattern = ['22:35', '23:10', '23:45', '00:20', '00:55', '01:25', '23:25'] as const;
const wakePattern = ['06:15', '07:00', '07:40', '08:20', '09:10', '06:50', '08:45'] as const;
const sleepQualityPattern = [3, 4, 3, 2, 4, 3, 5, 2, 3, 4, 1] as const;
const moodPattern = [3, 4, 3, 4, 2, 3, 5, 4, 3, 2, 4, 3, 4, 1, 3, 4, 2, 5] as const;
const painPattern = [1, 2, 3, 4, 2, 5, 1, 6, 3, 8] as const;
const symptomSeverityPattern = [1, 2, 1, 3, 2, 4] as const;

export function generateDemoDataScenario({ endLogicalDate, timeZone }: GenerateDemoDataOptions): DemoDataScenario {
  assertLogicalDate(endLogicalDate);
  const startLogicalDate = addDays(endLogicalDate, -(DEMO_HISTORY_DAYS - 1));
  const random = createSeededRandom(`${DEMO_DATA_SEED}:${endLogicalDate}`);
  const checkIns: DemoCheckIn[] = [];
  const sleepEntries: DemoSleepEntry[] = [];
  let checkInSerial = 0;

  for (let dayIndex = 0; dayIndex < DEMO_HISTORY_DAYS; dayIndex += 1) {
    const logicalDate = addDays(startLogicalDate, dayIndex);

    // Six deliberately empty days leave visible gaps in 7-/30-day charts and History.
    if (dayIndex % 8 !== 3) {
      const checkInCount = 1 + (dayIndex % 5 === 0 ? 1 : 0) + (dayIndex === 12 || dayIndex === 32 ? 2 : 0);
      for (let checkInIndex = 0; checkInIndex < checkInCount; checkInIndex += 1) {
        const localTime = chooseCheckInTime(dayIndex, checkInIndex, checkInCount, random);
        const mood = chooseMood(dayIndex, checkInIndex, random);
        checkIns.push({
          logicalDate,
          occurredAt: zonedLocalDateTime(logicalDate, localTime, timeZone),
          mood,
          feelingSlugs: chooseFeelings(mood, checkInSerial, random),
          pain: choosePain(checkInSerial),
          symptoms: chooseSymptoms(dayIndex, checkInSerial),
          factors: chooseFactors(dayIndex, checkInIndex, checkInSerial),
        });
        checkInSerial += 1;
      }
    }

    // Eight missing Sleep days produce 37 daily rows across the 45-day window.
    if (dayIndex % 6 !== 2) {
      const bedtime = bedtimePattern[(dayIndex + randomIndex(random, bedtimePattern.length)) % bedtimePattern.length]!;
      const wakeTime = wakePattern[(dayIndex * 2 + randomIndex(random, wakePattern.length)) % wakePattern.length]!;
      sleepEntries.push({
        logicalDate,
        bedtime,
        wakeTime,
        durationMinutes: deriveSleepDurationMinutes(bedtime, wakeTime),
        qualityScore: dayIndex % 10 === 4 ? null : sleepQualityPattern[dayIndex % sleepQualityPattern.length]!,
      });
    }
  }

  return {
    seed: DEMO_DATA_SEED,
    timeZone,
    startLogicalDate,
    endLogicalDate,
    checkIns,
    sleepEntries,
  };
}

function chooseCheckInTime(dayIndex: number, checkInIndex: number, count: number, random: () => number): string {
  const slotIndex = count === 1 ? dayIndex % timeSlots.length : count === 2 ? [0, 2][checkInIndex]! : checkInIndex;
  const slot = timeSlots[slotIndex]!;
  return slot[(dayIndex + randomIndex(random, slot.length)) % slot.length]!;
}

function chooseMood(dayIndex: number, checkInIndex: number, random: () => number): number {
  const offset = randomIndex(random, 3);
  return moodPattern[(dayIndex * 2 + checkInIndex * 5 + offset) % moodPattern.length]!;
}

function chooseFeelings(mood: number, serial: number, random: () => number): string[] {
  if (serial % 4 === 0) return [];
  const pool = mood >= 4 ? feelingPools.high : mood <= 2 ? feelingPools.low : feelingPools.middle;
  const count = serial % 3 === 0 ? 2 : 1;
  const selected = new Set<string>();
  while (selected.size < count) selected.add(pool[randomIndex(random, pool.length)]!);
  return [...selected];
}

function choosePain(serial: number): number | null {
  if (serial % 3 === 0) return null;
  if (serial % 7 === 0) return 0;
  return painPattern[serial % painPattern.length]!;
}

function chooseSymptoms(dayIndex: number, serial: number): DemoSymptomMeasurement[] {
  if (serial % 4 === 0) return [];
  const firstIndex = (dayIndex + serial * 2) % symptomSlugs.length;
  const measurements: DemoSymptomMeasurement[] = [{
    slug: symptomSlugs[firstIndex]!,
    severity: serial % 9 === 0 ? 0 : symptomSeverityPattern[serial % symptomSeverityPattern.length]!,
  }];
  if (serial % 5 === 0) {
    measurements.push({
      slug: symptomSlugs[(firstIndex + 3) % symptomSlugs.length]!,
      severity: symptomSeverityPattern[(serial + 2) % symptomSeverityPattern.length]!,
    });
  }
  return measurements;
}

function chooseFactors(dayIndex: number, checkInIndex: number, serial: number): DemoFactorMeasurement[] {
  if (serial % 7 === 1) return [];
  const slugs: string[] = [];
  if ((dayIndex + checkInIndex) % 3 === 0) slugs.push('study');
  if ((dayIndex + checkInIndex * 2) % 4 === 0) slugs.push('work');
  if (dayIndex % 4 === 1) slugs.push('exercise');
  if (dayIndex % 5 === 2) slugs.push('social-activity');
  if (serial % 4 === 2) slugs.push('stress');
  if (dayIndex % 6 === 1) slugs.push('poor-sleep');
  if (serial % 4 === 0) slugs.push('caffeine');
  if (dayIndex % 6 === 4) slugs.push('procrastination');
  if (dayIndex % 7 === 0) slugs.push('weather');
  if (dayIndex % 8 === 6) slugs.push('good-sleep');
  return [...new Set(slugs)].map((slug, index) => ({ slug, intensity: 1 + ((serial + dayIndex + index) % 3) }));
}

function zonedLocalDateTime(logicalDate: string, localTime: string, timeZone: string): Date {
  const [year, month, day] = logicalDate.split('-').map(Number);
  const [hour, minute] = localTime.split(':').map(Number);
  const desiredAsUtc = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  let instant = desiredAsUtc;

  // Iteratively reconcile the desired wall-clock parts with the configured IANA zone.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = dateTimeParts(new Date(instant), timeZone);
    const observedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const adjustment = desiredAsUtc - observedAsUtc;
    instant += adjustment;
    if (adjustment === 0) break;
  }

  const result = new Date(instant);
  const actual = dateTimeParts(result, timeZone);
  if (actual.year !== year || actual.month !== month || actual.day !== day || actual.hour !== hour || actual.minute !== minute) {
    throw new Error(`Could not place demo timestamp ${logicalDate} ${localTime} in ${timeZone}.`);
  }
  if (getLogicalDate(result, timeZone) !== logicalDate) {
    throw new Error(`Demo timestamp ${result.toISOString()} does not belong to logical date ${logicalDate}.`);
  }
  return result;
}

function dateTimeParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute') };
}

function addDays(logicalDate: string, days: number): string {
  const [year, month, day] = logicalDate.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomIndex(random: () => number, length: number): number {
  return Math.floor(random() * length);
}

function assertLogicalDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ending logical date: ${value}`);
  }
}
