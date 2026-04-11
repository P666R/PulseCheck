import type {
  HealthCheckResult,
  Lifecycle,
} from '#src/types/lifecycle.type.js';

import {
  DB_BASE_RETRY_DELAY_MS,
  DB_MAX_RETRIES,
  HEALTH_STATUS,
} from '#src/config/constants.js';
import { envConfig } from '#src/config/env.config.js';
import {
  InternalServerError,
  ServiceUnavailableError,
} from '#src/lib/api/server-error.api.js';
import { logger } from '#src/lib/logger/pino.logger.js';
import { adapter, PrismaClient } from '@repo/db';

/**
 * Database connection manager with lifecycle support.
 *
 * Implements the Lifecycle interface for consistent orchestration.
 *
 * Features:
 * - Exponential backoff retry on connection failure
 * - Interruptible retry loop for graceful shutdown
 * - Health check integration
 * - Event-based logging via Prisma lifecycle hooks
 */
class Database implements Lifecycle {
  private static instance: Database;
  private _isConnecting = false;
  private _isRunning = false;
  private readonly logger = logger.createChild({ service: 'Database' });
  private readonly prisma: PrismaClient<'error' | 'info' | 'query' | 'warn'>;
  private retryAttempts = 0;
  private shouldAbortRetry = false;

  constructor() {
    this.prisma = new PrismaClient({
      adapter,
      log: envConfig.isProd
        ? [
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
          ],
    });

    this.setupEventListeners();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Get the Prisma client instance for queries.
   * Only exposed for use in application code, not for lifecycle management.
   */
  public getClient(): PrismaClient {
    return this.prisma;
  }

  public health(): HealthCheckResult {
    let status: (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

    if (this._isRunning) {
      status = HEALTH_STATUS.HEALTHY;
    } else if (this._isConnecting) {
      status = HEALTH_STATUS.DEGRADED;
    } else {
      status = HEALTH_STATUS.UNHEALTHY;
    }

    return {
      component: 'database',
      details: {
        connected: this._isRunning,
        connecting: this._isConnecting,
        provider: 'postgresql',
      },
      status,
      timestamp: new Date().toISOString(),
    };
  }

  public isRunning(): boolean {
    return this._isRunning;
  }

  public async start(): Promise<void> {
    await this.connect();
  }

  public async stop(): Promise<void> {
    // Signal any pending retry to abort
    this.shouldAbortRetry = true;
    await this.disconnect();
  }

  private calculateBackoffDelay(): number {
    // Exponential backoff with jitter
    const exponentialDelay =
      DB_BASE_RETRY_DELAY_MS * Math.pow(2, this.retryAttempts - 1);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }

  private async connect(): Promise<void> {
    if (this._isRunning) {
      this.logger.debug('Prisma: Already connected');
      return;
    }

    if (this._isConnecting) {
      this.logger.debug('Prisma: Connection in progress');
      return;
    }

    // Reset abort flag on new connection attempt
    this.shouldAbortRetry = false;
    this._isConnecting = true;

    try {
      this.logger.debug('Prisma: Initializing connection');
      await this.prisma.$connect();

      // Verify connection with a simple query
      await this.prisma.$queryRaw`SELECT 1`;

      this._isRunning = true;
      this._isConnecting = false;
      this.retryAttempts = 0;

      this.logger.info('Prisma: Connected to database');
      this.logger.debug('Prisma: Initial connection successful');
    } catch (error: unknown) {
      this._isConnecting = false;
      await this.handleConnectionError(error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async disconnect(): Promise<void> {
    if (!this._isRunning) {
      this.logger.debug('Prisma: Already disconnected');
      return;
    }

    try {
      this.logger.debug('Prisma: Disconnecting from database');
      await this.prisma.$disconnect();

      this._isRunning = false;
      this.logger.info('Prisma: Disconnected gracefully');
    } catch (error: unknown) {
      const disconnectError = new InternalServerError(
        'Failed to disconnect from database gracefully',
        { connected: this._isRunning },
        { cause: error },
      );

      this.logger.error(
        { err: disconnectError },
        'Prisma: Error disconnecting',
      );

      throw disconnectError;
    }
  }

  private async handleConnectionError(error: unknown): Promise<void> {
    // Check if we should abort (shutdown in progress)
    if (this.shouldAbortRetry) {
      this.logger.warn('Prisma: Connection retry aborted due to shutdown');
      throw new ServiceUnavailableError(
        'Database connection aborted during shutdown',
        { attempts: this.retryAttempts },
        { cause: error },
      );
    }

    // Check if max retries reached
    if (this.retryAttempts >= DB_MAX_RETRIES) {
      const serviceError = new ServiceUnavailableError(
        'Database connection failed after maximum retries',
        {
          attempts: this.retryAttempts,
          maxRetries: DB_MAX_RETRIES,
        },
        { cause: error },
      );

      this.logger.fatal(
        { err: serviceError },
        'Prisma: Critical - Initial connection failed',
      );

      throw serviceError;
    }

    this.retryAttempts++;
    const delay = this.calculateBackoffDelay();

    this.logger.error(
      {
        attempts: this.retryAttempts,
        delayMs: delay,
        err: error,
        maxRetries: DB_MAX_RETRIES,
      },
      'Prisma: Connection failed, retrying...',
    );

    await this.delay(delay);
    return this.connect();
  }

  private setupEventListeners(): void {
    // Query logging (useful for development/debugging)
    this.prisma.$on('query', (e) => {
      this.logger.debug(
        {
          duration: e.duration,
          params: e.params,
          query: e.query,
        },
        'Prisma: Query executed',
      );
    });

    // Error logging
    this.prisma.$on('error', (e) => {
      this.logger.error(
        {
          message: e.message,
          target: e.target,
        },
        'Prisma: Database error',
      );
    });

    // Info logging
    this.prisma.$on('info', (e) => {
      this.logger.info(
        {
          message: e.message,
          target: e.target,
        },
        'Prisma: Database info',
      );
    });

    // Warning logging
    this.prisma.$on('warn', (e) => {
      this.logger.warn(
        {
          message: e.message,
          target: e.target,
        },
        'Prisma: Database warning',
      );
    });
  }
}

export const db = Database.getInstance();
