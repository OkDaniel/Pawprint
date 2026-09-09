import type { CheckIn, CreateCheckInInput } from '@capstone/shared';
import { AppError } from '../errors/AppError.js';
import { CheckInRepository } from './checkInRepository.js';
import { getLogicalDate } from './logicalDate.js';

export class CheckInService {
  constructor(private readonly repository = new CheckInRepository(), private readonly now = () => new Date()) {}

  async create(userId: number, input: CreateCheckInInput): Promise<CheckIn> {
    const [feelings, symptoms, factors] = await Promise.all([
      this.repository.accessibleFeelingIds(userId, input.feelingIds),
      this.repository.accessibleSymptomIds(userId, input.symptoms.map(({ symptomId }) => symptomId)),
      this.repository.accessibleFactorIds(userId, input.factors.map(({ factorId }) => factorId)),
    ]);
    if (feelings.length !== input.feelingIds.length) throw new AppError(400, 'INVALID_FEELINGS', 'One or more feelings are unavailable.');
    if (symptoms.length !== input.symptoms.length) throw new AppError(400, 'INVALID_SYMPTOMS', 'One or more symptoms are unavailable.');
    if (factors.length !== input.factors.length) throw new AppError(400, 'INVALID_FACTORS', 'One or more factors are unavailable.');
    const occurredAt = this.now();
    const id = await this.repository.create(userId, input, occurredAt, getLogicalDate(occurredAt));
    const checkIn = await this.repository.findById(userId, id);
    if (!checkIn) throw new AppError(500, 'CHECK_IN_READ_FAILED', 'The check-in was saved but could not be read.');
    return checkIn;
  }

  list(userId: number): Promise<CheckIn[]> { return this.repository.list(userId); }
}
