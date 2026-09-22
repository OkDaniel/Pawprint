import { describe, expect, it, vi } from 'vitest';
import { TrackingLibraryService } from './trackingLibraryService.js';
import type { TrackingLibraryRepository } from './trackingLibraryRepository.js';

describe('TrackingLibraryService custom-item safety', () => {
  it('rejects a case-insensitive duplicate feeling with a clear conflict', async () => {
    const repository = { activeDuplicateExists: vi.fn(async () => true) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).createFeeling(7, '  NUMB ')).rejects.toMatchObject({ status: 409, code: 'DUPLICATE_CUSTOM_ITEM', message: 'That feeling already exists.' });
  });

  it('checks symptom duplicates within the selected category', async () => {
    const repository = { activeDuplicateExists: vi.fn(async () => true) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).createSymptom(7, 'Foggy', 'Cognitive')).rejects.toMatchObject({ status: 409 });
    expect(repository.activeDuplicateExists).toHaveBeenCalledWith('symptoms', 7, 'Foggy', 'Cognitive');
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
    const repository = { activeDuplicateExists: vi.fn(async () => true) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).createFactor(7, 'STUDY', 'Lifestyle')).rejects.toMatchObject({ status: 409, message: 'That factor already exists.' });
  });

  it('deactivates an owned custom factor without deleting history', async () => {
    const repository = { deactivateCustom: vi.fn(async () => true), listFactors: vi.fn(async () => []) } as unknown as TrackingLibraryRepository;
    await expect(new TrackingLibraryService(repository).deactivateFactor(7, 12)).resolves.toEqual([]);
    expect(repository.deactivateCustom).toHaveBeenCalledWith('factors', 7, 12);
  });
});
