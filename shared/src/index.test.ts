import { describe, expect, it } from 'vitest';
import { createCheckInRequestSchema, deriveSleepDurationMinutes, historyQuerySchema, to24HourTime, updateCheckInRequestSchema } from './index.js';

describe('createCheckInRequestSchema', () => {
  const parse = (value: object) => createCheckInRequestSchema.safeParse(value).success;
  it.each([1, 5])('accepts mood %i', (mood) => expect(parse({ mood })).toBe(true));
  it.each([0, 6])('rejects mood %i', (mood) => expect(parse({ mood })).toBe(false));
  it.each([0, 10])('accepts pain %i with mood', (pain) => expect(parse({ mood: 3, pain })).toBe(true));
  it.each([-1, 11])('rejects pain %i', (pain) => expect(parse({ mood: 3, pain })).toBe(false));
  it.each([0, 4])('accepts symptom severity %i with mood', (severity) => expect(parse({ mood: 3, symptoms: [{ symptomId: 1, severity }] })).toBe(true));
  it.each([-1, 5])('rejects symptom severity %i', (severity) => expect(parse({ mood: 3, symptoms: [{ symptomId: 1, severity }] })).toBe(false));
  it.each([1, 2, 3])('accepts factor intensity %i', (intensity) => expect(parse({ mood: 4, factors: [{ factorId: 1, intensity }] })).toBe(true));
  it.each([0, 4])('rejects factor intensity %i', (intensity) => expect(parse({ mood: 4, factors: [{ factorId: 1, intensity }] })).toBe(false));
  it.each([{ pain: 0 }, { symptoms: [{ symptomId: 1, severity: 0 }] }, { factors: [{ factorId: 1, intensity: 3 }] }, { feelingIds: [1] }])('rejects a check-in without mood: %j', (input) => expect(parse(input)).toBe(false));
  it('accepts mood by itself', () => expect(parse({ mood: 3 })).toBe(true));
  it('rejects feelings without mood', () => expect(parse({ feelingIds: [1] })).toBe(false));
  it('rejects duplicate IDs', () => expect(parse({ mood: 4, feelingIds: [1, 1] })).toBe(false));
  it('accepts each supported partial Sleep shape', () => {
    expect(parse({ mood: 4, sleep: { durationMinutes: 450 } })).toBe(true);
    expect(parse({ mood: 4, sleep: { qualityScore: 4 } })).toBe(true);
    expect(parse({ mood: 4, sleep: { bedtime: '23:30', wakeTime: '07:00' } })).toBe(true);
  });
  it.each([0, 1441, -1, 1.5])('rejects invalid Sleep duration %s', (durationMinutes) => {
    expect(parse({ mood: 4, sleep: { durationMinutes } })).toBe(false);
  });
  it.each([0, 6])('rejects Sleep quality %i', (qualityScore) => {
    expect(parse({ mood: 4, sleep: { qualityScore } })).toBe(false);
  });
  it('rejects invalid clock times and an empty Sleep object', () => {
    expect(parse({ mood: 4, sleep: { bedtime: '25:00' } })).toBe(false);
    expect(parse({ mood: 4, sleep: {} })).toBe(false);
  });
  it('does not accept client ownership fields as part of the parsed Sleep command', () => {
    const result = createCheckInRequestSchema.parse({ mood: 4, sleep: { durationMinutes: 450, userId: 99, logicalDate: '2020-01-01' } });
    expect(result.sleep).toEqual({ durationMinutes: 450 });
  });
});

describe('shared history and time helpers', () => {
  it.each([
    [1, 30, 'AM', '01:30'], [11, 45, 'PM', '23:45'], [12, 15, 'AM', '00:15'], [12, 15, 'PM', '12:15'],
  ] as const)('converts %i:%i %s to %s', (hour, minute, period, expected) => {
    expect(to24HourTime(hour, minute, period)).toBe(expected);
  });
  it('derives cross-midnight and same-day durations', () => {
    expect(deriveSleepDurationMinutes('23:30', '07:00')).toBe(450);
    expect(deriveSleepDurationMinutes('01:00', '08:15')).toBe(435);
  });
  it('validates date ranges and excludes Sleep from Check-In edits', () => {
    expect(historyQuerySchema.safeParse({ startDate: '2026-09-01', endDate: '2026-09-30' }).success).toBe(true);
    expect(historyQuerySchema.safeParse({ startDate: '2026-10-01', endDate: '2026-09-30' }).success).toBe(false);
    expect(updateCheckInRequestSchema.parse({ mood: 4, sleep: { qualityScore: 5 } })).not.toHaveProperty('sleep');
  });
});
