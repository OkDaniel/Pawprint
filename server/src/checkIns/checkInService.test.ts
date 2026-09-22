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
