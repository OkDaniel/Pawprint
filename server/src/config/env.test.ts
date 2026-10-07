import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './env.js';

describe('environment configuration', () => {
  it('accepts America/Chicago as the application timezone', () => {
    expect(parseEnvironment({ NODE_ENV: 'test', APP_TIME_ZONE: 'America/Chicago' }).APP_TIME_ZONE).toBe('America/Chicago');
  });

  it('rejects an invalid application timezone clearly', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'test', APP_TIME_ZONE: 'Not/A_Time_Zone' }))
      .toThrow(/APP_TIME_ZONE must be a valid IANA timezone/);
  });
});
