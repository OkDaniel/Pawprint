import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../db/pool.js';

interface MoodAggregateRow extends RowDataPacket {
  logical_date: Date | string;
  check_in_count: number | string;
  mood_count: number | string;
  mood_sum: number | string | null;
}

export interface DailyMoodAggregate {
  logicalDate: string;
  checkInCount: number;
  moodCount: number;
  moodSum: number;
}

export class InsightsRepository {
  constructor(private readonly pool: Pool = getDatabasePool()) {}

  async dailyMood(
    userId: number,
    startLogicalDate: string,
    endLogicalDate: string,
  ): Promise<DailyMoodAggregate[]> {
    const [rows] = await this.pool.execute<MoodAggregateRow[]>(
      `SELECT ci.logical_date,
              COUNT(ci.id) AS check_in_count,
              COUNT(m.mood_score) AS mood_count,
              SUM(m.mood_score) AS mood_sum
       FROM check_ins ci
       LEFT JOIN check_in_moods m ON m.check_in_id = ci.id
       WHERE ci.user_id = ?
         AND ci.logical_date >= ?
         AND ci.logical_date <= ?
       GROUP BY ci.logical_date
       ORDER BY ci.logical_date`,
      [userId, startLogicalDate, endLogicalDate],
    );

    return rows.map((row) => ({
      logicalDate: asLogicalDate(row.logical_date),
      checkInCount: Number(row.check_in_count),
      moodCount: Number(row.mood_count),
      moodSum: row.mood_sum == null ? 0 : Number(row.mood_sum),
    }));
  }
}

function asLogicalDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
