import { Store, type SessionData } from 'express-session';
import type { RowDataPacket } from 'mysql2';
import { getDatabasePool } from '../db/pool.js';

interface SessionRow extends RowDataPacket { data: string }

export class MariaDbSessionStore extends Store {
  get(sessionId: string, callback: (error: unknown, session?: SessionData | null) => void): void {
    getDatabasePool().execute<SessionRow[]>(
      'SELECT data FROM sessions WHERE session_id = ? AND expires > UNIX_TIMESTAMP() LIMIT 1', [sessionId],
    ).then(([rows]) => callback(null, rows[0] ? JSON.parse(rows[0].data) as SessionData : null)).catch(callback);
  }

  set(sessionId: string, value: SessionData, callback?: (error?: unknown) => void): void {
    getDatabasePool().execute(
      `INSERT INTO sessions (session_id, expires, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)`,
      [sessionId, sessionExpiration(value), JSON.stringify(value)],
    ).then(() => callback?.()).catch((error: unknown) => callback?.(error));
  }

  destroy(sessionId: string, callback?: (error?: unknown) => void): void {
    getDatabasePool().execute('DELETE FROM sessions WHERE session_id = ?', [sessionId])
      .then(() => callback?.()).catch((error: unknown) => callback?.(error));
  }

  touch(sessionId: string, value: SessionData, callback?: (error?: unknown) => void): void {
    getDatabasePool().execute('UPDATE sessions SET expires = ? WHERE session_id = ?', [sessionExpiration(value), sessionId])
      .then(() => callback?.()).catch((error: unknown) => callback?.(error));
  }
}

function sessionExpiration(value: SessionData): number {
  const defaultExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const expiry = value.cookie.expires ? new Date(value.cookie.expires).getTime() : defaultExpiry;
  return Math.floor(expiry / 1000);
}
