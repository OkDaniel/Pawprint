import type { CheckIn, CreateCheckInInput, Factor, Feeling, SymptomRating, SymptomCategory, FactorCategory } from '@capstone/shared';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../db/pool.js';

interface CheckInRow extends RowDataPacket { id: number; occurred_at: Date; logical_date: Date | string; mood_score: number | null; pain_score: number | null }
interface FactorRow extends RowDataPacket { id: number; slug: string; name: string; category: FactorCategory; is_builtin?: number; check_in_id?: number; intensity?: number | null }
interface FeelingRow extends RowDataPacket { id: number; slug: string | null; name: string; is_builtin: number; check_in_id?: number }
interface SymptomRow extends RowDataPacket { id: number; name: string; category: SymptomCategory; severity?: number; check_in_id?: number }

export class CheckInRepository {
  constructor(private readonly pool: Pool = getDatabasePool()) {}

  accessibleFactorIds(userId: number, ids: number[]): Promise<number[]> { return this.accessibleIds('factors', userId, ids); }
  accessibleFeelingIds(userId: number, ids: number[]): Promise<number[]> { return this.accessibleIds('feelings', userId, ids); }
  accessibleSymptomIds(userId: number, ids: number[]): Promise<number[]> { return this.accessibleIds('symptoms', userId, ids); }

  private async accessibleIds(table: 'factors' | 'feelings' | 'symptoms', userId: number, ids: number[]): Promise<number[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.execute<Array<RowDataPacket & { id: number }>>(
      `SELECT id FROM ${table} WHERE id IN (${placeholders}) AND is_active = TRUE
       AND (is_builtin = TRUE OR created_by_user_id = ?)`, [...ids, userId],
    );
    return rows.map((row) => Number(row.id));
  }

  async create(userId: number, input: CreateCheckInInput, occurredAt: Date, logicalDate: string): Promise<number> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO check_ins (user_id, occurred_at, logical_date) VALUES (?, ?, ?)', [userId, occurredAt, logicalDate],
      );
      const id = result.insertId;
      if (input.mood != null) {
        await connection.execute('INSERT INTO check_in_moods (check_in_id, mood_score) VALUES (?, ?)', [id, input.mood]);
        for (const feelingId of input.feelingIds) {
          await connection.execute('INSERT INTO check_in_feelings (check_in_id, feeling_id) VALUES (?, ?)', [id, feelingId]);
        }
      }
      if (input.pain != null) await connection.execute('INSERT INTO check_in_pain (check_in_id, pain_score) VALUES (?, ?)', [id, input.pain]);
      for (const symptom of input.symptoms) {
        await connection.execute('INSERT INTO symptom_entries (check_in_id, symptom_id, severity) VALUES (?, ?, ?)', [id, symptom.symptomId, symptom.severity]);
      }
      for (const factor of input.factors) {
        await connection.execute('INSERT INTO check_in_factors (check_in_id, factor_id, intensity) VALUES (?, ?, ?)', [id, factor.factorId, factor.intensity]);
      }
      await connection.commit();
      return id;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }

  async findById(userId: number, id: number): Promise<CheckIn | null> { return (await this.list(userId, 100, id))[0] ?? null; }

  async list(userId: number, limit = 50, id?: number): Promise<CheckIn[]> {
    const idClause = id === undefined ? '' : ' AND ci.id = ?';
    const values = id === undefined ? [userId, limit] : [userId, id, limit];
    const [rows] = await this.pool.execute<CheckInRow[]>(
      `SELECT ci.id, ci.occurred_at, ci.logical_date, m.mood_score, p.pain_score
       FROM check_ins ci LEFT JOIN check_in_moods m ON m.check_in_id = ci.id
       LEFT JOIN check_in_pain p ON p.check_in_id = ci.id
       WHERE ci.user_id = ?${idClause} ORDER BY ci.occurred_at DESC LIMIT ?`, values,
    );
    if (rows.length === 0) return [];
    const ids = rows.map((row) => Number(row.id));
    const placeholders = ids.map(() => '?').join(', ');
    const [factorRows] = await this.pool.execute<FactorRow[]>(
      `SELECT cif.check_in_id, cif.intensity, f.id, f.slug, f.name, f.category, f.is_builtin FROM check_in_factors cif
       JOIN factors f ON f.id = cif.factor_id WHERE cif.check_in_id IN (${placeholders}) ORDER BY f.category, f.name`, ids,
    );
    const [feelingRows] = await this.pool.execute<FeelingRow[]>(
      `SELECT cif.check_in_id, f.id, f.slug, f.name, f.is_builtin FROM check_in_feelings cif
       JOIN feelings f ON f.id = cif.feeling_id WHERE cif.check_in_id IN (${placeholders}) ORDER BY f.name`, ids,
    );
    const [symptomRows] = await this.pool.execute<SymptomRow[]>(
      `SELECT se.check_in_id, s.id, s.name, s.category, se.severity FROM symptom_entries se
       JOIN symptoms s ON s.id = se.symptom_id WHERE se.check_in_id IN (${placeholders}) ORDER BY s.category, s.name`, ids,
    );
    return rows.map((row) => ({
      id: Number(row.id), occurredAt: asIsoString(row.occurred_at), logicalDate: asDateString(row.logical_date),
      mood: row.mood_score == null ? null : Number(row.mood_score),
      feelings: belongingTo(feelingRows, row.id).map(toFeeling),
      pain: row.pain_score == null ? null : Number(row.pain_score),
      symptoms: belongingTo(symptomRows, row.id).map(toSymptomRating),
      factors: belongingTo(factorRows, row.id).map((factor) => toFactor(factor, factor.intensity == null ? null : Number(factor.intensity))),
    }));
  }
}

function belongingTo<T extends { check_in_id?: number }>(rows: T[], checkInId: number): T[] { return rows.filter((row) => Number(row.check_in_id) === Number(checkInId)); }
function toFactor(row: FactorRow, intensity: number | null): Factor { return { id: Number(row.id), slug: row.slug, name: row.name, category: row.category, intensity, isBuiltin: Boolean(row.is_builtin), isPinned: true }; }
function toFeeling(row: FeelingRow): Feeling { return { id: Number(row.id), slug: row.slug, name: row.name, isBuiltin: Boolean(row.is_builtin), isPinned: true }; }
function toSymptomRating(row: SymptomRow): SymptomRating { return { symptomId: Number(row.id), name: row.name, category: row.category, severity: Number(row.severity) }; }
function asIsoString(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(`${value}Z`).toISOString(); }
function asDateString(value: Date | string): string { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
