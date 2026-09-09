import type { Factor, FactorCategory, Feeling, Symptom, SymptomCategory } from '@capstone/shared';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../db/pool.js';

interface FeelingRow extends RowDataPacket { id: number; slug: string | null; name: string; is_builtin: number; preference: number | null }
interface SymptomRow extends RowDataPacket { id: number; slug: string | null; name: string; category: SymptomCategory; is_builtin: number; preference: number | null }
interface FactorRow extends RowDataPacket { id: number; slug: string; name: string; category: FactorCategory; is_builtin: number; preference: number | null }

const defaultFeelings = new Set(['happy', 'grateful', 'calm', 'okay', 'tired', 'confused', 'anxious', 'stressed', 'overwhelmed']);
const defaultSymptoms: Record<SymptomCategory, Set<string>> = {
  'Physical Pain': new Set(['headache', 'joint-pain', 'back-pain']),
  'Physical Other': new Set(['fatigue', 'dizziness', 'drowsiness']),
  Mental: new Set(['anxiety', 'irritability', 'feeling-overwhelmed']),
  Cognitive: new Set(['brain-fog', 'forgetfulness', 'difficulty-focusing']),
};
const defaultFactors = new Set(['study', 'work', 'exercise', 'social-activity', 'stress', 'poor-sleep', 'caffeine', 'procrastination']);

export class TrackingLibraryRepository {
  constructor(private readonly pool: Pool = getDatabasePool()) {}

  async listFeelings(userId: number): Promise<Feeling[]> {
    const [rows] = await this.pool.execute<FeelingRow[]>(
      `SELECT f.id, f.slug, f.name, f.is_builtin, ufp.is_pinned AS preference
       FROM feelings f LEFT JOIN user_feeling_preferences ufp ON ufp.feeling_id = f.id AND ufp.user_id = ?
       WHERE f.is_active = TRUE AND (f.is_builtin = TRUE OR f.created_by_user_id = ?)
       ORDER BY f.is_builtin DESC, COALESCE(ufp.display_order, 2147483647), f.name`, [userId, userId],
    );
    const customized = rows.some((row) => row.preference !== null);
    return rows.map((row) => ({ id: Number(row.id), slug: row.slug, name: row.name, isBuiltin: Boolean(row.is_builtin), isPinned: customized ? Boolean(row.preference) : (!row.is_builtin || (row.slug !== null && defaultFeelings.has(row.slug))) }));
  }

  async listSymptoms(userId: number, category?: SymptomCategory): Promise<Symptom[]> {
    const categorySql = category ? ' AND s.category = ?' : '';
    const parameters = category ? [userId, userId, category] : [userId, userId];
    const [rows] = await this.pool.execute<SymptomRow[]>(
      `SELECT s.id, s.slug, s.name, s.category, s.is_builtin, usp.is_pinned AS preference
       FROM symptoms s LEFT JOIN user_symptom_preferences usp ON usp.symptom_id = s.id AND usp.user_id = ?
       WHERE s.is_active = TRUE AND (s.is_builtin = TRUE OR s.created_by_user_id = ?)${categorySql}
       ORDER BY s.category, s.is_builtin DESC, COALESCE(usp.display_order, 2147483647), s.name`, parameters,
    );
    const customizedCategories = new Set(rows.filter((row) => row.preference !== null).map((row) => row.category));
    return rows.map((row) => ({ id: Number(row.id), slug: row.slug, name: row.name, category: row.category, isBuiltin: Boolean(row.is_builtin), isPinned: customizedCategories.has(row.category) ? Boolean(row.preference) : (!row.is_builtin || (row.slug !== null && defaultSymptoms[row.category].has(row.slug))) }));
  }

  async listFactors(userId: number): Promise<Factor[]> {
    const [rows] = await this.pool.execute<FactorRow[]>(
      `SELECT f.id, f.slug, f.name, f.category, f.is_builtin, ufp.is_pinned AS preference
       FROM factors f LEFT JOIN user_factor_preferences ufp ON ufp.factor_id = f.id AND ufp.user_id = ?
       WHERE f.is_active = TRUE AND (f.is_builtin = TRUE OR f.created_by_user_id = ?)
       ORDER BY f.category, f.is_builtin DESC, COALESCE(ufp.display_order, 2147483647), f.name`, [userId, userId],
    );
    const customized = rows.some((row) => row.preference !== null);
    return rows.map((row) => ({ id: Number(row.id), slug: row.slug, name: row.name, category: row.category, intensity: null, isBuiltin: Boolean(row.is_builtin), isPinned: customized ? Boolean(row.preference) : (!row.is_builtin || defaultFactors.has(row.slug)) }));
  }

  async setFeelingPreferences(userId: number, pinnedIds: number[]): Promise<void> { const items = await this.listFeelings(userId); await this.replacePreferences('user_feeling_preferences', 'feeling_id', userId, items.map(({ id }) => id), pinnedIds); }
  async setSymptomPreferences(userId: number, category: SymptomCategory, pinnedIds: number[]): Promise<void> { const items = await this.listSymptoms(userId, category); await this.replacePreferences('user_symptom_preferences', 'symptom_id', userId, items.map(({ id }) => id), pinnedIds); }
  async setFactorPreferences(userId: number, pinnedIds: number[]): Promise<void> { const items = await this.listFactors(userId); await this.replacePreferences('user_factor_preferences', 'factor_id', userId, items.map(({ id }) => id), pinnedIds); }

  async activeDuplicateExists(kind: 'feelings' | 'symptoms' | 'factors', userId: number, name: string, category?: SymptomCategory): Promise<boolean> {
    const categorySql = kind === 'symptoms' ? ' AND category = ?' : '';
    const parameters = kind === 'symptoms' ? [userId, name, category ?? ''] : [userId, name];
    const [rows] = await this.pool.execute<Array<RowDataPacket & { id: number }>>(`SELECT id FROM ${kind} WHERE is_active = TRUE AND (is_builtin = TRUE OR created_by_user_id = ?) AND LOWER(TRIM(name)) = LOWER(TRIM(?))${categorySql} LIMIT 1`, parameters);
    return rows.length > 0;
  }

  async createFeeling(userId: number, name: string): Promise<number> { const [result] = await this.pool.execute<ResultSetHeader>('INSERT INTO feelings (slug, name, is_builtin, created_by_user_id) VALUES (NULL, ?, FALSE, ?)', [name, userId]); return result.insertId; }
  async createSymptom(userId: number, name: string, category: SymptomCategory): Promise<number> { const [result] = await this.pool.execute<ResultSetHeader>('INSERT INTO symptoms (slug, name, category, is_builtin, created_by_user_id) VALUES (NULL, ?, ?, FALSE, ?)', [name, category, userId]); return result.insertId; }
  async createFactor(userId: number, slug: string, name: string, category: FactorCategory): Promise<number> { const [result] = await this.pool.execute<ResultSetHeader>('INSERT INTO factors (slug, name, category, is_builtin, created_by_user_id) VALUES (?, ?, ?, FALSE, ?)', [slug, name, category, userId]); return result.insertId; }

  async deactivateCustom(kind: 'feelings' | 'symptoms' | 'factors', userId: number, id: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(`UPDATE ${kind} SET is_active = FALSE WHERE id = ? AND created_by_user_id = ? AND is_builtin = FALSE AND is_active = TRUE`, [id, userId]);
    return result.affectedRows === 1;
  }

  private async replacePreferences(table: string, idColumn: string, userId: number, accessibleIds: number[], pinnedIds: number[]): Promise<void> {
    if (pinnedIds.some((id) => !accessibleIds.includes(id))) throw new Error('INACCESSIBLE_PREFERENCE');
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
      for (const [index, id] of accessibleIds.entries()) await connection.execute(`INSERT INTO ${table} (user_id, ${idColumn}, is_pinned, display_order) VALUES (?, ?, ?, ?)`, [userId, id, pinnedIds.includes(id), index]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
}
