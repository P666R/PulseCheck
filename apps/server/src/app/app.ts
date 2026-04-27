import type { Express, Request, Response } from 'express';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import type {
  HealthCheckResult,
  Lifecycle,
} from '#src/types/lifecycle.type.js';

import { AuthMiddleware } from '#src/app/middlewares/check-auth.middleware.js';
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
import { HealthRoute } from '#src/modules/health/health.route.js';
import { StoreController } from '#src/modules/stores/stores.controller.js';
import { StoreRepository } from '#src/modules/stores/stores.repository.js';
import { StoreRouter } from '#src/modules/stores/stores.route.js';
import { StoreService } from '#src/modules/stores/stores.service.js';
import { UserController } from '#src/modules/users/users.controller.js';
import { UserRepository } from '#src/modules/users/users.repository.js';
import { UserRouter } from '#src/modules/users/users.route.js';
import { UserService } from '#src/modules/users/users.service.js';

type SharedDeps = ReturnType<App['initializeSharedDependencies']>;

export class App implements Lifecycle {
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
      status: this.isInitialized
        ? HEALTH_STATUS.HEALTHY
        : HEALTH_STATUS.UNHEALTHY,
      details: {
        configured: this.isConfigured,
        initialized: this.isInitialized,
      },
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
    const healthRoute = new HealthRoute();
    this.app.use('/health', healthRoute.router);
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

    const shared = this.initializeSharedDependencies();

    this.mountAuthRoutes(shared);
    this.mountUserRoutes(shared);
    this.mountStoresRoutes(shared);

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
    const allowedOrigins = envConfig.CORS_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    if (allowedOrigins.length === 0) {
      this.logger.warn('Express: No CORS origins configured for production');
      return [];
    }

    this.logger.debug(
      { origins: allowedOrigins },
      'Express: CORS origins configured',
    );

    return allowedOrigins;
  }

  private initializeSharedDependencies() {
    try {
      const authRepository = new AuthRepository();
      const authMiddleware = new AuthMiddleware(authRepository);
      const userRepository = new UserRepository();

      this.logger.debug('Express: Shared dependencies initialized');

      return { authRepository, userRepository, authMiddleware };
    } catch (error) {
      this.logger.error(
        { err: error },
        'Express: Failed to initialize shared dependencies',
      );
      throw new InternalServerError(
        'Failed to initialize shared dependencies',
        { module: 'shared' },
        { cause: error },
      );
    }
  }

  private createAuthRoutes(shared: SharedDeps) {
    const authService = new AuthService(shared.authRepository);
    const authController = new AuthController(authService);
    return new AuthRouter(authController, shared.authMiddleware).mountRoutes();
  }

  private mountAuthRoutes(shared: SharedDeps): void {
    this.safelyExecute(() => {
      this.app.use('/api/v1/auth', this.createAuthRoutes(shared));
    }, 'Auth route mounting');
  }

  private createUserRoutes(shared: SharedDeps) {
    const userService = new UserService(shared.userRepository);
    const userController = new UserController(userService);
    return new UserRouter(userController, shared.authMiddleware).mountRoutes();
  }

  private mountUserRoutes(shared: SharedDeps): void {
    this.safelyExecute(() => {
      this.app.use('/api/v1/users', this.createUserRoutes(shared));
    }, 'User route mounting');
  }

  private createStoresRoutes(shared: SharedDeps) {
    const storeRepository = new StoreRepository();
    const storeService = new StoreService(
      storeRepository,
      shared.userRepository,
    );
    const storeController = new StoreController(storeService);
    return new StoreRouter(
      storeController,
      shared.authMiddleware,
    ).mountRoutes();
  }

  private mountStoresRoutes(shared: SharedDeps): void {
    this.safelyExecute(() => {
      this.app.use('/api/v1/stores', this.createStoresRoutes(shared));
    }, 'Stores route mounting');
  }

  private safelyExecute<T>(operation: () => T, context: string): T {
    try {
      return operation();
    } catch (error) {
      this.logger.error({ err: error }, `Express: ${context} failed`);
      throw new InternalServerError(
        `${context} failed`,
        { module: context.toLowerCase() },
        { cause: error },
      );
    }
  }
}

export async function createApp() {
  const app = new App();
  await app.start();
  return app;
}
