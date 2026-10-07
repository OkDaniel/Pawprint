import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { InsightsService } from '../insights/insightsService.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { createInsightsRouter } from './insights.js';

function appFor(service: InsightsService, userId?: number) {
  const app = express();
  app.use((incoming, _response, next) => {
    incoming.session = (userId === undefined ? {} : { userId }) as typeof incoming.session;
    next();
  });
  app.use('/api/insights', createInsightsRouter(service));
  app.use(errorHandler);
  return app;
}

describe('GET /api/insights/mood-trend', () => {
  it('rejects unauthenticated access', async () => {
    const service = { moodTrend: vi.fn() } as unknown as InsightsService;
    await request(appFor(service)).get('/api/insights/mood-trend').expect(401);
    expect(service.moodTrend).not.toHaveBeenCalled();
  });

  it('uses only the authenticated session user', async () => {
    const result = {
      range: { startLogicalDate: '2026-09-01', endLogicalDate: '2026-09-30', days: 30 as const },
      summary: { trackedDays: 0, totalCheckIns: 0, averageMood: null },
      points: [],
    };
    const service = { moodTrend: vi.fn(async () => result) } as unknown as InsightsService;
    const response = await request(appFor(service, 42)).get('/api/insights/mood-trend').expect(200);
    expect(service.moodTrend).toHaveBeenCalledWith(42);
    expect(response.body).toEqual(result);
  });
});
