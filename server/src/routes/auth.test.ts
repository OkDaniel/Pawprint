import express from 'express';
import request from 'supertest';
import { type AuthUser } from '@capstone/shared';
import { describe, expect, it, vi } from 'vitest';
import type { AuthService } from '../auth/authService.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { createAuthRouter } from './auth.js';

function appFor(service: AuthService, userId?: number) {
  const app = express();
  app.use(express.json());
  app.use((incoming, _response, next) => {
    incoming.session = {
      userId,
      regenerate(callback: (error?: unknown) => void) { callback(); },
      destroy(callback: (error?: unknown) => void) { callback(); },
    } as typeof incoming.session;
    next();
  });
  app.use('/api/auth', createAuthRouter(service));
  app.use(errorHandler);
  return app;
}

describe('auth companion contract', () => {
  const completeUser: AuthUser = { id: 7, username: 'daniel', catAppearance: 'mochi-orange', catName: 'Mochi', onboardingCompleted: true };

  it('registers with credentials only and returns an incomplete user', async () => {
    const user: AuthUser = { ...completeUser, catAppearance: 'mochi-classic', onboardingCompleted: false };
    const service = { register: vi.fn(async () => user) } as unknown as AuthService;
    const response = await request(appFor(service)).post('/api/auth/register').send({ username: 'daniel', password: 'password123' }).expect(201);
    expect(service.register).toHaveBeenCalledWith('daniel', 'password123');
    expect(response.body.user).toEqual(user);
  });

  it('returns persisted name, appearance, and onboarding state for the session user', async () => {
    const service = { currentUser: vi.fn(async () => completeUser) } as unknown as AuthService;
    const response = await request(appFor(service, 7)).get('/api/auth/me').expect(200);
    expect(service.currentUser).toHaveBeenCalledWith(7);
    expect(response.body.user).toEqual(completeUser);
  });

  it('updates companion fields for the authenticated session user rather than a client user ID', async () => {
    const user = { ...completeUser, catAppearance: 'mochi-grey' as const, catName: 'Luna' };
    const service = { updateCompanion: vi.fn(async () => user) } as unknown as AuthService;
    const response = await request(appFor(service, 7)).patch('/api/auth/me').send({ catAppearance: 'mochi-grey', catName: ' Luna ', userId: 999, onboardingCompleted: false }).expect(200);
    expect(service.updateCompanion).toHaveBeenCalledWith(7, 'mochi-grey', 'Luna');
    expect(response.body.user).toEqual(user);
  });

  it('rejects invalid companion values before updating', async () => {
    const service = { updateCompanion: vi.fn() } as unknown as AuthService;
    await request(appFor(service, 7)).patch('/api/auth/me').send({ catAppearance: 'not-a-cat', catName: '' }).expect(400);
    expect(service.updateCompanion).not.toHaveBeenCalled();
  });

  it('requires an authenticated session for companion updates', async () => {
    const service = { updateCompanion: vi.fn() } as unknown as AuthService;
    await request(appFor(service)).patch('/api/auth/me').send({ catAppearance: 'mochi-grey', catName: 'Mochi', userId: 999 }).expect(401);
    expect(service.updateCompanion).not.toHaveBeenCalled();
  });
});
