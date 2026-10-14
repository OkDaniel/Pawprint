import { describe, expect, it, vi } from 'vitest';
import type { EconomyRepository } from './economyRepository.js';
import { EconomyService } from './economyService.js';

describe('EconomyService daily reward eligibility', () => {
  const current = new Date('2026-10-07T17:00:00.000Z');

  it('keeps rewards disabled when no immutable activation instant is configured', async () => {
    const repository = { grantDailyReward: vi.fn() } as unknown as EconomyRepository;
    await expect(new EconomyService(repository, undefined).grantDailyCheckInReward(7, '2026-10-07', {
      occurredAt: current, createdAt: current, hasClientRequestId: true,
    })).resolves.toBe('disabled');
    expect(repository.grantDailyReward).not.toHaveBeenCalled();
  });

  it('rejects pre-launch, legacy, and mismatched logical-date records without inspecting wellness data', async () => {
    const repository = { grantDailyReward: vi.fn() } as unknown as EconomyRepository;
    const service = new EconomyService(repository, '2026-10-07T12:00:00Z');
    await expect(service.grantDailyCheckInReward(7, '2026-10-07', {
      occurredAt: current, createdAt: new Date('2026-10-07T11:59:59Z'), hasClientRequestId: true,
    })).resolves.toBe('ineligible');
    await expect(service.grantDailyCheckInReward(7, '2026-10-07', {
      occurredAt: current, createdAt: current, hasClientRequestId: false,
    })).resolves.toBe('ineligible');
    await expect(service.grantDailyCheckInReward(7, '2026-10-06', {
      occurredAt: current, createdAt: current, hasClientRequestId: true,
    })).resolves.toBe('ineligible');
    expect(repository.grantDailyReward).not.toHaveBeenCalled();
  });

  it('grants one current logical-day coin and treats a duplicate as normal', async () => {
    const repository = { grantDailyReward: vi.fn()
      .mockResolvedValueOnce({ granted: true, balance: 1 })
      .mockResolvedValueOnce({ granted: false, balance: 1 }) } as unknown as EconomyRepository;
    const service = new EconomyService(repository, '2026-10-07T12:00:00Z');
    const metadata = { occurredAt: current, createdAt: current, hasClientRequestId: true };
    await expect(service.grantDailyCheckInReward(7, '2026-10-07', metadata)).resolves.toBe('granted');
    await expect(service.grantDailyCheckInReward(7, '2026-10-07', metadata)).resolves.toBe('already-claimed');
  });

  it('reconciles only current and previous logical dates', async () => {
    const repository = {
      qualifyingCheckIns: vi.fn(async () => []),
    } as unknown as EconomyRepository;
    const service = new EconomyService(repository, '2026-01-01T00:00:00Z', () => current);
    await expect(service.syncRecentRewards(7)).resolves.toEqual({
      inspectedDates: ['2026-10-06', '2026-10-07'], rewardsGranted: 0,
    });
    expect(repository.qualifyingCheckIns).toHaveBeenCalledWith(7, ['2026-10-06', '2026-10-07'], new Date('2026-01-01T00:00:00Z'));
  });
});

describe('EconomyService catalog authority and variants', () => {
  it('passes the code-defined price rather than accepting a client price', async () => {
    const repository = { purchase: vi.fn(async () => ({ transactionId: 1, productId: 'decor_yarn_ball', balance: 0 })) } as unknown as EconomyRepository;
    await new EconomyService(repository).purchase(7, 'decor_yarn_ball', '11111111-1111-4111-8111-111111111111');
    expect(repository.purchase).toHaveBeenCalledWith(7, expect.objectContaining({ price: 1 }), expect.any(String));
  });

  it('rejects a variant outside the instance product family', async () => {
    const repository = {
      inventoryInstance: vi.fn(async () => ({ instanceId: 1, productId: 'decor_yarn_ball', selectedVariantId: 'decor_yarn_ball_base', purchaseTransactionId: 2, acquiredAt: '' })),
      updateInventoryVariant: vi.fn(),
    } as unknown as EconomyRepository;
    await expect(new EconomyService(repository).updateInventoryVariant(7, 1, 'decor_bowl_base'))
      .rejects.toMatchObject({ code: 'INVALID_DECORATION_VARIANT' });
    expect(repository.updateInventoryVariant).not.toHaveBeenCalled();
  });
  it('rejects invented product IDs before the purchase repository', async()=>{
    const repository={purchase:vi.fn()} as unknown as EconomyRepository;
    await expect(new EconomyService(repository).purchase(7,'room_decor_007_v01','request'))
      .rejects.toMatchObject({code:'PRODUCT_NOT_FOUND'});
    expect(repository.purchase).not.toHaveBeenCalled();
  });

  it('changes finishes for free and canonicalizes a legacy alias without room coordinate writes',async()=>{
    const instance={instanceId:1,productId:'decor_yarn_ball',selectedVariantId:'decor_yarn_ball_base',purchaseTransactionId:2,acquiredAt:''};
    const repository={inventoryInstance:vi.fn(async()=>instance),updateInventoryVariant:vi.fn(async()=>true),purchase:vi.fn(),devGrant:vi.fn()} as unknown as EconomyRepository;
    const service=new EconomyService(repository);
    await expect(service.updateInventoryVariant(7,1,'decor_yarn_ball_red')).resolves.toMatchObject({selectedVariantId:'decor_yarn_ball_red'});
    await expect(service.updateInventoryVariant(7,1,'decor_yarn_ball_base')).resolves.toMatchObject({selectedVariantId:'decor_yarn_ball_sage'});
    expect(repository.updateInventoryVariant).toHaveBeenLastCalledWith(7,1,'decor_yarn_ball_sage');
    expect(repository.purchase).not.toHaveBeenCalled(); expect(repository.devGrant).not.toHaveBeenCalled();
  });

});
