import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { CheckInRepository } from './checkInRepository.js';

function setup(failingPain = false) {
  const execute = vi.fn(async (sql: string) => {
    if (failingPain && sql.includes('check_in_pain')) throw new Error('child insert failed');
    if (sql.includes('INSERT INTO check_ins')) return [{ insertId: 42 }];
    return [{}];
  });
  const connection = {
    beginTransaction: vi.fn(), execute, commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
  };
  const pool = { getConnection: vi.fn(async () => connection) } as unknown as Pool;
  return { repository: new CheckInRepository(pool), connection, execute };
}

describe('CheckInRepository transaction', () => {
  it('does not insert a pain child row when pain is missing', async () => {
    const { repository, execute } = setup();
    await repository.create(7, { mood: 4, feelingIds: [], pain: undefined, symptoms: [], factors: [] }, new Date(), '2026-09-08');
    expect(execute.mock.calls.some(([sql]) => String(sql).includes('check_in_pain'))).toBe(false);
  });
  it('does insert a pain child row for explicit pain zero', async () => {
    const { repository, execute } = setup();
    await repository.create(7, { mood: 3, feelingIds: [], pain: 0, symptoms: [], factors: [] }, new Date(), '2026-09-08');
    expect(execute.mock.calls).toEqual(expect.arrayContaining([
      ['INSERT INTO check_in_pain (check_in_id, pain_score) VALUES (?, ?)', [42, 0]],
    ]));
  });
  it('rolls back when a child insert fails', async () => {
    const { repository, connection } = setup(true);
    await expect(repository.create(7, { mood: 3, feelingIds: [], pain: 2, symptoms: [], factors: [] }, new Date(), '2026-09-08')).rejects.toThrow();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });
});

describe('CheckInRepository extended children', () => {
  it('inserts multiple feelings only with mood', async () => {
    const { repository, execute } = setup();
    await repository.create(7, { mood: 3, feelingIds: [2, 9], pain: undefined, symptoms: [], factors: [] }, new Date(), '2026-09-08');
    expect(execute.mock.calls.filter(([sql]) => String(sql).includes('check_in_feelings'))).toHaveLength(2);
  });
  it('does not insert untouched symptoms and preserves explicit symptom zero', async () => {
    const untouched = setup();
    await untouched.repository.create(7, { mood: 3, feelingIds: [], pain: undefined, symptoms: [], factors: [] }, new Date(), '2026-09-08');
    expect(untouched.execute.mock.calls.some(([sql]) => String(sql).includes('symptom_entries'))).toBe(false);
    const explicit = setup();
    await explicit.repository.create(7, { mood: 3, feelingIds: [], pain: undefined, symptoms: [{ symptomId: 12, severity: 0 }], factors: [] }, new Date(), '2026-09-08');
    expect(explicit.execute.mock.calls).toEqual(expect.arrayContaining([
      ['INSERT INTO symptom_entries (check_in_id, symptom_id, severity) VALUES (?, ?, ?)', [42, 12, 0]],
    ]));
  });
  it('does not insert unselected factors and stores selected intensity', async () => {
    const { repository, execute } = setup();
    await repository.create(7, { mood: 3, feelingIds: [], pain: undefined, symptoms: [], factors: [{ factorId: 6, intensity: 2 }] }, new Date(), '2026-09-08');
    expect(execute.mock.calls).toEqual(expect.arrayContaining([
      ['INSERT INTO check_in_factors (check_in_id, factor_id, intensity) VALUES (?, ?, ?)', [42, 6, 2]],
    ]));
  });
});

describe('CheckInRepository ownership', () => {
  it('scopes history to the authenticated user ID', async () => {
    const execute = vi.fn(async () => [[]]);
    const pool = { execute } as unknown as Pool;
    await new CheckInRepository(pool).list(27);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('WHERE ci.user_id = ?'), [27, 50]);
  });

  it('keeps legacy factor rows with NULL intensity readable', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ id: 1, occurred_at: new Date('2026-09-08T12:00:00Z'), logical_date: '2026-09-08', mood_score: 4, pain_score: null }]])
      .mockResolvedValueOnce([[{ check_in_id: 1, intensity: null, id: 6, slug: 'study', name: 'Study', category: 'Lifestyle' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const pool = { execute } as unknown as Pool;
    const [checkIn] = await new CheckInRepository(pool).list(27);
    expect(checkIn?.factors).toEqual([
      { id: 6, slug: 'study', name: 'Study', category: 'Lifestyle', intensity: null, isBuiltin: false, isPinned: true },
    ]);
  });

  it('resolves archived custom library names in historical Check-Ins', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ id: 1, occurred_at: new Date('2026-09-08T12:00:00Z'), logical_date: '2026-09-08', mood_score: 4, pain_score: null }]])
      .mockResolvedValueOnce([[{ check_in_id: 1, intensity: 2, id: 6, slug: 'custom-factor', name: 'Archived Factor', category: 'Lifestyle', is_builtin: 0 }]])
      .mockResolvedValueOnce([[{ check_in_id: 1, id: 7, slug: null, name: 'Archived Feeling', is_builtin: 0 }]])
      .mockResolvedValueOnce([[{ check_in_id: 1, id: 8, name: 'Archived Symptom', category: 'Mental', severity: 3 }]]);
    const [checkIn] = await new CheckInRepository({ execute } as unknown as Pool).list(27);
    expect(checkIn?.feelings[0]?.name).toBe('Archived Feeling');
    expect(checkIn?.symptoms[0]?.name).toBe('Archived Symptom');
    expect(checkIn?.factors[0]?.name).toBe('Archived Factor');
    expect(execute.mock.calls.slice(1).every(([sql]) => !String(sql).includes('is_active'))).toBe(true);
  });
});
