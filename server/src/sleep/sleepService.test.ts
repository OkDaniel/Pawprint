import { describe, expect, it, vi } from 'vitest';
import type { SleepRepository } from './sleepRepository.js';
import { SleepService } from './sleepService.js';

describe('SleepService', () => {
  it('uses the centralized logical date for the current user Sleep lookup', async () => {
    const repository = { findForDate: vi.fn(async () => null) } as unknown as SleepRepository;
    await new SleepService(repository, () => new Date('2026-09-15T08:00:00Z')).current(7);
    expect(repository.findForDate).toHaveBeenCalledWith(7, '2026-09-15');
  });
});
