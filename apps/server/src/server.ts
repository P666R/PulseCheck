import type { Express } from 'express';
import type { AddressInfo } from 'node:net';

import http from 'node:http';
import os from 'node:os';

import type { App } from '#src/app/app.js';
import type {
  HealthCheckResult,
  Lifecycle,
} from '#src/types/lifecycle.type.js';

import { createApp } from '#src/app/app.js';
import {
  HEALTH_STATUS,
  SERVER_CLOSE_TIMEOUT_MS,
  SERVER_DRAIN_TIMEOUT_MS,
} from '#src/config/constants.js';
import { envConfig } from '#src/config/env.config.js';
import {
  InternalServerError,
  ServiceUnavailableError,
} from '#src/lib/api/server-error.api.js';
import { logger } from '#src/lib/logger/pino.logger.js';

/**
 * HTTP Server with lifecycle management.
 *
 * Implements the Lifecycle interface for consistent startup/shutdown orchestration.
 *
 * Features:
 * - Graceful shutdown with connection draining
 * - Health check integration
 * - Shutdown-aware request handling
 * - Timeout protection for server operations
 */
export class Server implements Lifecycle {
  private _isRunning = false;
  private _isShuttingDown = false;
  appInstance?: App;
  private app?: Express;
  private readonly logger = logger.createChild({ service: 'Server' });
  private readonly NODE_ENV = envConfig.NODE_ENV;
  private readonly PORT = envConfig.PORT;
  private server?: http.Server;

  /**
   * Get the health status of the server.
   */
  public health(): HealthCheckResult {
    const addressInfo = this.server?.address();
    const isPortBound = addressInfo !== null && addressInfo !== undefined;

    const appHealth = this.appInstance?.health();

    let status: HEALTH_STATUS = HEALTH_STATUS.HEALTHY;
    if (this._isShuttingDown) status = HEALTH_STATUS.SHUTTING_DOWN;
    else if (!this._isRunning || !isPortBound) status = HEALTH_STATUS.UNHEALTHY;
    else if (appHealth && appHealth.status !== HEALTH_STATUS.HEALTHY) {
      status = appHealth.status;
    }

    return {
      component: 'server',
      status,
      details: {
        ...(addressInfo as AddressInfo),
        isPortBound,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if the server is currently running.
   */
  public isRunning(): boolean {
    return this._isRunning && !this._isShuttingDown;
  }

  /**
   * Start the HTTP server.
   * Idempotent - safe to call multiple times.
   */
  public async start(): Promise<void> {
    if (this._isRunning) {
      this.logger.warn('Server: Already running');
      return;
    }

    try {
      this.logger.debug('Server: Initializing HTTP server');

      // Initialize Express application
      this.appInstance = await createApp();
      this.app = this.appInstance.getApp();

      // Start HTTP server
      await this.listen();

      this._isRunning = true;
      this.logger.debug('Server: HTTP server initialized');
    } catch (error: unknown) {
      const serverError = new ServiceUnavailableError(
        'Server: Failed to start HTTP server',
        {
          env: this.NODE_ENV,
          hostname: os.hostname(),
          port: this.PORT,
        },
        { cause: error },
      );
      this.logger.error(
        { err: serverError },
        'Server: Error initializing HTTP server',
      );

      throw serverError;
    }
  }

  /**
   * Stop the HTTP server gracefully.
   * Idempotent - safe to call multiple times.
   */
  public async stop(): Promise<void> {
    if (!this.server || !this._isRunning) {
      this.logger.debug('Server: No instance to stop or already stopped');
      return;
    }

    this._isShuttingDown = true;
    this.logger.info('Server: Initiating graceful shutdown');

    try {
      if (this.appInstance) {
        await this.appInstance.stop();
      }

      // Phase 1: Stop accepting new connections, drain existing
      await this.drainConnections();

      // Phase 2: Close the server
      await this.closeServer();

      this._isRunning = false;
      this.server = undefined;
      this.app = undefined;
      this.appInstance = undefined;

      this.logger.info('Server: HTTP server stopped');
    } catch (error) {
      // Reset state on failure to allow retry
      this._isShuttingDown = false;
      throw error;
    }
  }

  /**
   * Close the HTTP server with timeout protection.
   */
  private async closeServer(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let isTimedOut = false;

      const timeout = setTimeout(async () => {
        isTimedOut = true;
        const connectionCount = await this.getActiveConnectionsCount();

        const timeoutError = new InternalServerError(
          'Server: Shutdown timeout exceeded',
          {
            activeConnections: connectionCount,
            timeoutMs: SERVER_CLOSE_TIMEOUT_MS,
          },
        );

        this.logger.error({ err: timeoutError }, timeoutError.message);
        reject(timeoutError);
      }, SERVER_CLOSE_TIMEOUT_MS);

      this.server?.close(async (error) => {
        if (isTimedOut) return;
        clearTimeout(timeout);

        if (error) {
          const connectionCount = await this.getActiveConnectionsCount();
          const closeError = new InternalServerError(
            'Server: Failed to close HTTP server',
            { activeConnections: connectionCount },
            { cause: error },
          );
          this.logger.error({ err: closeError }, closeError.message);
          reject(closeError);
          return;
        }

        resolve();
      });
    });
  }

  /**
   * Create a descriptive error for server startup failures.
   */
  private createServerError(
    error: NodeJS.ErrnoException,
    port: number,
  ): ServiceUnavailableError {
    const AppErrorDetails = {
      errorCode: error.code,
      hostname: os.hostname(),
      port,
    };

    const messages: Record<string, string> = {
      EACCES: `Server: Permission denied to bind to port ${port}`,
      EADDRINUSE: `Server: Port ${port} is already in use`,
    };

    return new ServiceUnavailableError(
      messages[error.code ?? ''] ?? 'Server: Failed to start HTTP server',
      AppErrorDetails,
      { cause: error },
    );
  }

  /**
   * Drain existing connections with a grace period.
   * Stops accepting new connections and allows in-flight requests to complete.
   */
  private async drainConnections(): Promise<void> {
    if (!this.server) return;

    this.logger.debug('Server: Draining connections');

    // Stop accepting new connections
    if (typeof this.server.closeIdleConnections === 'function') {
      this.server.closeIdleConnections();
    }

    // Allow in-flight requests time to complete
    await new Promise((resolve) =>
      setTimeout(resolve, SERVER_DRAIN_TIMEOUT_MS),
    );

    // Force close remaining connections
    if (typeof this.server.closeAllConnections === 'function') {
      this.server.closeAllConnections();
      this.logger.debug('Server: All connections closed');
    }
  }

  /**
   * Get the count of active connections.
   */
  private async getActiveConnectionsCount(): Promise<number> {
    if (!this.server) return 0;

    try {
      return await new Promise<number>((resolve, reject) => {
        this.server?.getConnections((error, count) => {
          if (error) return reject(error);
          resolve(count);
        });
      });
    } catch (error) {
      this.logger.warn(
        { err: error },
        'Server: Error getting active connections count',
      );
      return -1;
    }
  }

  /**
   * Start listening for HTTP connections.
   */
  private async listen(): Promise<void> {
    if (!this.app) {
      throw new InternalServerError('Server: Express app not initialized');
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer(this.app);

      server.once('error', (error: NodeJS.ErrnoException) => {
        const operationalError = this.createServerError(error, this.PORT);
        this.logger.error({ err: operationalError }, operationalError.message);
        reject(operationalError);
      });

      server.listen(this.PORT, () => {
        this.server = server;
        const { address, port } = server.address() as AddressInfo;
        this.logger.info(
          {
            env: this.NODE_ENV,
            url: `http://${address}:${port}`,
          },
          'Server: Listening for connections',
        );
        resolve();
      });
    });
  }
}
