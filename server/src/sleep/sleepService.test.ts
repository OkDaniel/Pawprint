import { describe, expect, it, vi } from 'vitest';
import type { SleepRepository } from './sleepRepository.js';
import { SleepService } from './sleepService.js';

describe('SleepService', () => {
  it('uses the centralized logical date for the current user Sleep lookup', async () => {
    const repository = { findForDate: vi.fn(async () => null) } as unknown as SleepRepository;
    await new SleepService(repository, () => new Date('2026-09-15T08:00:00Z')).current(7);
    expect(repository.findForDate).toHaveBeenCalledWith(7, '2026-09-15');
  });

  it('requests a different daily record after the 4:00 UTC logical-date boundary', async () => {
    let now = new Date('2026-09-15T03:59:59Z');
    const repository = { findForDate: vi.fn(async () => null) } as unknown as SleepRepository;
    const service = new SleepService(repository, () => now);
    await service.current(7);
    now = new Date('2026-09-15T04:00:00Z');
    await service.current(7);
    expect(repository.findForDate).toHaveBeenNthCalledWith(1, 7, '2026-09-14');
    expect(repository.findForDate).toHaveBeenNthCalledWith(2, 7, '2026-09-15');
  });

  it('returns not found rather than creating a missing daily Sleep row during an edit', async () => {
    const repository = { updateForDate: vi.fn(async () => false), findForDate: vi.fn() } as unknown as SleepRepository;
    await expect(new SleepService(repository).update(7, '2026-09-15', { qualityScore: 4 })).rejects.toMatchObject({ status: 404 });
    expect(repository.findForDate).not.toHaveBeenCalled();
  });

  it('derives duration from the two local clock times during an edit', async () => {
    const sleep = { id: 1, logicalDate: '2026-09-15', bedtime: '22:45', wakeTime: '06:15', durationMinutes: 450, qualityScore: 4 };
    const repository = { updateForDate: vi.fn(async () => true), findForDate: vi.fn(async () => sleep) } as unknown as SleepRepository;
    await new SleepService(repository).update(7, '2026-09-15', { bedtime: '22:45', wakeTime: '06:15', durationMinutes: 99, qualityScore: 4 });
    expect(repository.updateForDate).toHaveBeenCalledWith(7, '2026-09-15', expect.objectContaining({ durationMinutes: 450 }));
  });
});
