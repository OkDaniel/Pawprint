import express, { type Express } from 'express';
import path from 'node:path';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { env } from './config/env.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/health', healthRouter);

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
