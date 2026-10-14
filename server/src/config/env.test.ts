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

  it('requires an immutable UTC reward activation instant and defaults dev grants off', () => {
    expect(parseEnvironment({ NODE_ENV: 'test' }).ENABLE_DEV_COIN_GRANTS).toBe(false);
    expect(parseEnvironment({ NODE_ENV: 'test', ECONOMY_REWARDS_START_AT: '2026-10-07T12:00:00Z' }).ECONOMY_REWARDS_START_AT)
      .toBe('2026-10-07T12:00:00Z');
    expect(() => parseEnvironment({ NODE_ENV: 'test', ECONOMY_REWARDS_START_AT: 'October 7' })).toThrow(/ISO-8601 UTC instant/);
  });
});
