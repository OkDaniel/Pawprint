import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { AuthRepository } from './authRepository.js';

describe('AuthRepository onboarding fields', () => {
  it('creates a new user with database companion defaults and an incomplete onboarding state', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{ insertId: 42 }])
      .mockResolvedValueOnce([[{
        id: 42, username: 'new-user', password_hash: 'hash', cat_appearance_key: 'mochi-classic',
        cat_name: 'Mochi', onboarding_completed_at: null,
      }]]);
    const user = await new AuthRepository({ execute } as unknown as Pool).create('new-user', 'hash');
    expect(execute).toHaveBeenNthCalledWith(1, expect.stringContaining('INSERT INTO users (username, password_hash)'), ['new-user', 'hash']);
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
    const execute = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{
        id: 7, username: 'daniel', password_hash: 'hash', cat_appearance_key: 'mochi-grey',
        cat_name: 'Luna', onboarding_completed_at: new Date(),
      }]]);
    await new AuthRepository({ execute } as unknown as Pool).updateCompanion(7, 'mochi-grey', 'Luna');
    expect(execute).toHaveBeenNthCalledWith(1, expect.stringContaining('cat_appearance_key = ?, cat_name = ?'), ['mochi-grey', 'Luna', 7]);
  });
});
