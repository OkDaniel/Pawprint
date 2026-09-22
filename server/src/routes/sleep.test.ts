import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/errorHandler.js';
import type { SleepService } from '../sleep/sleepService.js';
import { createSleepRouter } from './sleep.js';

function testApp(service: SleepService, authenticated = true) {
  const app = express();
  app.use(express.json());
  if (authenticated) app.use((incoming, _response, next) => { incoming.session = { userId: 7 } as typeof incoming.session; next(); });
  else app.use((incoming, _response, next) => { incoming.session = {} as typeof incoming.session; next(); });
  app.use('/api/sleep', createSleepRouter(service));
  app.use(errorHandler);
  return app;
}

describe('Sleep routes', () => {
  it('returns current and historical Sleep using only the session user', async () => {
    const service = { current: vi.fn(async () => null), list: vi.fn(async () => []) } as unknown as SleepService;
    await request(testApp(service)).get('/api/sleep/current').expect(200, { sleep: null });
    await request(testApp(service)).get('/api/sleep').expect(200, { sleepEntries: [] });
    expect(service.current).toHaveBeenCalledWith(7);
    expect(service.list).toHaveBeenCalledWith(7, {});
  });

  it('rejects anonymous Sleep reads', async () => {
    const service = { current: vi.fn(), list: vi.fn() } as unknown as SleepService;
    await request(testApp(service, false)).get('/api/sleep/current').expect(401);
    expect(service.current).not.toHaveBeenCalled();
  });

  it('reads and updates one historical day using only the session user', async () => {
    const sleep = { id: 8, logicalDate: '2026-09-15', bedtime: '23:30', wakeTime: '07:00', durationMinutes: 360, qualityScore: 4 };
    const service = { get: vi.fn(async () => sleep), update: vi.fn(async () => sleep) } as unknown as SleepService;
    await request(testApp(service)).get('/api/sleep/2026-09-15').expect(200, { sleep });
    await request(testApp(service)).put('/api/sleep/2026-09-15').send({ bedtime: '23:30', wakeTime: '07:00', durationMinutes: 360, qualityScore: 4 }).expect(200, { sleep });
    expect(service.get).toHaveBeenCalledWith(7, '2026-09-15');
    expect(service.update).toHaveBeenCalledWith(7, '2026-09-15', expect.objectContaining({ durationMinutes: 360 }));
  });

  it('does not let a frontend userId replace session ownership', async () => {
    const sleep = { id: 8, logicalDate: '2026-09-15', bedtime: null, wakeTime: null, durationMinutes: 360, qualityScore: null };
    const service = { update: vi.fn(async () => sleep) } as unknown as SleepService;
    await request(testApp(service)).put('/api/sleep/2026-09-15').send({ userId: 99, durationMinutes: 360 }).expect(200);
    expect(service.update).toHaveBeenCalledWith(7, '2026-09-15', expect.not.objectContaining({ userId: 99 }));
  });
});
