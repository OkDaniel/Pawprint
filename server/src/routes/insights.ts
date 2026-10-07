import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { InsightsService } from '../insights/insightsService.js';

export function createInsightsRouter(service = new InsightsService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/mood-trend', async (request, response) => {
    response.json(await service.moodTrend(request.session.userId!));
  });
  return router;
}
