import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { AuthRepository } from './authRepository.js';

describe('AuthRepository onboarding fields', () => {
  it('creates a new user with database companion defaults and an incomplete onboarding state', async () => {
    const connectionExecute = vi.fn()
      .mockResolvedValueOnce([{ insertId: 42 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const execute = vi.fn()
      .mockResolvedValueOnce([[{
        id: 42, username: 'new-user', password_hash: 'hash', cat_appearance_key: 'mochi-classic',
        cat_name: 'Mochi', onboarding_completed_at: null,
      }]]);
    const connection = { beginTransaction: vi.fn(), execute: connectionExecute, commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    const user = await new AuthRepository({ execute, getConnection: vi.fn(async () => connection) } as unknown as Pool).create('new-user', 'hash');
    expect(connectionExecute).toHaveBeenNthCalledWith(1, expect.stringContaining('INSERT INTO users (username, password_hash)'), ['new-user', 'hash']);
    expect(connectionExecute).toHaveBeenNthCalledWith(2, expect.stringContaining('user_cat_coats'), [42]);
    expect(user).toEqual({ id: 42, username: 'new-user', catAppearance: 'mochi-classic', catName: 'Mochi', onboardingCompleted: false });
  });

  it('maps a migrated existing user as complete without changing their appearance', async () => {
    const execute = vi.fn(async () => [[{
      id: 5, username: 'existing', password_hash: 'hash', cat_appearance_key: 'mochi-orange',
      cat_name: 'Mochi', onboarding_completed_at: new Date('2026-09-29T12:00:00Z'),
    }]]);
    await expect(new AuthRepository({ execute } as unknown as Pool).findById(5)).resolves.toEqual({
      id: 5, username: 'existing', catAppearance: 'mochi-orange', catName: 'Mochi', onboardingCompleted: true,
    });
  });

  it('updates only companion name and appearance for the owned user record', async () => {
    const connectionExecute = vi.fn()
      .mockResolvedValueOnce([[{ id: 7, onboarding_completed_at: new Date() }]])
      .mockResolvedValueOnce([[{ coat_id: 'mochi-grey' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const execute = vi.fn()
      .mockResolvedValueOnce([[{
        id: 7, username: 'daniel', password_hash: 'hash', cat_appearance_key: 'mochi-grey',
        cat_name: 'Luna', onboarding_completed_at: new Date(),
      }]]);
    const connection = { beginTransaction: vi.fn(), execute: connectionExecute, commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    await new AuthRepository({ execute, getConnection: vi.fn(async () => connection) } as unknown as Pool).updateCompanion(7, 'mochi-grey', 'Luna');
    expect(connectionExecute).toHaveBeenNthCalledWith(3, expect.stringContaining('cat_appearance_key = ?, cat_name = ?'), ['mochi-grey', 'Luna', 7]);
  });

  it('cannot use the Account appearance path to equip an unowned coat', async () => {
    const connectionExecute = vi.fn()
      .mockResolvedValueOnce([[{ id: 7, onboarding_completed_at: new Date() }]])
      .mockResolvedValueOnce([[]]);
    const connection = { beginTransaction: vi.fn(), execute: connectionExecute, commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    await expect(new AuthRepository({ getConnection: vi.fn(async () => connection) } as unknown as Pool)
      .updateCompanion(7, 'mochi-white', 'Mochi')).rejects.toThrow('CAT_COAT_NOT_OWNED');
    expect(connectionExecute.mock.calls.some(([sql]) => String(sql).startsWith('UPDATE users'))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledOnce();
  });
});
