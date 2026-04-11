/**
 * Lifecycle interfaces for infrastructure components.
 * Provides a common contract for components that can be started, stopped,
 * and health-checked.
 */

import { HEALTH_STATUS } from '#src/config/constants.js';

/**
 * Cleanup error structure for aggregating errors during shutdown.
 */
export interface CleanupError {
  component: string;
  error: Error;
  isOperational: boolean;
}

/**
 * Type for cleanup task functions.
 */
export type CleanupTask = () => Promise<void>;

/**
 * Health check result for a component.
 */
export interface HealthCheckResult {
  component: string;
  details?: Record<string, unknown>;
  status: (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];
  timestamp: string;
}

/**
 * Interface for components that support lifecycle management.
 * Enables consistent startup/shutdown orchestration and testing.
 */
export interface Lifecycle {
  /**
   * Get the health status of the component.
   */
  health(): HealthCheckResult;

  /**
   * Check if the component is currently running.
   */
  isRunning(): boolean;

  /**
   * Start the component. Should be idempotent.
   */
  start(): Promise<void>;

  /**
   * Stop the component gracefully. Should be idempotent.
   */
  stop(): Promise<void>;
}
