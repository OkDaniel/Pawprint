import { Router, type Request } from 'express';
import { loginRequestSchema, registerRequestSchema } from '@capstone/shared';
import { AuthService } from '../auth/authService.js';
import { AppError } from '../errors/AppError.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validateBody.js';

export function createAuthRouter(service = new AuthService()): Router {
  const router = Router();

  router.post('/register', validateBody(registerRequestSchema), async (request, response) => {
    const user = await service.register(request.body.username, request.body.password);
    await regenerate(request);
    request.session.userId = user.id;
    response.status(201).json({ user });
  });

  router.post('/login', validateBody(loginRequestSchema), async (request, response) => {
    const user = await service.login(request.body.username, request.body.password);
    await regenerate(request);
    request.session.userId = user.id;
    response.json({ user });
  });

  router.post('/logout', requireAuth, async (request, response) => {
    await destroy(request);
    response.clearCookie('pawprint.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    response.status(204).end();
  });

  router.get('/me', requireAuth, async (request, response) => {
    response.json({ user: await service.currentUser(request.session.userId!) });
  });
  return router;
}

function regenerate(request: Request): Promise<void> {
  return new Promise((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()));
}

function destroy(request: Request): Promise<void> {
  return new Promise((resolve, reject) => request.session.destroy((error) => {
    if (error) reject(new AppError(500, 'LOGOUT_FAILED', 'Could not log out.'));
    else resolve();
  }));
}
