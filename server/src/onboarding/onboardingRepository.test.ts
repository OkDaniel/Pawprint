import { symptomCategories, type OnboardingCompletionInput } from '@capstone/shared';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingRepository } from './onboardingRepository.js';

const input: OnboardingCompletionInput = {
  catAppearance: 'mochi-grey', catName: 'Luna', feelingIds: [2], factorIds: [30],
  symptomPreferences: symptomCategories.map((category, index) => ({ category, ids: [10 + index] })),
};

function setup(options: { complete?: boolean; failOnFactorInsert?: boolean } = {}) {
  const execute = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes('SELECT onboarding_completed_at')) return [[{ onboarding_completed_at: options.complete ? new Date() : null }]];
    if (sql.includes('SELECT id FROM feelings')) return [[{ id: 1 }, { id: 2 }]];
    if (sql.includes('SELECT id, category FROM symptoms')) return [[
      { id: 10, category: 'Physical Pain' }, { id: 11, category: 'Physical Other' },
      { id: 12, category: 'Mental' }, { id: 13, category: 'Cognitive' },
    ]];
    if (sql.includes('SELECT id FROM factors')) return [[{ id: 30 }, { id: 31 }]];
    if (options.failOnFactorInsert && sql.includes('INSERT INTO user_factor_preferences')) throw new Error('write failed');
    return [{ affectedRows: 1 }];
  });
  const connection = {
    beginTransaction: vi.fn(), execute, commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
  } as unknown as PoolConnection;
  const pool = { getConnection: vi.fn(async () => connection) } as unknown as Pool;
  return { repository: new OnboardingRepository(pool), connection, execute };
}

describe('OnboardingRepository atomic completion', () => {
  it('writes companion fields and complete explicit preference snapshots in one transaction', async () => {
    const { repository, connection, execute } = setup();
    await expect(repository.complete(7, input)).resolves.toBe('completed');
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith('DELETE FROM user_feeling_preferences WHERE user_id = ?', [7]);
    expect(execute).toHaveBeenCalledWith('DELETE FROM user_symptom_preferences WHERE user_id = ?', [7]);
    expect(execute).toHaveBeenCalledWith('DELETE FROM user_factor_preferences WHERE user_id = ?', [7]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('user_feeling_preferences'), [7, 2, true, 0]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('user_feeling_preferences'), [7, 1, false, 1]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('onboarding_completed_at = CURRENT_TIMESTAMP'), ['mochi-grey', 'Luna', 7]);
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  it('accepts explicit empty selections and writes every accessible item as unpinned', async () => {
    const { repository, execute } = setup();
    await repository.complete(7, {
      ...input, feelingIds: [], factorIds: [], symptomPreferences: symptomCategories.map((category) => ({ category, ids: [] })),
    });
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('user_feeling_preferences'), [7, 1, false, 0]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('user_symptom_preferences'), [7, 10, false, 0]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('user_factor_preferences'), [7, 30, false, 0]);
  });

  it('rejects inaccessible IDs before any preference or user write and rolls back', async () => {
    const { repository, connection, execute } = setup();
    await expect(repository.complete(7, { ...input, feelingIds: [999] })).rejects.toThrow('INACCESSIBLE_ONBOARDING_PREFERENCE');
    expect(execute.mock.calls.some(([sql]) => String(sql).startsWith('DELETE'))).toBe(false);
    expect(execute.mock.calls.some(([sql]) => String(sql).includes('UPDATE users'))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('rolls back all earlier writes and never sets completion when a later write fails', async () => {
    const { repository, connection, execute } = setup({ failOnFactorInsert: true });
    await expect(repository.complete(7, input)).rejects.toThrow('write failed');
    expect(execute.mock.calls.some(([sql]) => String(sql).includes('UPDATE users'))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('treats a repeated completion request as an idempotent success without rewriting data', async () => {
    const { repository, connection, execute } = setup({ complete: true });
    await expect(repository.complete(7, input)).resolves.toBe('already-complete');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
  });
});
