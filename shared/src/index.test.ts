import { describe, expect, it } from 'vitest';
import { createCheckInRequestSchema } from './index.js';

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
});
