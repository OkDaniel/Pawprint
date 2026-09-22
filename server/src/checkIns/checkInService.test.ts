import { describe, expect, it, vi } from 'vitest';
import { CheckInService } from './checkInService.js';
import type { CheckInRepository } from './checkInRepository.js';

describe('CheckInService library access', () => {
  it('rejects an unknown or inaccessible factor before inserting', async () => {
    const repository = {
      accessibleFeelingIds: vi.fn(async () => []),
      accessibleSymptomIds: vi.fn(async () => []),
      accessibleFactorIds: vi.fn(async () => []),
      create: vi.fn(),
    } as unknown as CheckInRepository;
    const service = new CheckInService(repository);
    await expect(service.create(7, { mood: 4, feelingIds: [], pain: undefined, symptoms: [], factors: [{ factorId: 999, intensity: 1 }] })).rejects.toMatchObject({ code: 'INVALID_FACTORS' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a feeling owned by another user before inserting', async () => {
    const repository = {
      accessibleFeelingIds: vi.fn(async () => []),
      accessibleSymptomIds: vi.fn(async () => []),
      accessibleFactorIds: vi.fn(async () => []),
      create: vi.fn(),
    } as unknown as CheckInRepository;
    await expect(new CheckInService(repository).create(7, { mood: 4, feelingIds: [901], pain: undefined, symptoms: [], factors: [] })).rejects.toMatchObject({ code: 'INVALID_FEELINGS' });
    expect(repository.accessibleFeelingIds).toHaveBeenCalledWith(7, [901]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a symptom owned by another user before inserting', async () => {
    const repository = {
      accessibleFeelingIds: vi.fn(async () => []),
      accessibleSymptomIds: vi.fn(async () => []),
      accessibleFactorIds: vi.fn(async () => []),
      create: vi.fn(),
    } as unknown as CheckInRepository;
    await expect(new CheckInService(repository).create(7, { mood: 4, feelingIds: [], pain: undefined, symptoms: [{ symptomId: 902, severity: 2 }], factors: [] })).rejects.toMatchObject({ code: 'INVALID_SYMPTOMS' });
    expect(repository.accessibleSymptomIds).toHaveBeenCalledWith(7, [902]);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe('CheckInService updates and Sleep handling', () => {
  function accessibleRepository() {
    return {
      accessibleFeelingIds: vi.fn(async (_userId, ids: number[]) => ids),
      accessibleSymptomIds: vi.fn(async (_userId, ids: number[]) => ids),
      accessibleFactorIds: vi.fn(async (_userId, ids: number[]) => ids),
      accessibleFeelingIdsForUpdate: vi.fn(async (_userId, _checkInId, ids: number[]) => ids),
      accessibleSymptomIdsForUpdate: vi.fn(async (_userId, _checkInId, ids: number[]) => ids),
      accessibleFactorIdsForUpdate: vi.fn(async (_userId, _checkInId, ids: number[]) => ids),
      create: vi.fn(async () => 12), update: vi.fn(async () => true),
      findById: vi.fn(async () => ({ id: 12, occurredAt: '', logicalDate: '2026-09-22', mood: 4, feelings: [], pain: null, symptoms: [], factors: [] })),
    } as unknown as CheckInRepository;
  }
  it('authoritatively derives duration from clock times before creating', async () => {
    const repository = accessibleRepository();
    await new CheckInService(repository, () => new Date('2026-09-22T12:00:00Z')).create(7, { mood: 4, feelingIds: [], symptoms: [], factors: [], sleep: { bedtime: '23:30', wakeTime: '07:00', durationMinutes: 999 } });
    expect(repository.create).toHaveBeenCalledWith(7, expect.objectContaining({ sleep: expect.objectContaining({ durationMinutes: 450 }) }), expect.any(Date), expect.any(String));
  });
  it('updates the owned Check-In without changing its identity', async () => {
    const repository = accessibleRepository();
    await new CheckInService(repository).update(7, 12, { mood: 4, feelingIds: [], symptoms: [], factors: [] });
    expect(repository.update).toHaveBeenCalledWith(7, 12, expect.objectContaining({ mood: 4 }));
  });
});
