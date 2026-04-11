import type { Request, Response } from 'express';
import type { Logger as PinoLogger } from 'pino';

import { type HttpLogger, pinoHttp } from 'pino-http';
import { v4 as uuidv4 } from 'uuid';

import { envConfig } from '#src/config/env.config.js';
import { AppError } from '#src/lib/api/app-error.api.js';
import { Logger } from '#src/lib/logger/pino.logger.js';

export function enrichRequestLogger(
  req: Request,
  context: Record<string, unknown>,
): void {
  req.log = req.log.child(context);
}

export function getRequestLogger(req: Request): PinoLogger {
  return req.log;
}

const logger = Logger.getInstance(envConfig);

export function httpLoggingMiddleware(): HttpLogger {
  const { isProd } = envConfig;
  const { errorSerializerDev, errorSerializerProd } = logger;

  return pinoHttp({
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

    customErrorMessage: (req, res, err) => {
      const errorCode = err instanceof AppError ? err.errorCode : 'UNKNOWN';
      return `✗ ${req.method} ${req.url} ${res.statusCode} [${errorCode}] ${err.message}`;
    },

    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },

    customProps: (req: Request) => ({
      correlationId: req.correlationId,
      requestId: req.id,
    }),

    customReceivedMessage: (req) => {
      return `→ ${req.method} ${req.url}`;
    },

    customSuccessMessage: (req, res) => {
      return `← ${req.method} ${req.url} ${res.statusCode}`;
    },

    genReqId: (req: Request, res: Response) => {
      const requestIdHeader = req.headers['x-request-id'];
      const correlationIdHeader = req.headers['x-correlation-id'];

      const requestId =
        (Array.isArray(requestIdHeader)
          ? requestIdHeader[0]
          : requestIdHeader) ?? uuidv4();

      const correlationId =
        (Array.isArray(correlationIdHeader)
          ? correlationIdHeader[0]
          : correlationIdHeader) ?? uuidv4();

      req.id = requestId;
      req.correlationId = correlationId;

      res.setHeader('X-Request-ID', requestId);
      res.setHeader('X-Correlation-ID', correlationId);

      return requestId;
    },

    logger: logger.createChild({
      service: 'HTTP',
    }),

    serializers: {
      err: isProd ? errorSerializerProd : errorSerializerDev,

      req: (req: Request) => ({
        contentLength: req.headers['content-length'],
        id: req.id,
        method: req.method,
        url: req.url,
      }),

      res: (res: Response) => ({
        statusCode: res.statusCode,
      }),
    },

    wrapSerializers: false,
  }) as HttpLogger;
}
