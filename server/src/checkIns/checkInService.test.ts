import { describe, expect, it, vi } from 'vitest';
import { CheckInService } from './checkInService.js';
import type { CheckInRepository } from './checkInRepository.js';

describe('CheckInService factor access', () => {
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
});
