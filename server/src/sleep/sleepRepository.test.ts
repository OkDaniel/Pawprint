import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { SleepRepository } from './sleepRepository.js';

describe('SleepRepository ownership and mapping', () => {
  it('scopes current Sleep to the authenticated user and logical date', async () => {
    const execute = vi.fn(async () => [[{
      id: 8, logical_date: '2026-09-15', bedtime: '23:30:00', wake_time: '07:00:00', duration_minutes: 420, quality_score: 4,
    }]]);
    const sleep = await new SleepRepository({ execute } as unknown as Pool).findForDate(27, '2026-09-15');
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ? AND logical_date = ?'), [27, '2026-09-15']);
    expect(sleep).toEqual({ id: 8, logicalDate: '2026-09-15', bedtime: '23:30', wakeTime: '07:00', durationMinutes: 420, qualityScore: 4 });
  });

  it('lists only the authenticated user’s Sleep records', async () => {
    const execute = vi.fn(async () => [[]]);
    await new SleepRepository({ execute } as unknown as Pool).list(42);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ?'), [42]);
  });

  it('updates the existing owned day without inserting a duplicate', async () => {
    const execute = vi.fn(async () => [{ affectedRows: 1 }]);
    const updated = await new SleepRepository({ execute } as unknown as Pool).updateForDate(42, '2026-09-15', { bedtime: '00:50', wakeTime: '09:50', durationMinutes: 360, qualityScore: 3 });
    expect(updated).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.stringMatching(/^UPDATE sleep_entries/), ['00:50', '09:50', 360, 3, 42, '2026-09-15']);
    expect(String(execute.mock.calls[0]?.[0])).not.toContain('INSERT');
  });

  it('cannot update another user’s day because both ownership keys are in the WHERE clause', async () => {
    const execute = vi.fn(async () => [{ affectedRows: 0 }]);
    const updated = await new SleepRepository({ execute } as unknown as Pool).updateForDate(7, '2026-09-15', { qualityScore: 5 });
    expect(updated).toBe(false);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ? AND logical_date = ?'), [null, null, null, 5, 7, '2026-09-15']);
  });
});
