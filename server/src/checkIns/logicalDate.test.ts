import { describe, expect, it } from 'vitest';
import { getLogicalDate } from './logicalDate.js';

describe('getLogicalDate', () => {
  const timeZone = 'America/Chicago';

  it('uses the 4:00 AM local boundary during daylight time', () => {
    expect(getLogicalDate(new Date('2026-07-15T08:59:59.999Z'), timeZone)).toBe('2026-07-14');
    expect(getLogicalDate(new Date('2026-07-15T09:00:00.000Z'), timeZone)).toBe('2026-07-15');
  });

  it('uses the 4:00 AM local boundary during standard time', () => {
    expect(getLogicalDate(new Date('2026-01-15T09:59:59.999Z'), timeZone)).toBe('2026-01-14');
    expect(getLogicalDate(new Date('2026-01-15T10:00:00.000Z'), timeZone)).toBe('2026-01-15');
  });

  it('does not roll a late Chicago evening into the next logical date', () => {
    expect(getLogicalDate(new Date('2026-09-30T03:30:00.000Z'), timeZone)).toBe('2026-09-29');
  });
});
