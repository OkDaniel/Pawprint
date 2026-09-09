import { Router } from 'express';
import type { HealthResponse } from '@capstone/shared';

export const healthRouter: Router = Router();

healthRouter.get('/', (_request, response) => {
  const body: HealthResponse = {
    data: {
      status: 'ok',
      service: 'capstone-api',
      timestamp: new Date().toISOString(),
    },
  };

  response.json(body);
});
