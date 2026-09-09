import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';

export const requireAuth: RequestHandler = (request, _response, next) => {
  if (!request.session.userId) return next(new AppError(401, 'AUTH_REQUIRED', 'Please log in.'));
  next();
};
