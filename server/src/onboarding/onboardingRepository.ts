import type { OnboardingCompletionInput, SymptomCategory } from '@capstone/shared';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../db/pool.js';

interface UserCompletionRow extends RowDataPacket { onboarding_completed_at: Date | null }
interface ItemRow extends RowDataPacket { id: number }
interface SymptomRow extends ItemRow { category: SymptomCategory }

export class OnboardingRepository {
  constructor(private readonly pool: Pool = getDatabasePool()) {}

  async complete(userId: number, input: OnboardingCompletionInput): Promise<'completed' | 'already-complete'> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [users] = await connection.execute<UserCompletionRow[]>(
        'SELECT onboarding_completed_at FROM users WHERE id = ? FOR UPDATE', [userId],
      );
      const user = users[0];
      if (!user) throw new Error('AUTH_REQUIRED');
      if (user.onboarding_completed_at !== null) {
        await connection.commit();
        return 'already-complete';
      }

      const [feelings] = await connection.execute<ItemRow[]>(
        `SELECT id FROM feelings
         WHERE is_active = TRUE AND (is_builtin = TRUE OR created_by_user_id = ?)
         ORDER BY is_builtin DESC, id`, [userId],
      );
      const [symptoms] = await connection.execute<SymptomRow[]>(
        `SELECT id, category FROM symptoms
         WHERE is_active = TRUE AND (is_builtin = TRUE OR created_by_user_id = ?)
         ORDER BY category, is_builtin DESC, id`, [userId],
      );
      const [factors] = await connection.execute<ItemRow[]>(
        `SELECT id FROM factors
         WHERE is_active = TRUE AND (is_builtin = TRUE OR created_by_user_id = ?)
         ORDER BY category, is_builtin DESC, id`, [userId],
      );

      assertSubset(input.feelingIds, feelings.map(({ id }) => Number(id)));
      assertSubset(input.factorIds, factors.map(({ id }) => Number(id)));
      for (const preference of input.symptomPreferences) {
        const available = symptoms.filter(({ category }) => category === preference.category).map(({ id }) => Number(id));
        assertSubset(preference.ids, available);
      }

      await replacePreferences(connection, 'user_feeling_preferences', 'feeling_id', userId, feelings.map(({ id }) => Number(id)), input.feelingIds);
      await connection.execute('DELETE FROM user_symptom_preferences WHERE user_id = ?', [userId]);
      for (const preference of input.symptomPreferences) {
        const available = symptoms.filter(({ category }) => category === preference.category).map(({ id }) => Number(id));
        await insertPreferences(connection, 'user_symptom_preferences', 'symptom_id', userId, available, preference.ids);
      }
      await replacePreferences(connection, 'user_factor_preferences', 'factor_id', userId, factors.map(({ id }) => Number(id)), input.factorIds);
      await connection.execute(
        `UPDATE users
         SET cat_appearance_key = ?, cat_name = ?, onboarding_completed_at = CURRENT_TIMESTAMP
         WHERE id = ?`, [input.catAppearance, input.catName, userId],
      );
      await connection.commit();
      return 'completed';
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

function assertSubset(selectedIds: number[], accessibleIds: number[]): void {
  const accessible = new Set(accessibleIds);
  if (selectedIds.some((id) => !accessible.has(id))) throw new Error('INACCESSIBLE_ONBOARDING_PREFERENCE');
}

async function replacePreferences(
  connection: PoolConnection,
  table: 'user_feeling_preferences' | 'user_factor_preferences',
  idColumn: 'feeling_id' | 'factor_id',
  userId: number,
  accessibleIds: number[],
  pinnedIds: number[],
): Promise<void> {
  await connection.execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
  await insertPreferences(connection, table, idColumn, userId, accessibleIds, pinnedIds);
}

async function insertPreferences(
  connection: PoolConnection,
  table: 'user_feeling_preferences' | 'user_symptom_preferences' | 'user_factor_preferences',
  idColumn: 'feeling_id' | 'symptom_id' | 'factor_id',
  userId: number,
  accessibleIds: number[],
  pinnedIds: number[],
): Promise<void> {
  const selected = new Set(pinnedIds);
  const ordered = [...accessibleIds.filter((id) => selected.has(id)), ...accessibleIds.filter((id) => !selected.has(id))];
  for (const [index, id] of ordered.entries()) {
    await connection.execute(
      `INSERT INTO ${table} (user_id, ${idColumn}, is_pinned, display_order) VALUES (?, ?, ?, ?)`,
      [userId, id, selected.has(id), index],
    );
  }
}
