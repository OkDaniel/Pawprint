import { randomUUID } from 'node:crypto';
import type { Factor, FactorCategory, Feeling, Symptom, SymptomCategory } from '@capstone/shared';
import { AppError } from '../errors/AppError.js';
import { TrackingLibraryRepository } from './trackingLibraryRepository.js';

type LibraryKind = 'feelings' | 'symptoms' | 'factors';

export class TrackingLibraryService {
  constructor(private readonly repository = new TrackingLibraryRepository()) {}
  listFeelings(userId: number): Promise<Feeling[]> { return this.repository.listFeelings(userId); }
  listSymptoms(userId: number, category?: SymptomCategory): Promise<Symptom[]> { return this.repository.listSymptoms(userId, category); }
  listFactors(userId: number): Promise<Factor[]> { return this.repository.listFactors(userId); }

  async setFeelingPreferences(userId: number, ids: number[]): Promise<Feeling[]> { await this.safePreferenceUpdate(() => this.repository.setFeelingPreferences(userId, ids)); return this.repository.listFeelings(userId); }
  async setSymptomPreferences(userId: number, category: SymptomCategory, ids: number[]): Promise<Symptom[]> { await this.safePreferenceUpdate(() => this.repository.setSymptomPreferences(userId, category, ids)); return this.repository.listSymptoms(userId, category); }
  async setFactorPreferences(userId: number, ids: number[]): Promise<Factor[]> { await this.safePreferenceUpdate(() => this.repository.setFactorPreferences(userId, ids)); return this.repository.listFactors(userId); }

  async createFeeling(userId: number, name: string): Promise<Feeling[]> {
    await this.rejectDuplicate('feelings', userId, name);
    const pinned = (await this.repository.listFeelings(userId)).filter(({ isPinned }) => isPinned).map(({ id }) => id);
    const id = await this.repository.createFeeling(userId, name);
    await this.repository.setFeelingPreferences(userId, [...pinned, id]);
    return this.repository.listFeelings(userId);
  }
  async createSymptom(userId: number, name: string, category: SymptomCategory): Promise<Symptom[]> {
    await this.rejectDuplicate('symptoms', userId, name, category);
    const pinned = (await this.repository.listSymptoms(userId, category)).filter(({ isPinned }) => isPinned).map(({ id }) => id);
    const id = await this.repository.createSymptom(userId, name, category);
    await this.repository.setSymptomPreferences(userId, category, [...pinned, id]);
    return this.repository.listSymptoms(userId, category);
  }
  async createFactor(userId: number, name: string, category: FactorCategory): Promise<Factor[]> {
    await this.rejectDuplicate('factors', userId, name);
    const pinned = (await this.repository.listFactors(userId)).filter(({ isPinned }) => isPinned).map(({ id }) => id);
    const id = await this.repository.createFactor(userId, `custom-${userId}-${randomUUID()}`, name, category);
    await this.repository.setFactorPreferences(userId, [...pinned, id]);
    return this.repository.listFactors(userId);
  }

  deactivateFeeling(userId: number, id: number): Promise<Feeling[]> { return this.deactivate('feelings', userId, id, () => this.repository.listFeelings(userId)); }
  deactivateSymptom(userId: number, id: number, category: SymptomCategory): Promise<Symptom[]> { return this.deactivate('symptoms', userId, id, () => this.repository.listSymptoms(userId, category)); }
  deactivateFactor(userId: number, id: number): Promise<Factor[]> { return this.deactivate('factors', userId, id, () => this.repository.listFactors(userId)); }

  private async deactivate<T>(kind: LibraryKind, userId: number, id: number, list: () => Promise<T[]>): Promise<T[]> {
    if (!await this.repository.deactivateCustom(kind, userId, id)) throw new AppError(404, 'CUSTOM_ITEM_NOT_FOUND', 'That custom item is unavailable.');
    return list();
  }
  private async rejectDuplicate(kind: LibraryKind, userId: number, name: string, category?: SymptomCategory): Promise<void> {
    if (await this.repository.activeDuplicateExists(kind, userId, name, category)) {
      const singular = kind === 'feelings' ? 'feeling' : kind === 'symptoms' ? 'symptom' : 'factor';
      throw new AppError(409, 'DUPLICATE_CUSTOM_ITEM', `That ${singular} already exists.`);
    }
  }
  private async safePreferenceUpdate(operation: () => Promise<void>): Promise<void> {
    try { await operation(); }
    catch (error) {
      if (error instanceof Error && error.message === 'INACCESSIBLE_PREFERENCE') throw new AppError(400, 'INVALID_PREFERENCES', 'One or more selected items are unavailable.');
      throw error;
    }
  }
}
