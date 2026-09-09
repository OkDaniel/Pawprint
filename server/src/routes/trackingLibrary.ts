import { Router } from 'express';
import { customFactorRequestSchema, customFeelingRequestSchema, customSymptomRequestSchema, preferenceRequestSchema, symptomCategorySchema } from '@capstone/shared';
import { AppError } from '../errors/AppError.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validateBody.js';
import { TrackingLibraryService } from '../trackingLibrary/trackingLibraryService.js';

export function createTrackingLibraryRouter(service = new TrackingLibraryService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/feelings', async (request, response) => response.json({ feelings: await service.listFeelings(request.session.userId!) }));
  router.post('/feelings', validateBody(customFeelingRequestSchema), async (request, response) => {
    response.status(201).json({ feelings: await service.createFeeling(request.session.userId!, request.body.name) });
  });
  router.delete('/feelings/:id', async (request, response) => {
    response.json({ feelings: await service.deactivateFeeling(request.session.userId!, parseId(request.params.id)) });
  });
  router.put('/feelings/preferences', validateBody(preferenceRequestSchema), async (request, response) => {
    response.json({ feelings: await service.setFeelingPreferences(request.session.userId!, request.body.ids) });
  });
  router.get('/symptoms', async (request, response) => {
    const result = symptomCategorySchema.safeParse(request.query.category);
    if (!result.success) throw new AppError(400, 'INVALID_CATEGORY', 'Choose a valid symptom category.');
    response.json({ symptoms: await service.listSymptoms(request.session.userId!, result.data) });
  });
  router.post('/symptoms', validateBody(customSymptomRequestSchema), async (request, response) => {
    response.status(201).json({ symptoms: await service.createSymptom(request.session.userId!, request.body.name, request.body.category) });
  });
  router.delete('/symptoms/:id', async (request, response) => {
    const category = symptomCategorySchema.safeParse(request.query.category);
    if (!category.success) throw new AppError(400, 'INVALID_CATEGORY', 'Choose a valid symptom category.');
    response.json({ symptoms: await service.deactivateSymptom(request.session.userId!, parseId(request.params.id), category.data) });
  });
  router.put('/symptoms/preferences', validateBody(preferenceRequestSchema.extend({ category: symptomCategorySchema })), async (request, response) => {
    response.json({ symptoms: await service.setSymptomPreferences(request.session.userId!, request.body.category, request.body.ids) });
  });
  router.get('/factors', async (request, response) => response.json({ factors: await service.listFactors(request.session.userId!) }));
  router.post('/factors', validateBody(customFactorRequestSchema), async (request, response) => {
    response.status(201).json({ factors: await service.createFactor(request.session.userId!, request.body.name, request.body.category) });
  });
  router.delete('/factors/:id', async (request, response) => {
    response.json({ factors: await service.deactivateFactor(request.session.userId!, parseId(request.params.id)) });
  });
  router.put('/factors/preferences', validateBody(preferenceRequestSchema), async (request, response) => {
    response.json({ factors: await service.setFactorPreferences(request.session.userId!, request.body.ids) });
  });
  return router;
}

function parseId(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(400, 'INVALID_ID', 'Choose a valid item.');
  return id;
}
