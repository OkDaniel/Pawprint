import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { CheckInService } from '../checkIns/checkInService.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { createCheckInRouter } from './checkIns.js';

describe('POST /api/check-ins validation', () => {
  it('rejects a Check-In without Mood before calling the service', async () => {
    const service = { create: vi.fn() } as unknown as CheckInService;
    const app = express();
    app.use(express.json());
    app.use((incoming, _response, next) => { incoming.session = { userId: 7 } as typeof incoming.session; next(); });
    app.use('/api/check-ins', createCheckInRouter(service));
    app.use(errorHandler);
    const response = await request(app).post('/api/check-ins').send({ pain: 2, symptoms: [], factors: [] }).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.create).not.toHaveBeenCalled();
  });
});

describe('Check-In reads and updates', () => {
  function appFor(service: CheckInService) {
    const app = express(); app.use(express.json());
    app.use((incoming, _response, next) => { incoming.session = { userId: 7 } as typeof incoming.session; next(); });
    app.use('/api/check-ins', createCheckInRouter(service)); app.use(errorHandler); return app;
  }
  it('passes validated date filters and session ownership to the service', async () => {
    const service = { list: vi.fn(async () => []) } as unknown as CheckInService;
    await request(appFor(service)).get('/api/check-ins?startDate=2026-09-01&endDate=2026-09-30').expect(200);
    expect(service.list).toHaveBeenCalledWith(7, { startDate: '2026-09-01', endDate: '2026-09-30' });
  });
  it('reads and updates only through the session user', async () => {
    const checkIn = { id: 42 };
    const service = { get: vi.fn(async () => checkIn), update: vi.fn(async () => checkIn) } as unknown as CheckInService;
    await request(appFor(service)).get('/api/check-ins/42').expect(200);
    await request(appFor(service)).put('/api/check-ins/42').send({ mood: 4, feelingIds: [], symptoms: [], factors: [] }).expect(200);
    expect(service.get).toHaveBeenCalledWith(7, 42);
    expect(service.update).toHaveBeenCalledWith(7, 42, expect.objectContaining({ mood: 4 }));
  });
});
