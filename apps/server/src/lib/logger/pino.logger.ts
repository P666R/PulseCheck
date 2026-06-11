import type { Bindings, LoggerOptions, Logger as PinoLogger } from 'pino';

import { StatusCodes } from 'http-status-codes';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { ZodError } from 'zod';

import type { SerializedError } from '#src/app/middlewares/error.middleware.js';

import { formatZodError } from '#src/app/middlewares/error.middleware.js';
import { STATUS } from '#src/config/constants.js';
import { envConfig, type EnvConfig } from '#src/config/env.config.js';
import { loggerStore } from '#src/lib/utils/context-provider.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logDir = join(__dirname, '../../../logs');

interface InternalAppError extends Error {
  statusCode?: number;
  errorCode?: string;
  isOperational?: boolean;
  details?: Record<string, unknown>;
  timestamp?: string;
  status?: STATUS;
  cause?: unknown;
}

export class Logger {
  private static instance: Logger;
  private readonly logger: PinoLogger;
  private readonly isDev: boolean = envConfig.isDev;

  private constructor(envConfig: EnvConfig) {
    this.zodErrorSerializer = this.zodErrorSerializer.bind(this);
    this.errorSerializerDev = this.errorSerializerDev.bind(this);
    this.errorSerializerProd = this.errorSerializerProd.bind(this);
    this.logger = this.createLogger(envConfig);
  }

  public zodErrorSerializer(error: ZodError): SerializedError {
    const { summary, details, type } = formatZodError(error);
    return {
      message: summary,
      ...(this.isDev && error.stack && { stack: error.stack }),
      type,
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      errorCode: 'VALIDATION_ERROR',
      isOperational: true,
      details,
    };
  }

  // Error serializer for development environment
  public errorSerializerDev(error: unknown): SerializedError {
    if (error instanceof ZodError) {
      return this.zodErrorSerializer(error);
    }

    const err = error as InternalAppError;
    const base: SerializedError = {
      type: err.name,
      message: err.message,
      stack: err.stack,
      errorCode: err.errorCode,
      statusCode: err.statusCode,
      status: err.status,
      details: err.details,
      timestamp: err.timestamp,
      isOperational: err.isOperational,
    };

    // Recursively serialize a cause chain if it exists
    if (err.cause) {
      base['cause'] =
        err.cause instanceof Error
          ? this.errorSerializerDev(err.cause)
          : err.cause;
    }

    return base;
  }

  // Error serializer for production environment
  public errorSerializerProd(error: unknown): SerializedError {
    if (error instanceof ZodError) {
      return this.zodErrorSerializer(error);
    }

    const err = error as InternalAppError;
    const base: SerializedError = {
      message: err.message,
      type: err.name,
    };

    // Preserve known custom fields
    if (err.statusCode) base['statusCode'] = err.statusCode;
    if (err.errorCode) base['errorCode'] = err.errorCode;
    if (err.isOperational) base['isOperational'] = err.isOperational;
    if (err.status) base['status'] = err.status;

    // Include details only for operational (4xx) errors
    if (err.details && err.isOperational) base['details'] = err.details;

    // Include stack trace only for server (5xx) errors in production
    if (err.statusCode && err.statusCode >= 500) {
      base['stack'] = err.stack;

      // Capture error cause chain
      if (err.cause) {
        base['cause'] =
          err.cause instanceof Error
            ? this.errorSerializerProd(err.cause)
            : err.cause;
      }
    }

    return base;
  }

  private createLogger(envConfig: EnvConfig): PinoLogger {
    const { isDev, isProd, isTest, NODE_ENV, APP_VERSION, LOG_LEVEL } =
      envConfig;

    const basePinoConfig: LoggerOptions = {
      enabled: !isTest,
      level: LOG_LEVEL,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        bindings: ({ hostname, pid }) => ({
          pid,
          hostname,
          env: NODE_ENV,
          version: APP_VERSION,
        }),
      },
      serializers: {
        err: isProd ? this.errorSerializerProd : this.errorSerializerDev,
      },
    };

    if (isDev) {
      basePinoConfig.transport = {
        targets: [
          {
            level: LOG_LEVEL,
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'yyyy-mm-dd HH:MM:ss',
              ignore: 'pid,hostname',
              errorProps: 'statusCode,errorCode,details,cause',
            },
          },
          {
            level: LOG_LEVEL,
            target: 'pino-roll',
            options: {
              dateFormat: 'yyyy-MM-dd-hh',
              file: join(logDir, 'dev'),
              frequency: 'daily',
              size: '10m',
              limit: { count: 7 },
              extension: '.jsonl',
              mkdir: true,
            },
          },
        ],
        worker: { autoEnd: true },
      };
    }

    if (isProd) {
      basePinoConfig.transport = {
        targets: [
          // Stdout for cloud collectors
          {
            level: LOG_LEVEL,
            target: 'pino/file',
            options: { destination: 1 },
          },
          // Rotating file for on‑disk backup
          {
            level: LOG_LEVEL,
            target: 'pino-roll',
            options: {
              dateFormat: 'yyyy-MM-dd-hh',
              file: join(logDir, 'prod'),
              frequency: 'daily',
              size: '10m',
              limit: { count: 7 },
              extension: '.jsonl',
              mkdir: true,
            },
          },
        ],
        worker: { autoEnd: true },
      };

      basePinoConfig.redact = {
        paths: [
          // Sensitive fields
          '*.password',
          '*.token',
          '*.apiKey',
          '*.secret',
          '*.accessToken',
          '*.refreshToken',
          '*.privateKey',

          // HTTP headers
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'res.headers["set-cookie"]',

          // Request body fields
          'req.body.password',
          'req.body.token',
          'req.body.passwordConfirm',
          'req.validatedData.body.password',
          'req.validatedData.body.token',
          'req.validatedData.body.passwordConfirm',
        ],
        censor: '[REDACTED]',
      };
    }

    const instance = pino(basePinoConfig);

    instance
      .child({ service: 'Logger' })
      .info(`Logger: initialized [env: ${NODE_ENV}, level: ${LOG_LEVEL}]`);

    return instance;
  }

  public static getInstance(envConfig: EnvConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(envConfig);
    }
    return Logger.instance;
  }

  /**
   * Creates a context-aware child logger using a Memoized Proxy.
   * Merges static service data with dynamic trace IDs from AsyncLocalStorage.
   */
  public createChild(bindings: Bindings): PinoLogger {
    const childLogger = this.logger.child(bindings);

    // WeakMap ensures cached loggers are garbage collected when request ends
    const requestCache = new WeakMap<object, PinoLogger>();

    return new Proxy<PinoLogger>(childLogger, {
      get(target, prop, receiver) {
        const requestLogger = loggerStore.getStore();

        // 1. Context fallback (outside of HTTP requests)
        if (!requestLogger) {
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        }

        // 2. Check cache to avoid redundant .child() calls for same request
        let traceLogger = requestCache.get(requestLogger);

        if (!traceLogger) {
          // 3. Only extract tracing IDs etc, discard req/res objects
          const allBindings = (requestLogger as PinoLogger).bindings();
          const { req: _, res: __, ...cleanContext } = allBindings;

          // 4. Create the tracing child once per request/service combination
          traceLogger = target.child(cleanContext);
          requestCache.set(requestLogger, traceLogger);
        }

        const value = Reflect.get(traceLogger, prop, receiver);
        return typeof value === 'function' ? value.bind(traceLogger) : value;
      },
    });
  }
}

export const logger = Logger.getInstance(envConfig);
