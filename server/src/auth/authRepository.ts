import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { normalizeCatAppearanceKey, type AuthUser, type CatAppearanceKey } from '@capstone/shared';
import { getDatabasePool } from '../db/pool.js';
import type { Pool } from 'mysql2/promise';

interface UserRow extends RowDataPacket { id: number; username: string; password_hash: string; cat_appearance_key: string; cat_name: string; onboarding_completed_at: Date | null }

export interface StoredUser extends AuthUser { passwordHash: string }

export class AuthRepository {
  constructor(private readonly pool: Pool = getDatabasePool()) {}

  async findByUsername(username: string): Promise<StoredUser | null> {
    const [rows] = await this.pool.execute<UserRow[]>(
      'SELECT id, username, password_hash, cat_appearance_key, cat_name, onboarding_completed_at FROM users WHERE username = ? LIMIT 1', [username],
    );
    const row = rows[0];
    return row ? { ...toAuthUser(row), passwordHash: row.password_hash } : null;
  }

  async findById(id: number): Promise<AuthUser | null> {
    const [rows] = await this.pool.execute<UserRow[]>(
      'SELECT id, username, password_hash, cat_appearance_key, cat_name, onboarding_completed_at FROM users WHERE id = ? LIMIT 1', [id],
    );
    const row = rows[0];
    return row ? toAuthUser(row) : null;
  }

  async create(username: string, passwordHash: string): Promise<AuthUser> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash],
    );
    const user = await this.findById(result.insertId);
    if (!user) throw new Error('CREATED_USER_NOT_FOUND');
    return user;
  }

  async updateCompanion(id: number, catAppearance: CatAppearanceKey, catName: string): Promise<AuthUser | null> {
    await this.pool.execute(
      'UPDATE users SET cat_appearance_key = ?, cat_name = ? WHERE id = ?', [catAppearance, catName, id],
    );
    return this.findById(id);
  }
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: Number(row.id),
    username: row.username,
    catAppearance: normalizeCatAppearanceKey(row.cat_appearance_key),
    catName: row.cat_name,
    onboardingCompleted: row.onboarding_completed_at !== null,
  };
}
