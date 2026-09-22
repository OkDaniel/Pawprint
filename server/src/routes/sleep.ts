import { Router } from 'express';
import { historyQuerySchema, logicalDateSchema, sleepInputSchema } from '@capstone/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { SleepService } from '../sleep/sleepService.js';
import { validateBody } from '../middleware/validateBody.js';
import { AppError } from '../errors/AppError.js';

export function createSleepRouter(service = new SleepService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/current', async (request, response) => {
    response.json({ sleep: await service.current(request.session.userId!) });
  });
  router.get('/', async (request, response) => {
    response.json({ sleepEntries: await service.list(request.session.userId!, historyQuerySchema.parse(request.query)) });
  });
  router.get('/:logicalDate', async (request, response) => {
    const logicalDate = parseLogicalDate(request.params.logicalDate);
    const sleep = await service.get(request.session.userId!, logicalDate);
    if (!sleep) throw new AppError(404, 'SLEEP_NOT_FOUND', 'Sleep entry not found.');
    response.json({ sleep });
  });
  router.put('/:logicalDate', validateBody(sleepInputSchema), async (request, response) => {
    response.json({ sleep: await service.update(request.session.userId!, parseLogicalDate(request.params.logicalDate), request.body) });
  });
  return router;
}

function parseLogicalDate(value: unknown): string {
  const result = logicalDateSchema.safeParse(value);
  if (!result.success) throw new AppError(400, 'INVALID_LOGICAL_DATE', 'A valid logical date is required.');
  return result.data;
}
