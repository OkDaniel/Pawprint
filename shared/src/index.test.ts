import { describe, expect, it } from 'vitest';
import { catAppearanceKeys, createCheckInRequestSchema, deriveSleepDurationMinutes, historyQuerySchema, moodTrendResponseSchema, normalizeCatAppearanceKey, onboardingCompletionRequestSchema, registerRequestSchema, symptomCategories, to24HourTime, trackingLibraryStarterSlugs, updateCheckInRequestSchema, updateCompanionRequestSchema } from './index.js';

describe('registration and companion schemas', () => {
  it('registers with credentials only and strips obsolete appearance input', () => {
    expect(registerRequestSchema.parse({ username: 'daniel', password: 'password123', catAppearance: 'mochi-grey' })).toEqual({ username: 'daniel', password: 'password123' });
  });

  it('safely normalizes legacy appearance values', () => {
    expect(normalizeCatAppearanceKey('old-or-invalid-value')).toBe('mochi-classic');
    expect(normalizeCatAppearanceKey(null)).toBe('mochi-classic');
  });

  it.each(catAppearanceKeys)('accepts supported companion appearance %s and an international name', (catAppearance) => {
    expect(updateCompanionRequestSchema.safeParse({ catAppearance, catName: 'モチ' }).success).toBe(true);
  });

  it('trims names and rejects blank, long, or unsupported companion values', () => {
    expect(updateCompanionRequestSchema.parse({ catAppearance: 'mochi-classic', catName: '  Mochi  ' }).catName).toBe('Mochi');
    expect(updateCompanionRequestSchema.safeParse({ catAppearance: 'mochi-classic', catName: ' ' }).success).toBe(false);
    expect(updateCompanionRequestSchema.safeParse({ catAppearance: 'mochi-classic', catName: 'a'.repeat(41) }).success).toBe(false);
    expect(updateCompanionRequestSchema.safeParse({ catAppearance: 'arbitrary-cat', catName: 'Mochi' }).success).toBe(false);
  });
});

describe('onboardingCompletionRequestSchema', () => {
  const valid = {
    catAppearance: 'mochi-white', catName: 'Mochi', feelingIds: [], factorIds: [],
    symptomPreferences: symptomCategories.map((category) => ({ category, ids: [] })),
  };
  it('accepts explicit empty quick-list snapshots', () => expect(onboardingCompletionRequestSchema.safeParse(valid).success).toBe(true));
  it('requires every symptom category exactly once', () => expect(onboardingCompletionRequestSchema.safeParse({ ...valid, symptomPreferences: valid.symptomPreferences.slice(1) }).success).toBe(false));
  it('rejects duplicate library IDs', () => expect(onboardingCompletionRequestSchema.safeParse({ ...valid, feelingIds: [1, 1] }).success).toBe(false));
});

describe('canonical tracking-library starters', () => {
  it('exports the repository defaults used for fresh onboarding and quick lists', () => {
    expect(trackingLibraryStarterSlugs.feelings).toEqual(['happy', 'grateful', 'calm', 'okay', 'tired', 'confused', 'anxious', 'stressed', 'overwhelmed']);
    expect(trackingLibraryStarterSlugs.symptoms).toEqual({
      'Physical Pain': ['headache', 'joint-pain', 'back-pain'],
      'Physical Other': ['fatigue', 'dizziness', 'drowsiness'],
      Mental: ['anxiety', 'irritability', 'feeling-overwhelmed'],
      Cognitive: ['brain-fog', 'forgetfulness', 'difficulty-focusing'],
    });
    expect(trackingLibraryStarterSlugs.factors).toEqual(['study', 'work', 'exercise', 'social-activity', 'stress', 'poor-sleep', 'caffeine', 'procrastination']);
  });
});

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
    [12, 0, 'AM', '00:00'], [12, 30, 'AM', '00:30'], [12, 0, 'PM', '12:00'], [1, 5, 'PM', '13:05'], [11, 59, 'PM', '23:59'],
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

describe('moodTrendResponseSchema', () => {
  const points = Array.from({ length: 30 }, (_, index) => ({
    logicalDate: new Date(Date.UTC(2026, 8, index + 1)).toISOString().slice(0, 10),
    moodMean: index === 0 ? 3.5 : null,
    checkInCount: index === 0 ? 2 : 0,
  }));
  const response = {
    range: { startLogicalDate: '2026-09-01', endLogicalDate: '2026-09-30', days: 30 },
    summary: { trackedDays: 1, totalCheckIns: 2, averageMood: 3.5 },
    points,
  };

  it('accepts a complete 30-day response with explicit missing values', () => {
    expect(moodTrendResponseSchema.safeParse(response).success).toBe(true);
  });

  it('rejects an incomplete date series or a zero Mood value', () => {
    expect(moodTrendResponseSchema.safeParse({ ...response, points: points.slice(1) }).success).toBe(false);
    expect(moodTrendResponseSchema.safeParse({ ...response, points: [{ ...points[0], moodMean: 0 }, ...points.slice(1)] }).success).toBe(false);
  });
});
