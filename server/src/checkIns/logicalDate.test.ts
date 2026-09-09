import { describe, expect, it } from 'vitest';
import { getLogicalDate } from './logicalDate.js';

describe('getLogicalDate', () => {
  it('places a time before 4:00 AM on the previous logical date', () => {
    expect(getLogicalDate(new Date('2026-09-08T03:59:59.999Z'))).toBe('2026-09-07');
  });
  it('starts the new logical date at 4:00 AM', () => {
    expect(getLogicalDate(new Date('2026-09-08T04:00:00.000Z'))).toBe('2026-09-08');
  });
});
