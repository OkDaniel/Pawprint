import { Router } from 'express';
import { devCoinGrantRequestSchema } from '@capstone/shared';
import { EconomyService } from '../economy/economyService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validateBody.js';

export function createDevCoinRouter(service = new EconomyService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.post('/grants', validateBody(devCoinGrantRequestSchema), async (request, response) => {
    response.status(201).json({ grant: await service.devGrant(
      request.session.userId!, request.body.amount, request.body.requestId,
    ) });
  });
  return router;
}
