import { Router } from 'express';
import { floorLayoutRequestSchema } from '@capstone/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validateBody.js';
import { RoomService } from '../room/roomService.js';

export function createRoomRouter(service = new RoomService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/floor-layout', async (request, response) => {
    response.json({ placements: await service.floorLayout(request.session.userId!) });
  });
  router.put('/floor-layout', validateBody(floorLayoutRequestSchema), async (request, response) => {
    response.json({ placements: await service.saveFloorLayout(request.session.userId!, request.body.placements) });
  });
  return router;
}
