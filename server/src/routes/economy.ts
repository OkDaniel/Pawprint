import { Router } from 'express';
import { inventoryVariantRequestSchema, purchaseRequestSchema } from '@capstone/shared';
import { EconomyService } from '../economy/economyService.js';
import { AppError } from '../errors/AppError.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validateBody.js';
import { catalogProducts } from '../economy/catalog.js';

export function createEconomyRouter(service = new EconomyService(), devCoinGrantsEnabled = false): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/catalog', (_request, response) => {
    response.json({ products: catalogProducts.map(({ id, kind, price, purchasable, retired }) =>
      ({ id, kind, price, purchasable, retired })), devCoinGrantsEnabled });
  });
  router.get('/coats', async (request, response) => {
    response.json({ coats: await service.ownedCoats(request.session.userId!) });
  });
  router.get('/wallet', async (request, response) => {
    response.json({ wallet: await service.wallet(request.session.userId!) });
  });
  router.post('/sync', async (request, response) => {
    response.json(await service.syncRecentRewards(request.session.userId!));
  });
  router.post('/purchases', validateBody(purchaseRequestSchema), async (request, response) => {
    const purchase = await service.purchase(request.session.userId!, request.body.productId, request.body.requestId);
    response.status(201).json({ purchase });
  });
  router.get('/inventory', async (request, response) => {
    response.json({ inventory: await service.inventory(request.session.userId!) });
  });
  router.patch('/inventory/:id/variant', validateBody(inventoryVariantRequestSchema), async (request, response) => {
    response.json({ instance: await service.updateInventoryVariant(
      request.session.userId!, parseId(request.params.id), request.body.variantId,
    ) });
  });
  return router;
}

function parseId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'INVALID_ID', 'A valid inventory instance ID is required.');
  return id;
}
