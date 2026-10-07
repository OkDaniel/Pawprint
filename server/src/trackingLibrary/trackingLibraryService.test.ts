import { describe, expect, it, vi } from 'vitest';
import { TrackingLibraryService } from './trackingLibraryService.js';
import type { TrackingLibraryRepository } from './trackingLibraryRepository.js';

describe('TrackingLibraryService custom-item safety', () => {
  it('rejects a case-insensitive duplicate feeling with a clear conflict', async () => {
    const repository = { findActiveDuplicate: vi.fn(async () => ({ name: 'Numb' })) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).createFeeling(7, '  NUMB ')).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE_CUSTOM_ITEM',
      message: 'Numb already exists. Select it from the list above instead.',
      details: { kind: 'feeling', name: 'Numb' },
    });
    expect(repository.findActiveDuplicate).toHaveBeenCalledWith('feelings', 7, 'NUMB');
  });

  it('rejects a Symptom duplicate across categories and identifies the existing category', async () => {
    const repository = { findActiveDuplicate: vi.fn(async () => ({ name: 'Stomach Pain', category: 'Physical Pain' as const })) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).createSymptom(7, ' stomach pain ', 'Physical Other')).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE_CUSTOM_ITEM',
      message: 'Stomach Pain already exists under Physical Pain. Select it from the list above instead.',
      details: { kind: 'symptom', name: 'Stomach Pain', category: 'Physical Pain' },
    });
    expect(repository.findActiveDuplicate).toHaveBeenCalledWith('symptoms', 7, 'stomach pain');
  });

  it('rejects deactivation when the custom feeling is not owned by the user', async () => {
    const repository = { deactivateCustom: vi.fn(async () => false) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).deactivateFeeling(7, 99)).rejects.toMatchObject({ status: 404, code: 'CUSTOM_ITEM_NOT_FOUND' });
  });

  it('rejects deactivation when a custom symptom is not owned by the user', async () => {
    const repository = { deactivateCustom: vi.fn(async () => false) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).deactivateSymptom(7, 99, 'Mental')).rejects.toMatchObject({ status: 404, code: 'CUSTOM_ITEM_NOT_FOUND' });
  });

  it('rejects deactivation when a custom factor is not owned by the user', async () => {
    const repository = { deactivateCustom: vi.fn(async () => false) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).deactivateFactor(7, 99)).rejects.toMatchObject({ status: 404, code: 'CUSTOM_ITEM_NOT_FOUND' });
  });

  it('returns the active library after deactivating an owned custom symptom', async () => {
    const repository = { deactivateCustom: vi.fn(async () => true), listSymptoms: vi.fn(async () => []) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).deactivateSymptom(7, 12, 'Mental')).resolves.toEqual([]);
    expect(repository.deactivateCustom).toHaveBeenCalledWith('symptoms', 7, 12);
  });

  it('rejects a duplicate custom factor name', async () => {
    const repository = { findActiveDuplicate: vi.fn(async () => ({ name: 'Caffeine', category: 'Food / Substances' as const })) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).createFactor(7, ' caffeine ', 'Lifestyle')).rejects.toMatchObject({
      status: 409,
      message: 'Caffeine already exists under Food / Substances. Select it from the list above instead.',
      details: { kind: 'factor', name: 'Caffeine', category: 'Food / Substances' },
    });
    expect(repository.findActiveDuplicate).toHaveBeenCalledWith('factors', 7, 'caffeine');
  });

  it('deactivates an owned custom factor without deleting history', async () => {
    const repository = { deactivateCustom: vi.fn(async () => true), listFactors: vi.fn(async () => []) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).deactivateFactor(7, 12)).resolves.toEqual([]);
    expect(repository.deactivateCustom).toHaveBeenCalledWith('factors', 7, 12);
  });
});
