import express, { type Express } from 'express';
import path from 'node:path';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { env } from './config/env.js';
import { createSessionMiddleware } from './auth/session.js';
import { createAuthRouter } from './routes/auth.js';
import { createCheckInRouter } from './routes/checkIns.js';
import { createTrackingLibraryRouter } from './routes/trackingLibrary.js';
import { createSleepRouter } from './routes/sleep.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(createSessionMiddleware());
  app.use('/api/health', healthRouter);
  app.use('/api/auth', createAuthRouter());
  app.use('/api/check-ins', createCheckInRouter());
  app.use('/api/sleep', createSleepRouter());
  app.use('/api', createTrackingLibraryRouter());

  if (env.NODE_ENV === 'production') {
    const clientDist = path.resolve(process.cwd(), 'client/dist');
    app.use(express.static(clientDist));
    app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
      response.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
