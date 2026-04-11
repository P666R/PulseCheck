import type { Express, NextFunction, Request, Response } from 'express';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import type {
  HealthCheckResult,
  Lifecycle,
} from '#src/types/lifecycle.type.js';

import {
  errorHandlerMiddleware,
  notFoundHandlerMiddleware,
} from '#src/app/middlewares/error.middleware.js';
import { httpLoggingMiddleware } from '#src/app/middlewares/logging.middleware.js';
import { HEALTH_STATUS } from '#src/config/constants.js';
import { envConfig } from '#src/config/env.config.js';
import { InternalServerError } from '#src/lib/api/server-error.api.js';
import { logger } from '#src/lib/logger/pino.logger.js';
import { AuthController } from '#src/modules/auth/auth.controller.js';
import { AuthRepository } from '#src/modules/auth/auth.repository.js';
import { AuthRouter } from '#src/modules/auth/auth.route.js';
import { AuthService } from '#src/modules/auth/auth.service.js';

import { AuthMiddleware } from './middlewares/check-auth.middleware.js';

export class Application implements Lifecycle {
  private readonly app: Express;
  private isConfigured = false;
  private isInitialized = false;
  private readonly logger = logger.createChild({ service: 'Express' });

  constructor() {
    this.app = express();
  }

  public getApp(): Express {
    if (!this.isInitialized) {
      const error = new InternalServerError(
        'Express: Cannot get app before initialization',
      );
      this.logger.error({ err: error }, 'Express: Invalid state access');
      throw error;
    }

    return this.app;
  }

  public health(): HealthCheckResult {
    return {
      component: 'express',
      details: {
        configured: this.isConfigured,
        initialized: this.isInitialized,
      },
      status: this.isInitialized
        ? HEALTH_STATUS.HEALTHY
        : HEALTH_STATUS.UNHEALTHY,
      timestamp: new Date().toISOString(),
    };
  }

  public isRunning(): boolean {
    return this.isInitialized;
  }

  public async start(): Promise<void> {
    if (this.isInitialized) {
      this.logger.debug('Express: Already initialized');
      return;
    }

    try {
      this.logger.debug('Express: Starting initialization');
      this.configure();
      this.isInitialized = true;
      this.logger.info('Express: Initialized successfully');
    } catch (error: unknown) {
      const initError = new InternalServerError(
        'Express: Failed to initialize application',
        { configured: this.isConfigured },
        { cause: error },
      );
      this.logger.error({ err: initError }, 'Express: Initialization failed');
      throw initError;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isInitialized) {
      this.logger.debug('Express: Not initialized, nothing to stop');
      return;
    }

    try {
      this.logger.debug('Express: Stopping application');

      // Future: Add cleanup tasks here if needed
      // - Close database connections managed by app
      // - Clear caches
      // - Cancel background jobs

      this.isInitialized = false;
      this.logger.info('Express: Application stopped');
    } catch (error: unknown) {
      const stopError = new InternalServerError(
        'Express: Failed to stop application',
        { initialized: this.isInitialized },
        { cause: error },
      );

      this.logger.error({ err: stopError }, 'Express: Stop failed');
      throw stopError;
    }
  }

  /**
   * Configure all Express middleware and routes.
   * Order is critical for correct request processing.
   *
   * Middleware Order:
   * 1. Health check (before logging)
   * 2. Security headers
   * 3. Request parsing
   * 4. HTTP logging
   * 5. Application routes
   * 6. Sentry error handler
   * 7. Custom error handlers
   */
  private configure(): void {
    if (this.isConfigured) {
      this.logger.warn('Express: Already configured, skipping');
      return;
    }

    // Configuration order matters - do not rearrange
    this.configureHealthCheck(); // 1. Health before logging
    this.configureSecurity(); // 2. Security headers first
    this.configureMiddleware(); // 3. Request parsing
    this.configureLogging(); // 4. Log parsed requests
    this.configureRoutes(); // 5. Application routes
    this.configureErrorHandling(); // 7. Custom error handlers (must be last)

    this.isConfigured = true;
    this.logger.debug('Express: Configuration completed');
  }

  private configureErrorHandling(): void {
    this.app.use(notFoundHandlerMiddleware);

    this.app.use(errorHandlerMiddleware);
  }

  private configureHealthCheck(): void {
    this.app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    });
  }

  private configureLogging(): void {
    this.app.use(httpLoggingMiddleware());
  }

  private configureMiddleware(): void {
    // Request body parsing
    this.app.use(express.json({ limit: '5mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '5mb' }));
    this.app.use(cookieParser());

    // Response compression
    this.app.use(compression());

    // Request timeout protection
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      req.setTimeout(30_000, () => {
        this.logger.warn(
          { method: req.method, url: req.url },
          'Express: Request timeout',
        );
      });
      next();
    });
  }

  private configureRoutes(): void {
    // Root endpoint
    this.app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({
        message: 'API is running',
        timestamp: new Date().toISOString(),
        version: envConfig.APP_VERSION,
      });
    });

    // User routes with dependency injection
    this.mountUserRoutes();
    this.logger.debug('Express: Routes configured');
  }

  private configureSecurity(): void {
    // Security headers via Helmet
    this.app.use(
      helmet({
        contentSecurityPolicy: envConfig.isProd,
        crossOriginEmbedderPolicy: envConfig.isProd,
      }),
    );

    // CORS configuration
    this.app.use(
      cors({
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Correlation-Id',
          'X-Request-Id',
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        origin: this.getCorsOrigin(),
      }),
    );

    // Remove X-Powered-By header
    this.app.disable('x-powered-by');
  }

  private getCorsOrigin(): boolean | string | string[] {
    if (envConfig.isDev) {
      return true;
    }

    // Production: parse allowed origins from environment
    const allowedOrigins =
      envConfig.CORS_ALLOWED_ORIGINS === ''
        ? []
        : envConfig.CORS_ALLOWED_ORIGINS.split(',');

    if (allowedOrigins.length === 0) {
      this.logger.warn(
        'Express: No CORS origins configured for production, allowing all',
      );
      return true;
    }

    this.logger.debug(
      { origins: allowedOrigins },
      'Express: CORS origins configured',
    );

    return allowedOrigins;
  }

  /**
   * Mount user routes with dependency injection.
   *
   * Pattern: Repository → Service → Controller → Route
   * - Repository: Data access layer
   * - Service: Business logic layer
   * - Controller: Request handling layer
   * - Route: Route definition layer
   */
  private mountUserRoutes(): void {
    try {
      // Dependency injection chain
      const authRepository = new AuthRepository();
      const authService = new AuthService(authRepository);
      const authController = new AuthController(authService);
      const authMiddleware = new AuthMiddleware(authRepository);
      const authRouter = new AuthRouter(authController, authMiddleware);

      // Mount routes
      this.app.use('/api/v1/auth', authRouter.mountRoutes());
      this.logger.info('Express: Auth routes mounted successfully');
    } catch (error) {
      this.logger.error({ err: error }, 'Express: Failed to mount user routes');
      throw new InternalServerError(
        'Failed to mount user routes',
        { module: 'users' },
        { cause: error },
      );
    }
  }
}

export async function createApp(): Promise<Express> {
  const app = new Application();
  await app.start();
  return app.getApp();
}
