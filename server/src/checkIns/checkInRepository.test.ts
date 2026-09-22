import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { CheckInRepository } from './checkInRepository.js';

function setup(failingChild: 'pain' | 'sleep' | null = null) {
  const execute = vi.fn(async (sql: string) => {
    if (failingChild === 'pain' && sql.includes('check_in_pain')) throw new Error('child insert failed');
    if (failingChild === 'sleep' && sql.includes('sleep_entries')) throw new Error('sleep upsert failed');
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
    const { repository, connection } = setup('pain');
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
  it('does not write Sleep when the wizard omits an untouched Sleep draft', async () => {
    const { repository, execute } = setup();
    await repository.create(7, { mood: 3, feelingIds: [], symptoms: [], factors: [] }, new Date(), '2026-09-08');
    expect(execute.mock.calls.some(([sql]) => String(sql).includes('sleep_entries'))).toBe(false);
  });
  it('upserts changed daily Sleep on the same transaction connection', async () => {
    const { repository, execute, connection } = setup();
    await repository.create(7, {
      mood: 4, feelingIds: [], symptoms: [], factors: [],
      sleep: { bedtime: '23:30', wakeTime: '07:00', durationMinutes: 420, qualityScore: 4 },
    }, new Date(), '2026-09-08');
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sleep_entries'), [7, '2026-09-08', '23:30', '07:00', 420, 4]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('ON DUPLICATE KEY UPDATE'), expect.any(Array));
    expect(connection.commit).toHaveBeenCalledOnce();
  });
  it('rolls back the Check-In when the daily Sleep upsert fails', async () => {
    const { repository, connection } = setup('sleep');
    await expect(repository.create(7, {
      mood: 4, feelingIds: [], symptoms: [], factors: [], sleep: { qualityScore: 4 },
    }, new Date(), '2026-09-08')).rejects.toThrow('sleep upsert failed');
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });
});

describe('CheckInRepository ownership', () => {
  it('scopes history to the authenticated user ID', async () => {
    const execute = vi.fn(async () => [[]]);
    const pool = { execute } as unknown as Pool;
    await new CheckInRepository(pool).list(27);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('WHERE ci.user_id = ?'), [27]);
  });

  it('scopes an individual Check-In lookup by both authenticated user and Check-In ID', async () => {
    const execute = vi.fn(async () => [[]]);
    const repository = new CheckInRepository({ execute } as unknown as Pool);
    await expect(repository.findById(22, 901)).resolves.toBeNull();
    expect(execute).toHaveBeenCalledWith(expect.stringMatching(/WHERE ci\.user_id = \?.*AND ci\.id = \?/s), [22, 901, 1]);
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

  it('permits an archived item during update only when already linked to that owned Check-In', async () => {
    const execute = vi.fn(async () => [[{ id: 8 }]]);
    const repository = new CheckInRepository({ execute } as unknown as Pool);
    await expect(repository.accessibleSymptomIdsForUpdate(7, 42, [8])).resolves.toEqual([8]);
    expect(execute).toHaveBeenCalledWith(expect.stringMatching(/EXISTS.*link\.check_in_id = \?.*ci\.user_id = \?/s), [8, 7, 42, 7]);
  });
});

describe('CheckInRepository transactional update', () => {
  function updateSetup(failOnSymptoms = false, owned = true) {
    const execute = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT id FROM check_ins')) return [owned ? [{ id: 42 }] : []];
      if (failOnSymptoms && sql.includes('INSERT INTO symptom_entries')) throw new Error('replacement failed');
      return [{}];
    });
    const connection = { beginTransaction: vi.fn(), execute, commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    const repository = new CheckInRepository({ getConnection: vi.fn(async () => connection) } as unknown as Pool);
    return { repository, connection, execute };
  }
  it('replaces normalized children without inserting a duplicate parent', async () => {
    const { repository, execute, connection } = updateSetup();
    await expect(repository.update(7, 42, { mood: 5, feelingIds: [2], pain: 0, symptoms: [{ symptomId: 9, severity: 0 }], factors: [{ factorId: 3, intensity: 2 }] })).resolves.toBe(true);
    expect(execute.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO check_ins '))).toBe(false);
    expect(execute).toHaveBeenCalledWith('SELECT id FROM check_ins WHERE id = ? AND user_id = ? FOR UPDATE', [42, 7]);
    expect(connection.commit).toHaveBeenCalledOnce();
  });
  it('cannot update another user\'s Check-In', async () => {
    const { repository, connection } = updateSetup(false, false);
    await expect(repository.update(7, 42, { mood: 4, feelingIds: [], symptoms: [], factors: [] })).resolves.toBe(false);
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });
  it('rolls back all replacements when a child insert fails', async () => {
    const { repository, connection } = updateSetup(true);
    await expect(repository.update(7, 42, { mood: 4, feelingIds: [], symptoms: [{ symptomId: 9, severity: 2 }], factors: [] })).rejects.toThrow('replacement failed');
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });
});
