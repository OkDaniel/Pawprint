import { Router } from 'express';
import { createCheckInRequestSchema } from '@capstone/shared';
import { CheckInService } from '../checkIns/checkInService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validateBody.js';

export function createCheckInRouter(service = new CheckInService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (request, response) => {
    response.json({ checkIns: await service.list(request.session.userId!) });
  });
  router.post('/', validateBody(createCheckInRequestSchema), async (request, response) => {
    response.status(201).json({ checkIn: await service.create(request.session.userId!, request.body) });
  });
  return router;
}
