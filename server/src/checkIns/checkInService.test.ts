import { describe, expect, it, vi } from 'vitest';
import { CheckInService, hashCreateCommand } from './checkInService.js';
import type { CheckInRepository } from './checkInRepository.js';

const requestId = '11111111-1111-4111-8111-111111111111';

describe('CheckInService library access', () => {
  it('rejects an unknown or inaccessible factor before inserting', async () => {
    const repository = {
      accessibleFeelingIds: vi.fn(async () => []),
      accessibleSymptomIds: vi.fn(async () => []),
      accessibleFactorIds: vi.fn(async () => []),
      ownedLibraryItems: vi.fn(async () => []),
      findByClientRequestId: vi.fn(async () => null),
      create: vi.fn(),
    } as unknown as CheckInRepository;
    const service = new CheckInService(repository);
    await expect(service.create(7, { clientRequestId: requestId, mood: 4, feelingIds: [], pain: undefined, symptoms: [], factors: [{ factorId: 999, intensity: 1 }] })).rejects.toMatchObject({ code: 'INVALID_FACTORS' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a feeling owned by another user before inserting', async () => {
    const repository = {
      accessibleFeelingIds: vi.fn(async () => []),
      accessibleSymptomIds: vi.fn(async () => []),
      accessibleFactorIds: vi.fn(async () => []),
      ownedLibraryItems: vi.fn(async () => []),
      findByClientRequestId: vi.fn(async () => null),
      create: vi.fn(),
    } as unknown as CheckInRepository;
    await expect(new CheckInService(repository).create(7, { clientRequestId: requestId, mood: 4, feelingIds: [901], pain: undefined, symptoms: [], factors: [] })).rejects.toMatchObject({ code: 'INVALID_FEELINGS' });
    expect(repository.accessibleFeelingIds).toHaveBeenCalledWith(7, [901]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a symptom owned by another user before inserting', async () => {
    const repository = {
      accessibleFeelingIds: vi.fn(async () => []),
      accessibleSymptomIds: vi.fn(async () => []),
      accessibleFactorIds: vi.fn(async () => []),
      ownedLibraryItems: vi.fn(async () => []),
      findByClientRequestId: vi.fn(async () => null),
      create: vi.fn(),
    } as unknown as CheckInRepository;
    await expect(new CheckInService(repository).create(7, { clientRequestId: requestId, mood: 4, feelingIds: [], pain: undefined, symptoms: [{ symptomId: 902, severity: 2 }], factors: [] })).rejects.toMatchObject({ code: 'INVALID_SYMPTOMS' });
    expect(repository.accessibleSymptomIds).toHaveBeenCalledWith(7, [902]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('identifies an owned inactive symptom and returns structured recovery details', async () => {
    const repository = {
      accessibleFeelingIds: vi.fn(async () => []),
      accessibleSymptomIds: vi.fn(async () => []),
      accessibleFactorIds: vi.fn(async () => []),
      ownedLibraryItems: vi.fn(async () => [{ id: 30, name: 'Mania' }]),
      findByClientRequestId: vi.fn(async () => null),
      create: vi.fn(),
    } as unknown as CheckInRepository;
    await expect(new CheckInService(repository).create(7, {
      clientRequestId: requestId, mood: 3, feelingIds: [], symptoms: [{ symptomId: 30, severity: 1 }], factors: [],
    })).rejects.toMatchObject({
      code: 'INVALID_SYMPTOMS',
      message: '“Mania” was removed from your tracked symptoms.',
      details: { kind: 'symptoms', unavailableIds: [30], items: [{ id: 30, name: 'Mania' }] },
    });
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
      ownedLibraryItems: vi.fn(async () => []),
      findByClientRequestId: vi.fn(async () => null),
      create: vi.fn(async (_userId, _input, _occurredAt, _logicalDate, _requestId, hash: Buffer) => ({ id: 12, requestHash: hash, created: true })), update: vi.fn(async () => true),
      findById: vi.fn(async () => ({ id: 12, occurredAt: '', logicalDate: '2026-09-22', mood: 4, feelings: [], pain: null, symptoms: [], factors: [] })),
    } as unknown as CheckInRepository;
  }
  it('authoritatively derives duration from clock times before creating', async () => {
    const repository = accessibleRepository();
    const runner = { enqueue: vi.fn(() => true) };
    await new CheckInService(repository, () => new Date('2026-09-22T12:00:00Z'), undefined, runner).create(7, { clientRequestId: requestId, mood: 4, feelingIds: [], symptoms: [], factors: [], sleep: { bedtime: '23:30', wakeTime: '07:00', durationMinutes: 999 } });
    expect(repository.create).toHaveBeenCalledWith(7, expect.objectContaining({ sleep: expect.objectContaining({ durationMinutes: 450 }) }), expect.any(Date), expect.any(String), requestId, expect.any(Buffer));
  });
  it('treats 1:30 PM to 12:30 AM as an 11-hour overnight span', async () => {
    const repository = accessibleRepository();
    const runner = { enqueue: vi.fn(() => true) };
    await new CheckInService(repository, () => new Date('2026-09-22T12:00:00Z'), undefined, runner).create(7, { clientRequestId: requestId, mood: 4, feelingIds: [], symptoms: [], factors: [], sleep: { bedtime: '13:30', wakeTime: '00:30', durationMinutes: 1 } });
    expect(repository.create).toHaveBeenCalledWith(7, expect.objectContaining({ sleep: expect.objectContaining({ durationMinutes: 660 }) }), expect.any(Date), expect.any(String), requestId, expect.any(Buffer));
  });
  it('updates the owned Check-In without changing its identity', async () => {
    const repository = accessibleRepository();
    await new CheckInService(repository).update(7, 12, { mood: 4, feelingIds: [], symptoms: [], factors: [] });
    expect(repository.update).toHaveBeenCalledWith(7, 12, expect.objectContaining({ mood: 4 }));
  });
});

describe('CheckInService create-request idempotency and fault isolation', () => {
  const input = { clientRequestId: requestId, mood: 4, feelingIds: [], symptoms: [], factors: [] } as const;
  const checkIn = { id: 12, occurredAt: '2026-10-07T17:00:00.000Z', logicalDate: '2026-10-07', mood: 4, feelings: [], pain: null, symptoms: [], factors: [] };

  it('replays before library availability validation when the canonical hash matches', async () => {
    const repository = {
      findByClientRequestId: vi.fn(async () => ({ id: 12, requestHash: hashCreateCommand(input) })),
      findById: vi.fn(async () => checkIn),
      accessibleFeelingIds: vi.fn(), accessibleSymptomIds: vi.fn(), accessibleFactorIds: vi.fn(),
    } as unknown as CheckInRepository;
    await expect(new CheckInService(repository).create(7, input)).resolves.toEqual({ checkIn, created: false });
    expect(repository.accessibleFeelingIds).not.toHaveBeenCalled();
  });

  it('returns a structured conflict when one request ID is reused for a changed command', async () => {
    const repository = {
      findByClientRequestId: vi.fn(async () => ({ id: 12, requestHash: hashCreateCommand(input) })),
      findById: vi.fn(async () => checkIn),
    } as unknown as CheckInRepository;
    await expect(new CheckInService(repository).create(7, { ...input, mood: 5 }))
      .rejects.toMatchObject({ status: 409, code: 'CHECK_IN_REQUEST_CONFLICT' });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('queues economy only after a newly committed Check-In and does not await a broken reward task', async () => {
    const requestHash = hashCreateCommand(input);
    const repository = {
      findByClientRequestId: vi.fn(async () => null),
      accessibleFeelingIds: vi.fn(async () => []), accessibleSymptomIds: vi.fn(async () => []), accessibleFactorIds: vi.fn(async () => []),
      ownedLibraryItems: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 12, requestHash, created: true })),
      findById: vi.fn(async () => checkIn),
    } as unknown as CheckInRepository;
    const economy = { grantDailyCheckInReward: vi.fn(async () => { throw new Error('game database failed'); }) };
    let queued: (() => Promise<unknown>) | undefined;
    const runner = { enqueue: vi.fn((task: () => Promise<unknown>) => { queued = task; return true; }) };
    await expect(new CheckInService(repository, () => new Date(checkIn.occurredAt), economy as never, runner).create(7, input))
      .resolves.toEqual({ checkIn, created: true });
    expect(runner.enqueue).toHaveBeenCalledOnce();
    await expect(queued!()).rejects.toThrow('game database failed');
  });
});
