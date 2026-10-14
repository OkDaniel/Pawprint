import { createHash, timingSafeEqual } from 'node:crypto';
import { deriveSleepDurationMinutes, type CheckIn, type CreateCheckInInput, type HistoryQuery, type UpdateCheckInInput } from '@capstone/shared';
import { AppError } from '../errors/AppError.js';
import { CheckInRepository } from './checkInRepository.js';
import { getLogicalDate } from './logicalDate.js';
import { EconomyService } from '../economy/economyService.js';
import { postCommitRewardRunner, type RewardRunner } from '../economy/postCommitRewardRunner.js';

export interface CreateCheckInResult { checkIn: CheckIn; created: boolean }

export class CheckInService {
  constructor(
    private readonly repository = new CheckInRepository(),
    private readonly now = () => new Date(),
    private readonly economy = new EconomyService(),
    private readonly rewardRunner: RewardRunner = postCommitRewardRunner,
  ) {}

  async create(userId: number, input: CreateCheckInInput): Promise<CreateCheckInResult> {
    const normalizedInput = input.sleep ? { ...input, sleep: {
      ...input.sleep,
      durationMinutes: input.sleep.bedtime && input.sleep.wakeTime ? deriveSleepDurationMinutes(input.sleep.bedtime, input.sleep.wakeTime) : null,
    } } : input;
    const requestHash = hashCreateCommand(normalizedInput);
    const replay = await this.repository.findByClientRequestId(userId, input.clientRequestId);
    if (replay) return { checkIn: await this.resolveReplay(userId, replay.id, replay.requestHash, requestHash), created: false };
    await this.validateLibraries(userId, normalizedInput);
    const occurredAt = this.now();
    const logicalDate = getLogicalDate(occurredAt);
    const persisted = await this.repository.create(
      userId, normalizedInput, occurredAt, logicalDate, input.clientRequestId, requestHash,
    );
    if (!hashesMatch(persisted.requestHash, requestHash)) {
      throw new AppError(409, 'CHECK_IN_REQUEST_CONFLICT', 'That Check-In request ID was already used with different details.');
    }
    const checkIn = await this.repository.findById(userId, persisted.id);
    if (!checkIn) throw new AppError(500, 'CHECK_IN_READ_FAILED', 'The check-in was saved but could not be read.');
    if (persisted.created) {
      this.rewardRunner.enqueue(() => this.economy.grantDailyCheckInReward(userId, logicalDate, {
        occurredAt,
        createdAt: occurredAt,
        hasClientRequestId: true,
      }));
    }
    return { checkIn, created: persisted.created };
  }

  async update(userId: number, id: number, input: UpdateCheckInInput): Promise<CheckIn> {
    const [feelings, symptoms, factors] = await Promise.all([
      this.repository.accessibleFeelingIdsForUpdate(userId, id, input.feelingIds),
      this.repository.accessibleSymptomIdsForUpdate(userId, id, input.symptoms.map(({ symptomId }) => symptomId)),
      this.repository.accessibleFactorIdsForUpdate(userId, id, input.factors.map(({ factorId }) => factorId)),
    ]);
    await this.assertLibraryCounts(userId, input, feelings, symptoms, factors);
    if (!await this.repository.update(userId, id, input)) throw new AppError(404, 'CHECK_IN_NOT_FOUND', 'Check-In not found.');
    const checkIn = await this.repository.findById(userId, id);
    if (!checkIn) throw new AppError(500, 'CHECK_IN_READ_FAILED', 'The Check-In was updated but could not be read.');
    return checkIn;
  }

  private async validateLibraries(userId: number, input: UpdateCheckInInput): Promise<void> {
    const [feelings, symptoms, factors] = await Promise.all([
      this.repository.accessibleFeelingIds(userId, input.feelingIds),
      this.repository.accessibleSymptomIds(userId, input.symptoms.map(({ symptomId }) => symptomId)),
      this.repository.accessibleFactorIds(userId, input.factors.map(({ factorId }) => factorId)),
    ]);
    await this.assertLibraryCounts(userId, input, feelings, symptoms, factors);
  }

  private async assertLibraryCounts(userId: number, input: UpdateCheckInInput, feelings: number[], symptoms: number[], factors: number[]): Promise<void> {
    await this.assertAvailable(userId, 'feelings', input.feelingIds, feelings, 'INVALID_FEELINGS');
    await this.assertAvailable(userId, 'symptoms', input.symptoms.map(({ symptomId }) => symptomId), symptoms, 'INVALID_SYMPTOMS');
    await this.assertAvailable(userId, 'factors', input.factors.map(({ factorId }) => factorId), factors, 'INVALID_FACTORS');
  }

  private async assertAvailable(userId: number, kind: 'feelings' | 'symptoms' | 'factors', requestedIds: number[], accessibleIds: number[], code: string): Promise<void> {
    const accessible = new Set(accessibleIds);
    const unavailableIds = requestedIds.filter((id) => !accessible.has(id));
    if (unavailableIds.length === 0) return;
    const items = await this.repository.ownedLibraryItems(kind, userId, unavailableIds);
    const singular = kind === 'feelings' ? 'feeling' : kind === 'symptoms' ? 'symptom' : 'factor';
    const itemName = items.length === 1 && unavailableIds.length === 1 ? items[0]?.name : undefined;
    const message = itemName
      ? `“${itemName}” was removed from your tracked ${kind}.`
      : `A ${singular} in this draft is no longer available.`;
    throw new AppError(400, code, message, { kind, unavailableIds, items });
  }

  get(userId: number, id: number): Promise<CheckIn | null> { return this.repository.findById(userId, id); }
  list(userId: number, range: HistoryQuery = {}): Promise<CheckIn[]> { return this.repository.list(userId, undefined, undefined, range); }

  private async resolveReplay(userId: number, id: number, storedHash: Buffer, requestHash: Buffer): Promise<CheckIn> {
    if (!hashesMatch(storedHash, requestHash)) {
      throw new AppError(409, 'CHECK_IN_REQUEST_CONFLICT', 'That Check-In request ID was already used with different details.');
    }
    const checkIn = await this.repository.findById(userId, id);
    if (!checkIn) throw new AppError(500, 'CHECK_IN_READ_FAILED', 'The saved Check-In could not be read.');
    return checkIn;
  }
}

export function hashCreateCommand(input: CreateCheckInInput): Buffer {
  const canonical = {
    mood: input.mood,
    feelingIds: [...input.feelingIds].sort((a, b) => a - b),
    pain: input.pain ?? null,
    symptoms: [...input.symptoms].sort((a, b) => a.symptomId - b.symptomId),
    factors: [...input.factors].sort((a, b) => a.factorId - b.factorId),
    sleep: input.sleep ? {
      bedtime: input.sleep.bedtime ?? null,
      wakeTime: input.sleep.wakeTime ?? null,
      durationMinutes: input.sleep.durationMinutes ?? null,
      qualityScore: input.sleep.qualityScore ?? null,
    } : null,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest();
}

function hashesMatch(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}
