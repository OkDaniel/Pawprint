import { Router } from 'express';
import { onboardingCompletionRequestSchema } from '@capstone/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validateBody.js';
import { OnboardingService } from '../onboarding/onboardingService.js';

export function createOnboardingRouter(service = new OnboardingService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.put('/complete', validateBody(onboardingCompletionRequestSchema), async (request, response) => {
    const user = await service.complete(request.session.userId!, request.body);
    response.json({ user });
  });
  return router;
}
