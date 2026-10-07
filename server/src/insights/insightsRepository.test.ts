import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { InsightsRepository } from './insightsRepository.js';

describe('InsightsRepository Mood aggregation', () => {
  it('scopes the range and aggregation to the authenticated user', async () => {
    const execute = vi.fn(async () => [[{
      logical_date: '2026-09-18', check_in_count: '3', mood_count: '3', mood_sum: '10',
    }]]);
    const repository = new InsightsRepository({ execute } as unknown as Pool);

    await expect(repository.dailyMood(27, '2026-09-01', '2026-09-30')).resolves.toEqual([{
      logicalDate: '2026-09-18', checkInCount: 3, moodCount: 3, moodSum: 10,
    }]);
    expect(execute).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE ci\.user_id = \?.*ci\.logical_date >= \?.*ci\.logical_date <= \?/s),
      [27, '2026-09-01', '2026-09-30'],
    );
  });
});
