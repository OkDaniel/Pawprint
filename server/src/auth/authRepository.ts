import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getDatabasePool } from '../db/pool.js';

interface UserRow extends RowDataPacket { id: number; username: string; password_hash: string }

export interface StoredUser { id: number; username: string; passwordHash: string }

export class AuthRepository {
  async findByUsername(username: string): Promise<StoredUser | null> {
    const [rows] = await getDatabasePool().execute<UserRow[]>(
      'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1', [username],
    );
    const row = rows[0];
    return row ? { id: Number(row.id), username: row.username, passwordHash: row.password_hash } : null;
  }

  async findById(id: number): Promise<{ id: number; username: string } | null> {
    const [rows] = await getDatabasePool().execute<UserRow[]>(
      'SELECT id, username, password_hash FROM users WHERE id = ? LIMIT 1', [id],
    );
    const row = rows[0];
    return row ? { id: Number(row.id), username: row.username } : null;
  }

  async create(username: string, passwordHash: string): Promise<{ id: number; username: string }> {
    const [result] = await getDatabasePool().execute<ResultSetHeader>(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash],
    );
    return { id: result.insertId, username };
  }
}
