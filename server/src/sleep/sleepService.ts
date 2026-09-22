import type { SleepEntry } from '@capstone/shared';
import { getLogicalDate } from '../checkIns/logicalDate.js';
import { SleepRepository } from './sleepRepository.js';

export class SleepService {
  constructor(private readonly repository = new SleepRepository(), private readonly now = () => new Date()) {}

  current(userId: number): Promise<SleepEntry | null> {
    return this.repository.findForDate(userId, getLogicalDate(this.now()));
  }

  list(userId: number): Promise<SleepEntry[]> {
    return this.repository.list(userId);
  }
}
