import { Router } from 'express';
import { createCheckInRequestSchema, historyQuerySchema, updateCheckInRequestSchema } from '@capstone/shared';
import { AppError } from '../errors/AppError.js';
import { CheckInService } from '../checkIns/checkInService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validateBody.js';

export function createCheckInRouter(service = new CheckInService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (request, response) => {
    const range = historyQuerySchema.parse(request.query);
    response.json({ checkIns: await service.list(request.session.userId!, range) });
  });
  router.get('/:id', async (request, response) => {
    const id = parseId(request.params.id);
    const checkIn = await service.get(request.session.userId!, id);
    if (!checkIn) throw new AppError(404, 'CHECK_IN_NOT_FOUND', 'Check-In not found.');
    response.json({ checkIn });
  });
  router.post('/', validateBody(createCheckInRequestSchema), async (request, response) => {
    response.status(201).json({ checkIn: await service.create(request.session.userId!, request.body) });
  });
  router.put('/:id', validateBody(updateCheckInRequestSchema), async (request, response) => {
    response.json({ checkIn: await service.update(request.session.userId!, parseId(request.params.id), request.body) });
  });
  return router;
}

function parseId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'INVALID_ID', 'A valid Check-In ID is required.');
  return id;
}
