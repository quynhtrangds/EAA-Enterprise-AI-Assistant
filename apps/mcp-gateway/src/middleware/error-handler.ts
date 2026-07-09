import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('[Error Handler Log]:', error);
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      errorCode: error.code,
      message: error.message
    });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      errorCode: 'INVALID_TOOL_INPUT',
      message: error.issues[0]?.message ?? 'Invalid input'
    });
    return;
  }

  res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_ERROR',
    message: 'Internal server error'
  });
};
