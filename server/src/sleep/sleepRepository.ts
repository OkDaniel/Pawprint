import type { HistoryQuery, SleepEntry, SleepInput } from '@capstone/shared';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../db/pool.js';

interface SleepRow extends RowDataPacket {
  id: number;
  logical_date: Date | string;
  bedtime: string | null;
  wake_time: string | null;
  duration_minutes: number | null;
  quality_score: number | null;
}

export class SleepRepository {
  constructor(private readonly pool: Pool = getDatabasePool()) {}

  async findForDate(userId: number, logicalDate: string): Promise<SleepEntry | null> {
    const [rows] = await this.pool.execute<SleepRow[]>(
      `SELECT id, logical_date, bedtime, wake_time, duration_minutes, quality_score
       FROM sleep_entries WHERE user_id = ? AND logical_date = ?`,
      [userId, logicalDate],
    );
    return rows[0] ? toSleepEntry(rows[0]) : null;
  }

  async list(userId: number, limit?: number, range: HistoryQuery = {}): Promise<SleepEntry[]> {
    const startClause = range.startDate ? ' AND logical_date >= ?' : '';
    const endClause = range.endDate ? ' AND logical_date <= ?' : '';
    const values: Array<string | number> = [userId];
    if (range.startDate) values.push(range.startDate);
    if (range.endDate) values.push(range.endDate);
    const limitClause = limit === undefined ? '' : ' LIMIT ?';
    if (limit !== undefined) values.push(limit);
    const [rows] = await this.pool.execute<SleepRow[]>(
      `SELECT id, logical_date, bedtime, wake_time, duration_minutes, quality_score
       FROM sleep_entries WHERE user_id = ?${startClause}${endClause} ORDER BY logical_date DESC${limitClause}`,
      values,
    );
    return rows.map(toSleepEntry);
  }

  async updateForDate(userId: number, logicalDate: string, input: SleepInput): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE sleep_entries SET bedtime = ?, wake_time = ?, duration_minutes = ?, quality_score = ?
       WHERE user_id = ? AND logical_date = ?`,
      [input.bedtime ?? null, input.wakeTime ?? null, input.durationMinutes ?? null, input.qualityScore ?? null, userId, logicalDate],
    );
    return result.affectedRows === 1;
  }
}

function toSleepEntry(row: SleepRow): SleepEntry {
  return {
    id: Number(row.id),
    logicalDate: row.logical_date instanceof Date ? row.logical_date.toISOString().slice(0, 10) : String(row.logical_date).slice(0, 10),
    bedtime: trimTime(row.bedtime),
    wakeTime: trimTime(row.wake_time),
    durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes),
    qualityScore: row.quality_score == null ? null : Number(row.quality_score),
  };
}

function trimTime(value: string | null): string | null {
  return value == null ? null : value.slice(0, 5);
}
