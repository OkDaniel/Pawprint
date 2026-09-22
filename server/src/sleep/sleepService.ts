import { deriveSleepDurationMinutes, type HistoryQuery, type SleepEntry } from '@capstone/shared';
import { getLogicalDate } from '../checkIns/logicalDate.js';
import { SleepRepository } from './sleepRepository.js';
import type { SleepInput } from '@capstone/shared';
import { AppError } from '../errors/AppError.js';

export class SleepService {
  constructor(private readonly repository = new SleepRepository(), private readonly now = () => new Date()) {}

  current(userId: number): Promise<SleepEntry | null> {
    return this.repository.findForDate(userId, getLogicalDate(this.now()));
  }

  list(userId: number, range: HistoryQuery = {}): Promise<SleepEntry[]> {
    return this.repository.list(userId, undefined, range);
  }

  get(userId: number, logicalDate: string): Promise<SleepEntry | null> {
    return this.repository.findForDate(userId, logicalDate);
  }

  async update(userId: number, logicalDate: string, input: SleepInput): Promise<SleepEntry> {
    const normalizedInput = {
      ...input,
      durationMinutes: input.bedtime && input.wakeTime ? deriveSleepDurationMinutes(input.bedtime, input.wakeTime) : null,
    };
    if (!await this.repository.updateForDate(userId, logicalDate, normalizedInput)) {
      throw new AppError(404, 'SLEEP_NOT_FOUND', 'Sleep entry not found.');
    }
    const sleep = await this.repository.findForDate(userId, logicalDate);
    if (!sleep) throw new AppError(500, 'SLEEP_READ_FAILED', 'Sleep was updated but could not be read.');
    return sleep;
  }
}
