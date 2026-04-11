import type { NextFunction, Request, Response } from 'express';
import type { ReqId } from 'pino-http';

import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';

import { envConfig } from '#src/config/env.config.js';
import { AppError, type AppErrorDetails } from '#src/lib/api/app-error.api.js';
import { NotFoundError } from '#src/lib/api/client-error.api.js';

interface ErrorResponse {
  requestId?: ReqId;
  correlationId?: string;
  errorCode: string;
  message: string;
  status: string;
  timestamp: string;
  details?: AppErrorDetails | null;
  stack?: string;
  cause?: unknown;
}

interface ExtractedErrorInfo {
  name: string;
  message: string;
  statusCode: number;
  status: string;
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
  status?: string;
  details?: AppErrorDetails;
  timestamp?: string;
  isOperational?: boolean;
  cause?: unknown;
}

const { isDev } = envConfig;

export const errorHandlerMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.err = err as Error;

  if (res.headersSent) return next(err);

  const errorInfo = extractErrorInfo(err);

  const response: ErrorResponse = {
    requestId: req.id,
    correlationId: req.correlationId,
    errorCode: errorInfo.errorCode,
    message: errorInfo.message,
    status: errorInfo.status,
    timestamp: errorInfo.timestamp,
  };

  if (errorInfo.isOperational && errorInfo.details) {
    response.details = errorInfo.details;
  }

  if (isDev && errorInfo.stack) {
    response.stack = errorInfo.stack;
    if (errorInfo.cause) {
      response.cause = errorInfo.cause;
    }
  }

  res.status(errorInfo.statusCode).json(response);
};

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

const extractErrorInfo = (err: unknown): ExtractedErrorInfo => {
  const stack = err instanceof Error ? err.stack || null : null;
  const now = new Date().toISOString();
  const cause =
    err instanceof Error && err.cause ? serializeCause(err.cause) : null;

  if (err instanceof ZodError) {
    const { summary, details } = formatZodError(err);
    return {
      name: 'ValidationError',
      message: summary,
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      status: 'warn',
      errorCode: 'VALIDATION_ERROR',
      isOperational: true,
      details,
      timestamp: now,
      stack,
      cause,
    };
  }

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

  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message || 'An unexpected error occurred',
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: 'error',
      errorCode: 'INTERNAL_SERVER_ERROR',
      isOperational: false,
      details: null,
      timestamp: now,
      stack,
      cause,
    };
  }

  return {
    name: 'UnknownError',
    message: 'An unidentifiable error occurred',
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    status: 'error',
    errorCode: 'UNKNOWN_ERROR',
    isOperational: false,
    details: { raw: err } as AppErrorDetails,
    timestamp: now,
    stack,
    cause,
  };
};

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

  if (cause.cause) {
    serialized.cause = serializeCause(cause.cause);
  }

  return serialized;
};

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
