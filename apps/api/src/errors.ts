import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = response.locals.requestId as string;
  if (error instanceof ZodError) {
    response.status(400).json({ code: 'INVALID_REQUEST', message: 'Request validation failed', details: error.flatten() });
    return;
  }
  if (error instanceof AppError) {
    response.status(error.status).json({ code: error.code, message: error.message });
    return;
  }
  console.error(JSON.stringify({ level: 'error', requestId, message: 'Unexpected server error', errorType: error instanceof Error ? error.name : typeof error }));
  response.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId });
};

export function asyncRoute<T extends (...args: any[]) => Promise<unknown>>(handler: T) {
  return (...args: Parameters<T>): void => {
    void handler(...args).catch(args[2]);
  };
}
