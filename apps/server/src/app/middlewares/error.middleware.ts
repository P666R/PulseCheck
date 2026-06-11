import type { NextFunction, Request, Response } from 'express';
import type { ReqId } from 'pino-http';

import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';

import { STATUS } from '#src/config/constants.js';
import { envConfig } from '#src/config/env.config.js';
import { AppError, type AppErrorDetails } from '#src/lib/api/app-error.api.js';
import { NotFoundError } from '#src/lib/api/client-error.api.js';

interface ErrorResponse {
  requestId?: ReqId;
  correlationId?: string;
  errorCode: string;
  message: string;
  timestamp: string;
  details?: AppErrorDetails | null;
  stack?: string;
  cause?: unknown;
}

interface ExtractedErrorInfo {
  name: string;
  message: string;
  statusCode: number;
  status: STATUS;
  errorCode: string;
  isOperational: boolean;
  details: AppErrorDetails | null;
  timestamp: string;
  stack: string | null;
  cause: unknown;
}

export interface SerializedError {
  type: string;
  message: string;
  stack?: string;
  errorCode?: string;
  statusCode?: number;
  status?: STATUS;
  details?: AppErrorDetails;
  timestamp?: string;
  isOperational?: boolean;
  cause?: unknown;
}

const { isDev } = envConfig;

/**
 * Global Error Handling Middleware.
 * Processes all errors passed to next(err) and sends structured JSON responses.
 */
export const errorHandlerMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Set error on response for Pino-HTTP logger to pick up automatically
  res.err = err as Error;

  // Delegate to default Express handler if headers are already sent
  if (res.headersSent) return next(err);

  // Unify error data regardless of input type - App, native, unknown error
  const errorInfo = extractErrorInfo(err);

  // Build the clean public response object
  const response: ErrorResponse = {
    requestId: req.id,
    correlationId: req.correlationId,
    errorCode: errorInfo.errorCode,
    message: errorInfo.message,
    timestamp: errorInfo.timestamp,
  };

  // Include details only for operational (trusted) errors
  if (errorInfo.isOperational && errorInfo.details) {
    response.details = errorInfo.details;
  }

  // In development, include stack trace for debugging
  if (isDev && errorInfo.stack) {
    response.stack = errorInfo.stack;
    if (errorInfo.cause) {
      response.cause = errorInfo.cause;
    }
  }

  // Send response
  res.status(errorInfo.statusCode).json(response);
};

/**
 * 404 Handler for undefined routes.
 */
export const notFoundHandlerMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const error = new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`, {
    details: {
      method: req.method,
      path: req.originalUrl,
    },
  });
  next(error);
};

/**
 * Converts Error objects into plain JSON for logging/debugging.
 * Preserves custom AppError properties throughout the cause chain.
 */
const extractErrorInfo = (err: unknown): ExtractedErrorInfo => {
  const stack = err instanceof Error ? err.stack || null : null;
  const now = new Date().toISOString();
  const cause =
    err instanceof Error && err.cause ? serializeCause(err.cause) : null;

  // Handle ZodError (validation)
  if (err instanceof ZodError) {
    const { summary, details, type } = formatZodError(err);
    return {
      name: type,
      message: summary,
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      status: STATUS.WARN,
      errorCode: 'VALIDATION_ERROR',
      isOperational: true,
      details,
      timestamp: now,
      stack,
      cause,
    };
  }

  // Handle AppError (trusted operational errors)
  if (err instanceof AppError) {
    return {
      name: err.name,
      message: err.message,
      statusCode: err.statusCode,
      status: err.status,
      errorCode: err.errorCode,
      isOperational: err.isOperational,
      details: err.details ?? null,
      timestamp: err.timestamp,
      stack,
      cause,
    };
  }

  // Standard safe structural fallback mapping for generic unhandled system exceptions
  const isNativeError = err instanceof Error;
  return {
    name: isNativeError ? err.name : 'UnknownError',
    message: isNativeError
      ? err.message || 'An unexpected error occurred'
      : 'An unidentifiable error occurred',
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    status: STATUS.ERROR,
    errorCode: isNativeError ? 'INTERNAL_SERVER_ERROR' : 'UNKNOWN_ERROR',
    isOperational: false,
    details: isNativeError ? null : { raw: err },
    timestamp: now,
    stack,
    cause,
  };
};

/**
 * Recursively converts Error objects into plain JSON for logging/debugging.
 * Preserves custom AppError properties throughout the cause chain.
 */
const serializeCause = (cause: unknown): unknown => {
  if (!(cause instanceof Error)) return cause;

  const serialized: SerializedError = {
    type: cause.name,
    message: cause.message,
    stack: cause.stack,
  };

  if (cause instanceof AppError) {
    serialized.errorCode = cause.errorCode;
    serialized.statusCode = cause.statusCode;
    serialized.status = cause.status;
    serialized.details = cause.details;
    serialized.timestamp = cause.timestamp;
    serialized.isOperational = cause.isOperational;
  }

  // Recursively follow the error chain if a nested cause exists
  if ('cause' in cause && cause.cause) {
    serialized.cause = serializeCause(cause.cause);
  }

  return serialized;
};

/**
 * Format Zod validation errors.
 */
export const formatZodError = (error: ZodError) => {
  const summary = error.issues
    .map((iss) => `${iss.message} → ${iss.path.join('.')}`)
    .join('. ');

  return {
    summary,
    details: {
      issues: error.issues.map((iss) => ({
        code: iss.code,
        path: iss.path.join('.'),
        message: iss.message,
      })),
    },
    type: 'ValidationError',
  };
};
