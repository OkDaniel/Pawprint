import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { SleepService } from '../sleep/sleepService.js';

export function createSleepRouter(service = new SleepService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/current', async (request, response) => {
    response.json({ sleep: await service.current(request.session.userId!) });
  });
  router.get('/', async (request, response) => {
    response.json({ sleepEntries: await service.list(request.session.userId!) });
  });
  return router;
}
