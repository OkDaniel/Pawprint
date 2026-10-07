import { describe, expect, it } from 'vitest';
import { formatCompactSleepTime, parseTwelveHourTime } from './sleepTimeInput';

describe('formatCompactSleepTime', () => {
  it.each([
    ['130', '1:30'],
    ['1230', '12:30'],
    ['705', '7:05'],
    ['1130', '11:30'],
    ['930', '9:30'],
    ['1030', '10:30'],
    ['1:230', '12:30'],
  ])('formats compact time %s as %s', (input, expected) => {
    expect(formatCompactSleepTime(input)).toBe(expected);
  });

  it.each(['1', '12', '1:', '1:3', '1:30', '12:30', '7:05'])('leaves intermediate or colon-formatted input %s alone', (input) => {
    expect(formatCompactSleepTime(input)).toBe(input);
  });

  it.each([
    ['1360', '13:60'],
    ['1260', '12:60'],
    ['0030', '00:30'],
  ])('formats invalid compact input %s without making it valid', (input, expected) => {
    expect(formatCompactSleepTime(input)).toBe(expected);
    expect(parseTwelveHourTime(expected)).toBeNull();
  });

  it('does not rewrite deletion input', () => {
    expect(formatCompactSleepTime('130', 'deleteContentBackward')).toBe('130');
  });
});

describe('parseTwelveHourTime', () => {
  it('parses a complete manual time', () => {
    expect(parseTwelveHourTime('1:30')).toEqual({ hour: 1, minute: 30 });
  });

  it.each(['1360', '12:60', '0:30', '13:00'])('rejects invalid visible time %s', (input) => {
    expect(parseTwelveHourTime(input)).toBeNull();
  });
});
