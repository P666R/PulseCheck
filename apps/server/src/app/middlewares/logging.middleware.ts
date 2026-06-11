import type { NextFunction, Request, Response } from 'express';
import type { Logger as PinoLogger } from 'pino';

import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import * as z from 'zod';

import { envConfig } from '#src/config/env.config.js';
import { AppError } from '#src/lib/api/app-error.api.js';
import { Logger } from '#src/lib/logger/pino.logger.js';
import { loggerStore } from '#src/lib/utils/context-provider.util.js';

const logger = Logger.getInstance(envConfig);

export const httpLoggingMiddleware = () => {
  const { isProd } = envConfig;
  const { errorSerializerDev, errorSerializerProd } = logger;

  const pino = pinoHttp({
    autoLogging: {
      ignore: (req: Request) => {
        const ignoredPaths = ['/health', '/metrics', '/favicon.ico'];
        return ignoredPaths.includes(req.url);
      },
    },
    customAttributeKeys: {
      err: 'err',
      req: 'req',
      res: 'res',
      responseTime: 'durationMs',
    },

    customReceivedMessage: () => '→ Incoming Request',

    customSuccessMessage: () => '← Request Completed',

    customErrorMessage: (_req, _res, err) => {
      let errorCode = 'UNKNOWN_ERROR';
      if (err instanceof z.ZodError) errorCode = 'VALIDATION_ERROR';
      if (err instanceof AppError) errorCode = err.errorCode;

      return `✗ Request Failed [${errorCode}]`;
    },

    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      // If the user did something wrong (4xx), it's just info to avoid alert fatigue
      if (res.statusCode >= 400) return 'info';
      return 'info';
    },

    // Ensure trace IDs are explicitly included in the log object
    customProps: (req) => ({
      requestId: req.id,
      correlationId: req.correlationId,
    }),

    genReqId: (req: Request, res: Response) => {
      const requestIdHeader = req.headers['x-request-id'];
      const correlationIdHeader = req.headers['x-correlation-id'];

      const requestId =
        (Array.isArray(requestIdHeader)
          ? requestIdHeader[0]
          : requestIdHeader) ?? randomUUID();

      const correlationId =
        (Array.isArray(correlationIdHeader)
          ? correlationIdHeader[0]
          : correlationIdHeader) ?? randomUUID();

      req.id = requestId;
      req.correlationId = correlationId;

      res.setHeader('X-Request-ID', requestId);
      res.setHeader('X-Correlation-ID', correlationId);

      return requestId;
    },

    // Uses the service-aware Proxy logger for HTTP access logs
    logger: logger.createChild({ service: 'HTTP' }),

    serializers: {
      err: isProd ? errorSerializerProd : errorSerializerDev,

      req: (req: Request) => ({
        contentLength: req.headers['content-length'],
        method: req.method,
        url: req.url,
      }),

      res: (res: Response) => ({
        statusCode: res.statusCode,
      }),
    },

    wrapSerializers: false,
  });

  return (req: Request, res: Response, next: NextFunction) => {
    // Manually trigger pino-http to ensure req.log and IDs are initialized
    pino(req, res);
    // Provide req.log to the store so createChild() proxies can access it
    loggerStore.run(req.log, () => next());
  };
};

/**
 * Updates the current request's logger with new context (e.g., userId).
 * Mutate the existing child bindings method on the base logger instance.
 */
export function enrichRequestLogger(
  req: Request,
  context: Record<string, unknown>,
): void {
  if (req.log) {
    const enrichedLogger = req.log.child(context);

    const newBindings = enrichedLogger.bindings();

    req.log.bindings = () => newBindings;
  }
}

export function getRequestLogger(req: Request): PinoLogger {
  return req.log;
}
