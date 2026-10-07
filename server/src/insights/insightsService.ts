import type { MoodTrendResponse } from '@capstone/shared';
import { getLogicalDate } from '../checkIns/logicalDate.js';
import { InsightsRepository } from './insightsRepository.js';

export const MOOD_TREND_DAYS = 30;

export class InsightsService {
  constructor(
    private readonly repository = new InsightsRepository(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async moodTrend(userId: number): Promise<MoodTrendResponse> {
    const endLogicalDate = getLogicalDate(this.now());
    const startLogicalDate = addLogicalDays(endLogicalDate, -(MOOD_TREND_DAYS - 1));
    const aggregates = await this.repository.dailyMood(userId, startLogicalDate, endLogicalDate);
    const byDate = new Map(aggregates.map((aggregate) => [aggregate.logicalDate, aggregate]));

    let totalCheckIns = 0;
    let totalMoodCount = 0;
    let totalMoodSum = 0;
    let trackedDays = 0;

    const points = Array.from({ length: MOOD_TREND_DAYS }, (_, index) => {
      const logicalDate = addLogicalDays(startLogicalDate, index);
      const aggregate = byDate.get(logicalDate);
      const checkInCount = aggregate?.checkInCount ?? 0;
      const moodCount = aggregate?.moodCount ?? 0;
      const moodSum = aggregate?.moodSum ?? 0;
      if (checkInCount > 0) trackedDays += 1;
      totalCheckIns += checkInCount;
      totalMoodCount += moodCount;
      totalMoodSum += moodSum;
      return {
        logicalDate,
        moodMean: moodCount === 0 ? null : roundMood(moodSum / moodCount),
        checkInCount,
      };
    });

    return {
      range: { startLogicalDate, endLogicalDate, days: MOOD_TREND_DAYS },
      summary: {
        trackedDays,
        totalCheckIns,
        averageMood: totalMoodCount === 0 ? null : roundMood(totalMoodSum / totalMoodCount),
      },
      points,
    };
  }
}

export function addLogicalDays(logicalDate: string, days: number): string {
  const date = new Date(`${logicalDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function roundMood(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
