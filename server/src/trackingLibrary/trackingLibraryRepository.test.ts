import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { TrackingLibraryRepository } from './trackingLibraryRepository.js';

describe('TrackingLibraryRepository ownership and preferences', () => {
  it('creates a custom symptom for the authenticated user', async () => {
    const execute = vi.fn(async () => [{ insertId: 91 }]);
    const repository = new TrackingLibraryRepository({ execute } as unknown as Pool);
    await repository.createSymptom(27, 'Sensory Overload', 'Mental');
    expect(execute).toHaveBeenNthCalledWith(1, expect.stringContaining('created_by_user_id'), ['Sensory Overload', 'Mental', 27]);
  });

  it('creates a custom feeling for the authenticated user', async () => {
    const execute = vi.fn(async () => [{ insertId: 44 }]);
    const repository = new TrackingLibraryRepository({ execute } as unknown as Pool);
    await repository.createFeeling(8, 'Centered');
    expect(execute).toHaveBeenNthCalledWith(1, expect.stringContaining('created_by_user_id'), ['Centered', 8]);
  });

  it('persists the complete symptom quick list in a transaction', async () => {
    const connection = { beginTransaction: vi.fn(), execute: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    const pool = {
      execute: vi.fn(async () => [[
        { id: 1, slug: 'anxiety', name: 'Anxiety', category: 'Mental', is_builtin: 1, preference: null },
        { id: 2, slug: 'irritability', name: 'Irritability', category: 'Mental', is_builtin: 1, preference: null },
      ]]),
      getConnection: vi.fn(async () => connection),
    } as unknown as Pool;
    await new TrackingLibraryRepository(pool).setSymptomPreferences(5, 'Mental', [2]);
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('user_symptom_preferences'), [5, 1, false, 0]);
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('user_symptom_preferences'), [5, 2, true, 1]);
    expect(connection.commit).toHaveBeenCalledOnce();
  });


  it('persists the complete feeling quick list in a transaction', async () => {
    const connection = { beginTransaction: vi.fn(), execute: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    const pool = {
      execute: vi.fn(async () => [[
        { id: 1, slug: 'calm', name: 'Calm', is_builtin: 1, preference: null },
        { id: 2, slug: 'anxious', name: 'Anxious', is_builtin: 1, preference: null },
      ]]),
      getConnection: vi.fn(async () => connection),
    } as unknown as Pool;
    await new TrackingLibraryRepository(pool).setFeelingPreferences(5, [1]);
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('user_feeling_preferences'), [5, 1, true, 0]);
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('user_feeling_preferences'), [5, 2, false, 1]);
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  it('persists the complete factor quick list in a transaction', async () => {
    const connection = { beginTransaction: vi.fn(), execute: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    const pool = {
      execute: vi.fn(async () => [[
        { id: 1, slug: 'study', name: 'Study', category: 'Lifestyle', is_builtin: 1, preference: null },
        { id: 2, slug: 'stress', name: 'Stress', category: 'Mental / Behavioral', is_builtin: 1, preference: null },
      ]]),
      getConnection: vi.fn(async () => connection),
    } as unknown as Pool;
    await new TrackingLibraryRepository(pool).setFactorPreferences(5, [2]);
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('user_factor_preferences'), [5, 1, false, 0]);
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining('user_factor_preferences'), [5, 2, true, 1]);
  });

  it('deactivates only a custom item owned by the authenticated user', async () => {
    const execute = vi.fn(async () => [{ affectedRows: 1 }]);
    const repository = new TrackingLibraryRepository({ execute } as unknown as Pool);
    await expect(repository.deactivateCustom('feelings', 8, 44)).resolves.toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('created_by_user_id = ? AND is_builtin = FALSE'), [44, 8]);
  });

  it('filters deactivated feelings out of the active selection library', async () => {
    const execute = vi.fn(async () => [[]]);
    await new TrackingLibraryRepository({ execute } as unknown as Pool).listFeelings(8);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('f.is_active = TRUE'), [8, 8]);
  });

  it('uses a trimmed case-insensitive duplicate comparison', async () => {
    const execute = vi.fn(async () => [[{ id: 1 }]]);
    await expect(new TrackingLibraryRepository({ execute } as unknown as Pool).activeDuplicateExists('feelings', 8, ' NUMB ')).resolves.toBe(true);
    expect(execute.mock.calls[0]?.[0]).toContain('LOWER(TRIM(name)) = LOWER(TRIM(?))');
  });
});
