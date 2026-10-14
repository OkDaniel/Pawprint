import { resolveFloorVariant, type CatAppearanceKey, type DecorationInventoryInstance, type EconomySyncResponse, type PurchaseResult } from '@capstone/shared';
import { getLogicalDate } from '../checkIns/logicalDate.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { catalogProduct } from './catalog.js';
import { EconomyRepository, type CheckInCreationMetadata, type WalletIntegrityMismatch } from './economyRepository.js';

export interface RewardCreationMetadata {
  occurredAt: Date;
  createdAt: Date;
  hasClientRequestId: boolean;
}

export type DailyRewardResult = 'disabled' | 'ineligible' | 'already-claimed' | 'granted';

export class EconomyService {
  private readonly rewardsStartAt: Date | null;

  constructor(
    private readonly repository = new EconomyRepository(),
    rewardsStartAt: string | undefined = env.ECONOMY_REWARDS_START_AT,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.rewardsStartAt = rewardsStartAt ? new Date(rewardsStartAt) : null;
  }

  async wallet(userId: number): Promise<{ balance: number }> {
    return { balance: await this.repository.wallet(userId) };
  }

  async grantDailyCheckInReward(
    userId: number,
    storedLogicalDate: string,
    metadata: RewardCreationMetadata,
  ): Promise<DailyRewardResult> {
    if (!this.rewardsStartAt) return 'disabled';
    if (!metadata.hasClientRequestId || metadata.createdAt < this.rewardsStartAt) return 'ineligible';
    if (getLogicalDate(metadata.occurredAt) !== storedLogicalDate) return 'ineligible';
    const result = await this.repository.grantDailyReward(userId, storedLogicalDate);
    return result.granted ? 'granted' : 'already-claimed';
  }

  async syncRecentRewards(userId: number): Promise<EconomySyncResponse> {
    const current = getLogicalDate(this.now());
    const inspectedDates = [previousLogicalDate(current), current];
    if (!this.rewardsStartAt) return { inspectedDates, rewardsGranted: 0 };
    const candidates = await this.repository.qualifyingCheckIns(userId, inspectedDates, this.rewardsStartAt);
    let rewardsGranted = 0;
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (seen.has(candidate.logicalDate)) continue;
      seen.add(candidate.logicalDate);
      const result = await this.grantFromCandidate(userId, candidate);
      if (result === 'granted') rewardsGranted += 1;
    }
    return { inspectedDates, rewardsGranted };
  }

  async repairRewardRange(userId: number, startLogicalDate: string, endLogicalDate: string): Promise<EconomySyncResponse> {
    const inspectedDates = logicalDateRange(startLogicalDate, endLogicalDate, 31);
    if (!this.rewardsStartAt) return { inspectedDates, rewardsGranted: 0 };
    const candidates = await this.repository.qualifyingCheckIns(userId, inspectedDates, this.rewardsStartAt);
    let rewardsGranted = 0;
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (seen.has(candidate.logicalDate)) continue;
      seen.add(candidate.logicalDate);
      if (await this.grantFromCandidate(userId, candidate) === 'granted') rewardsGranted += 1;
    }
    return { inspectedDates, rewardsGranted };
  }

  async purchase(userId: number, productId: string, requestId: string): Promise<PurchaseResult> {
    const product = catalogProduct(productId);
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'That product does not exist.');
    return this.repository.purchase(userId, product, requestId);
  }

  inventory(userId: number): Promise<DecorationInventoryInstance[]> {
    return this.repository.inventory(userId);
  }

  ownedCoats(userId: number): Promise<CatAppearanceKey[]> {
    return this.repository.ownedCoats(userId);
  }

  async updateInventoryVariant(userId: number, instanceId: number, variantId: string): Promise<DecorationInventoryInstance> {
    const instance = await this.repository.inventoryInstance(userId, instanceId);
    if (!instance) throw new AppError(404, 'INVENTORY_INSTANCE_NOT_FOUND', 'Inventory item not found.');
    const product = catalogProduct(instance.productId);
    if (!product || product.kind !== 'decoration') {
      throw new AppError(500, 'INVENTORY_CATALOG_ERROR', 'The inventory item no longer has valid catalog metadata.');
    }
    const variant = resolveFloorVariant(product, variantId);
    if (!variant) {
      throw new AppError(400, 'INVALID_DECORATION_VARIANT', 'That variant does not belong to this decoration.');
    }
    if (!await this.repository.updateInventoryVariant(userId, instanceId, variant.id)) {
      throw new AppError(404, 'INVENTORY_INSTANCE_NOT_FOUND', 'Inventory item not found.');
    }
    return { ...instance, selectedVariantId: variant.id };
  }

  devGrant(userId: number, amount: number, requestId: string): Promise<{ transactionId: number; balance: number }> {
    return this.repository.devGrant(userId, amount, requestId);
  }

  verifyWalletIntegrity(): Promise<WalletIntegrityMismatch[]> {
    return this.repository.walletIntegrityMismatches();
  }

  private grantFromCandidate(userId: number, candidate: CheckInCreationMetadata): Promise<DailyRewardResult> {
    return this.grantDailyCheckInReward(userId, candidate.logicalDate, {
      occurredAt: candidate.occurredAt,
      createdAt: candidate.createdAt,
      hasClientRequestId: true,
    });
  }
}

function previousLogicalDate(logicalDate: string): string {
  const date = new Date(`${logicalDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function logicalDateRange(start: string, end: string, maximumDays: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    throw new AppError(400, 'INVALID_REPAIR_RANGE', 'Use an ordered YYYY-MM-DD repair range.');
  }
  const dates: string[] = [];
  let current = start;
  while (current <= end && dates.length <= maximumDays) {
    dates.push(current);
    const date = new Date(`${current}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new AppError(400, 'INVALID_REPAIR_RANGE', 'Use real calendar dates.');
    date.setUTCDate(date.getUTCDate() + 1);
    current = date.toISOString().slice(0, 10);
  }
  if (dates.length > maximumDays) throw new AppError(400, 'REPAIR_RANGE_TOO_LARGE', `Repair at most ${maximumDays} days at a time.`);
  return dates;
}
