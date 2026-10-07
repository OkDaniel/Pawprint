import { describe, expect, it, vi } from 'vitest';
import type { InsightsRepository } from './insightsRepository.js';
import { InsightsService } from './insightsService.js';

// 3:30 AM on October 1 in the configured America/Chicago application timezone.
const fixedNow = () => new Date('2026-10-01T08:30:00.000Z');

describe('InsightsService Mood trend', () => {
  it('returns exactly 30 logical dates through the server current logical date', async () => {
    const repository = { dailyMood: vi.fn(async () => []) } as unknown as InsightsRepository;
    const result = await new InsightsService(repository, fixedNow).moodTrend(7);

    expect(repository.dailyMood).toHaveBeenCalledWith(7, '2026-09-01', '2026-09-30');
    expect(result.range).toEqual({ startLogicalDate: '2026-09-01', endLogicalDate: '2026-09-30', days: 30 });
    expect(result.points).toHaveLength(30);
    expect(result.points[0]?.logicalDate).toBe('2026-09-01');
    expect(result.points[29]?.logicalDate).toBe('2026-09-30');
  });

  it('calculates daily means, gaps, counts, and a Check-In-weighted overall average', async () => {
    const repository = {
      dailyMood: vi.fn(async () => [
        { logicalDate: '2026-09-01', checkInCount: 2, moodCount: 2, moodSum: 7 },
        { logicalDate: '2026-09-10', checkInCount: 1, moodCount: 0, moodSum: 0 },
        { logicalDate: '2026-09-18', checkInCount: 3, moodCount: 3, moodSum: 10 },
        { logicalDate: '2026-09-30', checkInCount: 1, moodCount: 1, moodSum: 5 },
      ]),
    } as unknown as InsightsRepository;
    const result = await new InsightsService(repository, fixedNow).moodTrend(7);

    expect(result.points[0]).toEqual({ logicalDate: '2026-09-01', moodMean: 3.5, checkInCount: 2 });
    expect(result.points[1]).toEqual({ logicalDate: '2026-09-02', moodMean: null, checkInCount: 0 });
    expect(result.points[9]).toEqual({ logicalDate: '2026-09-10', moodMean: null, checkInCount: 1 });
    expect(result.points[17]).toEqual({ logicalDate: '2026-09-18', moodMean: 3.3333, checkInCount: 3 });
    expect(result.summary).toEqual({ trackedDays: 4, totalCheckIns: 7, averageMood: 3.6667 });
  });

  it('returns a valid empty response without treating missing Mood as zero', async () => {
    const repository = { dailyMood: vi.fn(async () => []) } as unknown as InsightsRepository;
    const result = await new InsightsService(repository, fixedNow).moodTrend(7);

    expect(result.summary).toEqual({ trackedDays: 0, totalCheckIns: 0, averageMood: null });
    expect(result.points.every(({ moodMean, checkInCount }) => moodMean === null && checkInCount === 0)).toBe(true);
  });
});
