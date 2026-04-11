// Lifecycle timeouts
export const APP_SHUTDOWN_TIMEOUT_MS = 15_000;

export const SERVER_CLOSE_TIMEOUT_MS = 5_000;

export const SERVER_DRAIN_TIMEOUT_MS = 2_000;

// database configuration
export const DB_MAX_RETRIES = 5;

export const DB_BASE_RETRY_DELAY_MS = 2_000;

// Exit codes
export const EXIT_CODES = {
  GENERAL_ERROR: 1,
  SHUTDOWN_TIMEOUT: 3,
  STARTUP_FAILURE: 2,
  SUCCESS: 0,
  UNCAUGHT_EXCEPTION: 4,
  UNHANDLED_REJECTION: 5,
} as const;

// Health checks
export const IGNORED_LOG_PATHS = ['/health', '/metrics', '/favicon.ico'];

export const HEALTH_STATUS = {
  DEGRADED: 'degraded',
  HEALTHY: 'healthy',
  SHUTTING_DOWN: 'shutting_down',
  UNHEALTHY: 'unhealthy',
} as const;
