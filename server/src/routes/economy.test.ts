import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { EconomyService } from '../economy/economyService.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { createDevCoinRouter } from './devCoins.js';
import { createEconomyRouter } from './economy.js';

function appFor(router: express.Router) {
  const app = express(); app.use(express.json());
  app.use((incoming, _response, next) => { incoming.session = { userId: 7 } as typeof incoming.session; next(); });
  app.use(router); app.use(errorHandler); return app;
}

describe('economy routes', () => {
  it('exposes actual server prices and eligibility with grants disabled by default', async () => {
    const service = {} as EconomyService;
    const response = await request(appFor(createEconomyRouter(service))).get('/catalog').expect(200);
    expect(response.body.devCoinGrantsEnabled).toBe(false);
    expect(response.body.products).toHaveLength(20);
    expect(response.body.products.filter((p: {kind: string}) => p.kind === 'decoration')).toHaveLength(16);
    expect(response.body.products.every((p: {price: number; purchasable: boolean}) => p.price === 1 && p.purchasable)).toBe(true);
    const enabled = await request(appFor(createEconomyRouter(service, true))).get('/catalog').expect(200);
    expect(enabled.body.devCoinGrantsEnabled).toBe(true);
  });

  it('reads coats only for the session owner and rejects anonymous catalog reads', async () => {
    const service = { ownedCoats: vi.fn(async () => ['mochi-grey']) } as unknown as EconomyService;
    const response = await request(appFor(createEconomyRouter(service))).get('/coats?userId=999').expect(200);
    expect(response.body.coats).toEqual(['mochi-grey']);
    expect(service.ownedCoats).toHaveBeenCalledWith(7);
    const anonymous = express();
    anonymous.use((incoming, _response, next) => { incoming.session = {} as typeof incoming.session; next(); });
    anonymous.use(createEconomyRouter(service)); anonymous.use(errorHandler);
    await request(anonymous).get('/catalog').expect(401);
  });
  it('derives ownership from the session and never forwards a client price', async () => {
    const purchase = { transactionId: 3, productId: 'decor_yarn_ball', balance: 0, inventoryInstanceId: 8 };
    const service = { purchase: vi.fn(async () => purchase) } as unknown as EconomyService;
    const response = await request(appFor(createEconomyRouter(service))).post('/purchases').send({
      productId: 'decor_yarn_ball', requestId: '11111111-1111-4111-8111-111111111111',
      userId: 999, price: 0,
    }).expect(201);
    expect(service.purchase).toHaveBeenCalledWith(7, 'decor_yarn_ball', '11111111-1111-4111-8111-111111111111');
    expect(response.body.purchase).toEqual(purchase);
  });

  it('runs bounded recent sync for the authenticated user', async () => {
    const service = { syncRecentRewards: vi.fn(async () => ({ inspectedDates: ['2026-10-06', '2026-10-07'], rewardsGranted: 1 })) } as unknown as EconomyService;
    await request(appFor(createEconomyRouter(service))).post('/sync').send({ startDate: '1900-01-01', userId: 999 }).expect(200);
    expect(service.syncRecentRewards).toHaveBeenCalledWith(7);
  });
});

describe('development coin grant route', () => {
  it('uses the authenticated user and validated bounded idempotent grant command', async () => {
    const service = { devGrant: vi.fn(async () => ({ transactionId: 4, balance: 5 })) } as unknown as EconomyService;
    await request(appFor(createDevCoinRouter(service))).post('/grants').send({
      amount: 5, requestId: '11111111-1111-4111-8111-111111111111', userId: 999,
    }).expect(201);
    expect(service.devGrant).toHaveBeenCalledWith(7, 5, '11111111-1111-4111-8111-111111111111');
  });
});
