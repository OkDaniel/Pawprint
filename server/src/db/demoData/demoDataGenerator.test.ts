import { deriveSleepDurationMinutes } from '@capstone/shared';
import { describe, expect, it } from 'vitest';
import { getLogicalDate } from '../../checkIns/logicalDate.js';
import {
  assertDemoDataEnvironment,
  DEMO_DATA_SEED,
  DEMO_HISTORY_DAYS,
  generateDemoDataScenario,
} from './demoDataGenerator.js';

describe('development demo-data guard', () => {
  it('refuses production clearly before database work begins', () => {
    expect(() => assertDemoDataEnvironment('production')).toThrow(/Refusing.*production.*No database writes were attempted/i);
    expect(() => assertDemoDataEnvironment('development')).not.toThrow();
    expect(() => assertDemoDataEnvironment('test')).not.toThrow();
  });
});

describe('generateDemoDataScenario', () => {
  const options = { endLogicalDate: '2026-09-30', timeZone: 'America/Chicago' };

  it('is deterministic for the same ending logical date and documented seed', () => {
    const first = generateDemoDataScenario(options);
    const second = generateDemoDataScenario(options);
    expect(first).toEqual(second);
    expect(first.seed).toBe(DEMO_DATA_SEED);
    expect(first.startLogicalDate).toBe('2026-08-17');
    expect(first.endLogicalDate).toBe('2026-09-30');
  });

  it('creates a varied 45-day analytics scenario while preserving domain ranges and missingness', () => {
    const scenario = generateDemoDataScenario(options);
    const checkInDates = new Set(scenario.checkIns.map(({ logicalDate }) => logicalDate));
    const checkInsByDate = new Map<string, number>();
    for (const checkIn of scenario.checkIns) {
      checkInsByDate.set(checkIn.logicalDate, (checkInsByDate.get(checkIn.logicalDate) ?? 0) + 1);
      expect(getLogicalDate(checkIn.occurredAt, options.timeZone)).toBe(checkIn.logicalDate);
      expect(checkIn.logicalDate >= scenario.startLogicalDate && checkIn.logicalDate <= scenario.endLogicalDate).toBe(true);
      expect(checkIn.mood).toBeGreaterThanOrEqual(1);
      expect(checkIn.mood).toBeLessThanOrEqual(5);
      expect(checkIn.pain === null || (checkIn.pain >= 0 && checkIn.pain <= 10)).toBe(true);
      expect(checkIn.symptoms.every(({ severity }) => severity >= 0 && severity <= 4)).toBe(true);
      expect(checkIn.factors.every(({ intensity }) => intensity >= 1 && intensity <= 3)).toBe(true);
    }

    expect(scenario.checkIns.length).toBeGreaterThanOrEqual(45);
    expect(scenario.checkIns.length).toBeLessThanOrEqual(55);
    expect(checkInDates.size).toBeGreaterThanOrEqual(35);
    expect(checkInDates.size).toBeLessThanOrEqual(40);
    expect([...checkInsByDate.values()].some((count) => count === 2)).toBe(true);
    expect([...checkInsByDate.values()].some((count) => count === 3)).toBe(true);
    expect(scenario.checkIns.some(({ pain }) => pain === null)).toBe(true);
    expect(scenario.checkIns.some(({ pain }) => pain === 0)).toBe(true);
    expect(scenario.checkIns.some(({ pain }) => pain !== null && pain > 0)).toBe(true);
    expect(scenario.checkIns.some(({ symptoms }) => symptoms.length === 0)).toBe(true);
    expect(scenario.checkIns.some(({ symptoms }) => symptoms.some(({ severity }) => severity === 0))).toBe(true);

    const middleMoods = scenario.checkIns.filter(({ mood }) => mood === 3 || mood === 4).length;
    expect(middleMoods).toBeGreaterThan(scenario.checkIns.length / 2);
    expect(new Set(scenario.checkIns.map(({ mood }) => mood))).toEqual(new Set([1, 2, 3, 4, 5]));

    const factorFrequencies = new Map<string, number>();
    for (const { factors } of scenario.checkIns) {
      for (const { slug } of factors) factorFrequencies.set(slug, (factorFrequencies.get(slug) ?? 0) + 1);
    }
    expect([...factorFrequencies.values()].filter((count) => count >= 8).length).toBeGreaterThanOrEqual(3);
    expect(scenario.checkIns.some(({ factors }) => factors.length === 0)).toBe(true);

    expect(scenario.sleepEntries.length).toBeGreaterThanOrEqual(35);
    expect(scenario.sleepEntries.length).toBeLessThanOrEqual(40);
    expect(new Set(scenario.sleepEntries.map(({ logicalDate }) => logicalDate)).size).toBe(scenario.sleepEntries.length);
    expect(scenario.sleepEntries.some(({ qualityScore }) => qualityScore === null)).toBe(true);
    for (const sleep of scenario.sleepEntries) {
      expect(sleep.durationMinutes).toBe(deriveSleepDurationMinutes(sleep.bedtime, sleep.wakeTime));
      expect(sleep.durationMinutes).toBeGreaterThanOrEqual(1);
      expect(sleep.durationMinutes).toBeLessThanOrEqual(1440);
      expect(sleep.qualityScore === null || (sleep.qualityScore >= 1 && sleep.qualityScore <= 5)).toBe(true);
    }
    expect(DEMO_HISTORY_DAYS - checkInDates.size).toBeGreaterThan(0);
  });

  it('keeps generated timestamps on their intended logical dates across a daylight-saving transition', () => {
    const scenario = generateDemoDataScenario({ endLogicalDate: '2026-03-20', timeZone: 'America/Chicago' });
    expect(scenario.checkIns.every((checkIn) => getLogicalDate(checkIn.occurredAt, scenario.timeZone) === checkIn.logicalDate)).toBe(true);
  });
});
