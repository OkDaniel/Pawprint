import express from 'express';
import request from 'supertest';
import { symptomCategories, type AuthUser } from '@capstone/shared';
import { describe, expect, it, vi } from 'vitest';
import type { OnboardingService } from '../onboarding/onboardingService.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { createOnboardingRouter } from './onboarding.js';

function appFor(service: OnboardingService, userId?: number) {
  const app = express();
  app.use(express.json());
  app.use((incoming, _response, next) => { incoming.session = { userId } as typeof incoming.session; next(); });
  app.use('/api/onboarding', createOnboardingRouter(service));
  app.use(errorHandler);
  return app;
}

const payload = {
  catAppearance: 'mochi-orange', catName: 'Mochi', feelingIds: [], factorIds: [],
  symptomPreferences: symptomCategories.map((category) => ({ category, ids: [] })),
};

describe('onboarding completion route', () => {
  it('uses session ownership and returns the completed auth state', async () => {
    const user: AuthUser = { id: 7, username: 'daniel', catAppearance: 'mochi-orange', catName: 'Mochi', onboardingCompleted: true };
    const service = { complete: vi.fn(async () => user) } as unknown as OnboardingService;
    const response = await request(appFor(service, 7)).put('/api/onboarding/complete').send({ ...payload, userId: 999 }).expect(200);
    expect(service.complete).toHaveBeenCalledWith(7, payload);
    expect(response.body.user).toEqual(user);
  });

  it.each([
    { ...payload, catAppearance: 'unknown' },
    { ...payload, catName: '' },
    { ...payload, feelingIds: [1, 1] },
    { ...payload, symptomPreferences: payload.symptomPreferences.slice(1) },
  ])('rejects malformed completion payloads before the service', async (body) => {
    const service = { complete: vi.fn() } as unknown as OnboardingService;
    await request(appFor(service, 7)).put('/api/onboarding/complete').send(body).expect(400);
    expect(service.complete).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const service = { complete: vi.fn() } as unknown as OnboardingService;
    await request(appFor(service)).put('/api/onboarding/complete').send(payload).expect(401);
    expect(service.complete).not.toHaveBeenCalled();
  });
});
