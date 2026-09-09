import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please correct the submitted values.', details: error.issues } });
    return;
  }
  console.error('Unexpected request error', error);
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};
