import { describe, expect, it } from 'vitest';
import type { MoodTrendPoint } from '@capstone/shared';
import { buildMoodLineSegments } from './moodTrendChartModel';

describe('buildMoodLineSegments', () => {
  it('does not connect tracked points across a missing day', () => {
    const points: MoodTrendPoint[] = [
      { logicalDate: '2026-09-01', moodMean: 3, checkInCount: 1 },
      { logicalDate: '2026-09-02', moodMean: 4, checkInCount: 1 },
      { logicalDate: '2026-09-03', moodMean: null, checkInCount: 0 },
      { logicalDate: '2026-09-04', moodMean: 2, checkInCount: 1 },
    ];

    expect(buildMoodLineSegments(points).map((segment) => segment.map(({ point }) => point.logicalDate))).toEqual([
      ['2026-09-01', '2026-09-02'],
      ['2026-09-04'],
    ]);
  });
});
