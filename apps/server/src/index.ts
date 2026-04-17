import type {
  CleanupError,
  HealthCheckResult,
  Lifecycle,
} from '#src/types/lifecycle.type.js';

import {
  APP_SHUTDOWN_TIMEOUT_MS,
  EXIT_CODES,
  HEALTH_STATUS,
} from '#src/config/constants.js';
import { AppError } from '#src/lib/api/app-error.api.js';
import { logger } from '#src/lib/logger/pino.logger.js';
import { db } from '#src/lib/prisma/client.prisma.js';
import { Server } from '#src/server.js';

/**
 * Application orchestrator for lifecycle management.
 *
 * Responsibilities:
 * - Initialize and start infrastructure components in dependency order
 * - Handle process signals for graceful shutdown
 * - Coordinate cleanup of all components in reverse dependency order
 *
 * Design:
 * - Single responsibility: orchestration only
 * - Components implement Lifecycle interface
 * - Error handling distinguishes operational vs programmer errors
 */
class PulseCheck {
  // Infrastructure components (ordered by startup dependency)
  private readonly components = new Map<string, Lifecycle>();
  private isShuttingDown = false;
  private readonly logger = logger.createChild({
    service: 'Application',
  });

  public async run(): Promise<void> {
    try {
      this.logger.info('Application: Initializing');

      this.setupProcessHandlers();
      await this.startup();

      this.logger.info('Application: Startup completed');
      applicationHealthGetter = () => this.health();
    } catch (error) {
      this.logError(error, 'Startup');
      await this.shutdown('STARTUP_FAILURE', EXIT_CODES.STARTUP_FAILURE);
    }
  }

  public health(): HealthCheckResult {
    const componentHealths: HealthCheckResult[] = [];

    for (const [name, component] of this.components) {
      try {
        if (typeof component.health === 'function') {
          componentHealths.push(component.health());
        }
      } catch {
        componentHealths.push({
          component: name,
          status: HEALTH_STATUS.UNHEALTHY,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const hasUnhealthy = componentHealths.some(
      (h) => h.status === HEALTH_STATUS.UNHEALTHY,
    );
    const hasDegraded = componentHealths.some(
      (h) => h.status === HEALTH_STATUS.DEGRADED,
    );

    const degradedStatus = hasDegraded
      ? HEALTH_STATUS.DEGRADED
      : HEALTH_STATUS.HEALTHY;

    const overallStatus = hasUnhealthy
      ? HEALTH_STATUS.UNHEALTHY
      : degradedStatus;

    return {
      component: 'application',
      status: overallStatus,
      details: {
        isShuttingDown: this.isShuttingDown,
        uptimeMs: Math.trunc(process.uptime() * 1000),
      },
      timestamp: new Date().toISOString(),
      components: componentHealths,
    };
  }

  /**
   * Cleanup components in reverse dependency order (LIFO).
   * Collects all errors without stopping on first failure.
   */
  private async cleanup(): Promise<CleanupError[]> {
    const errors: CleanupError[] = [];

    // Convert to array and reverse for LIFO order
    const componentsArray = Array.from(this.components.entries()).reverse();

    for (const [name, component] of componentsArray) {
      try {
        this.logger.debug({ component: name }, `Application: Stopping ${name}`);
        await component.stop();
        this.logger.debug({ component: name }, `Application: Stopped ${name}`);
      } catch (error) {
        errors.push(this.createCleanupError(name, error));
      }
    }

    return errors;
  }

  private createCleanupError(component: string, error: unknown): CleanupError {
    const isOperational = error instanceof AppError;
    const err = error instanceof Error ? error : new Error(String(error));

    this.logger.error(
      { component, err, isOperational },
      `Application: Failed to stop ${component}`,
    );

    return { component, error: err, isOperational };
  }

  private logError(error: unknown, phase: 'Shutdown' | 'Startup'): void {
    const isOperational = error instanceof AppError && error.isOperational;
    const logMethod = phase === 'Startup' ? 'fatal' : 'error';

    this.logger[logMethod](
      { err: error, isOperational },
      `Application: ${phase} failed with ${isOperational ? 'operational' : 'unexpected'} error`,
    );
  }

  private reportCleanupErrors(errors: CleanupError[]): void {
    const summary = errors.map((e) => ({
      component: e.component,
      isOperational: e.isOperational,
      message: e.error.message,
    }));

    const operationalCount = errors.filter((e) => e.isOperational).length;

    this.logger.error(
      {
        errors: summary,
        operational: operationalCount,
        programmer: errors.length - operationalCount,
        total: errors.length,
      },
      `Application: Cleanup completed with ${errors.length} error(s)`,
    );
  }

  private setupProcessHandlers(): void {
    // Graceful shutdown signals
    process.once('SIGINT', () => {
      void this.shutdown('SIGINT');
    });

    process.once('SIGTERM', () => {
      void this.shutdown('SIGTERM');
    });

    // Programmer errors - these indicate bugs
    process.on('uncaughtException', (error: Error) => {
      this.logger.fatal(
        {
          err: error,
          isOperational: error instanceof AppError && error.isOperational,
          type: 'uncaughtException',
        },
        'Application: Uncaught exception - this is a programmer error',
      );

      void this.shutdown('UNCAUGHT_EXCEPTION', EXIT_CODES.UNCAUGHT_EXCEPTION);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));

      this.logger.fatal(
        {
          err: error,
          isOperational: error instanceof AppError && error.isOperational,
          type: 'unhandledRejection',
        },
        'Application: Unhandled rejection - this is a programmer error',
      );

      void this.shutdown('UNHANDLED_REJECTION', EXIT_CODES.UNHANDLED_REJECTION);
    });

    this.logger.debug('Application: Process handlers registered');
  }

  private async shutdown(
    signal: string,
    exitCode: number = EXIT_CODES.SUCCESS,
  ): Promise<never> {
    if (this.isShuttingDown) {
      this.logger.warn(
        { signal },
        'Application: Shutdown already in progress, ignoring',
      );
      // Wait indefinitely - first shutdown will handle exit
      await new Promise(() => {
        /* empty */
      });
      throw new Error('Unreachable');
    }

    this.isShuttingDown = true;
    this.logger.info({ signal }, 'Application: Initiating graceful shutdown');

    const timeoutId = this.startShutdownTimer();

    try {
      const errors = await this.cleanup();
      clearTimeout(timeoutId);

      if (errors.length > 0) {
        this.reportCleanupErrors(errors);
        exitCode = EXIT_CODES.GENERAL_ERROR;
      }

      this.logger.info(
        { exitCode },
        'Application: Graceful shutdown completed',
      );
    } catch (error) {
      clearTimeout(timeoutId);
      this.logError(error, 'Shutdown');
      exitCode = EXIT_CODES.GENERAL_ERROR;
    }

    process.exit(exitCode);
  }

  private startShutdownTimer(): NodeJS.Timeout {
    return setTimeout(() => {
      this.logger.fatal(
        { timeoutMs: APP_SHUTDOWN_TIMEOUT_MS },
        'Application: Shutdown timeout exceeded, forcing exit',
      );
      process.exit(EXIT_CODES.SHUTDOWN_TIMEOUT);
    }, APP_SHUTDOWN_TIMEOUT_MS);
  }

  private async startup(): Promise<void> {
    // Start components in dependency order
    this.logger.debug('Application: Starting database');
    await db.start();
    this.components.set('database', db);

    this.logger.debug('Application: Starting HTTP server');
    const server = new Server();
    await server.start();
    this.components.set('server', server);
    if (server.appInstance) {
      this.components.set('express', server.appInstance);
    }
  }
}

let applicationHealthGetter: (() => HealthCheckResult) | null = null;

export const getApplicationHealth = (): HealthCheckResult => {
  if (!applicationHealthGetter) {
    return {
      component: 'pulsecheck',
      status: HEALTH_STATUS.UNHEALTHY,
      timestamp: new Date().toISOString(),
    };
  }
  return applicationHealthGetter();
};

// Start the application
await new PulseCheck().run();
