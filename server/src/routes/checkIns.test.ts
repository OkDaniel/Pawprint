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
