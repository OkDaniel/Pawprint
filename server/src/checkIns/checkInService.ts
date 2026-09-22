import { deriveSleepDurationMinutes, type CheckIn, type CreateCheckInInput, type HistoryQuery, type UpdateCheckInInput } from '@capstone/shared';
import { AppError } from '../errors/AppError.js';
import { CheckInRepository } from './checkInRepository.js';
import { getLogicalDate } from './logicalDate.js';

export class CheckInService {
  constructor(private readonly repository = new CheckInRepository(), private readonly now = () => new Date()) {}

  async create(userId: number, input: CreateCheckInInput): Promise<CheckIn> {
    const normalizedInput = input.sleep ? { ...input, sleep: {
      ...input.sleep,
      durationMinutes: input.sleep.bedtime && input.sleep.wakeTime ? deriveSleepDurationMinutes(input.sleep.bedtime, input.sleep.wakeTime) : null,
    } } : input;
    await this.validateLibraries(userId, normalizedInput);
    const occurredAt = this.now();
    const id = await this.repository.create(userId, normalizedInput, occurredAt, getLogicalDate(occurredAt));
    const checkIn = await this.repository.findById(userId, id);
    if (!checkIn) throw new AppError(500, 'CHECK_IN_READ_FAILED', 'The check-in was saved but could not be read.');
    return checkIn;
  }

  async update(userId: number, id: number, input: UpdateCheckInInput): Promise<CheckIn> {
    const [feelings, symptoms, factors] = await Promise.all([
      this.repository.accessibleFeelingIdsForUpdate(userId, id, input.feelingIds),
      this.repository.accessibleSymptomIdsForUpdate(userId, id, input.symptoms.map(({ symptomId }) => symptomId)),
      this.repository.accessibleFactorIdsForUpdate(userId, id, input.factors.map(({ factorId }) => factorId)),
    ]);
    this.assertLibraryCounts(input, feelings, symptoms, factors);
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
    this.assertLibraryCounts(input, feelings, symptoms, factors);
  }

  private assertLibraryCounts(input: UpdateCheckInInput, feelings: number[], symptoms: number[], factors: number[]): void {
    if (feelings.length !== input.feelingIds.length) throw new AppError(400, 'INVALID_FEELINGS', 'One or more feelings are unavailable.');
    if (symptoms.length !== input.symptoms.length) throw new AppError(400, 'INVALID_SYMPTOMS', 'One or more symptoms are unavailable.');
    if (factors.length !== input.factors.length) throw new AppError(400, 'INVALID_FACTORS', 'One or more factors are unavailable.');
  }

  get(userId: number, id: number): Promise<CheckIn | null> { return this.repository.findById(userId, id); }
  list(userId: number, range: HistoryQuery = {}): Promise<CheckIn[]> { return this.repository.list(userId, undefined, undefined, range); }
}
