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

export type HEALTH_STATUS = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

export const STATUS = {
  WARN: 'warn',
  ERROR: 'error',
} as const;

export type STATUS = (typeof STATUS)[keyof typeof STATUS];

export const UserSortableField = {
  NAME: 'name',
  EMAIL: 'email',
  ADDRESS: 'address',
  ROLE: 'role',
  CREATED_AT: 'createdAt',
} as const;

export const StoreSortableField = {
  NAME: 'name',
  EMAIL: 'email',
  ADDRESS: 'address',
  CREATED_AT: 'createdAt',
} as const;

export const SortOrder = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export type UserSortableField =
  (typeof UserSortableField)[keyof typeof UserSortableField];

export type StoreSortableField =
  (typeof StoreSortableField)[keyof typeof StoreSortableField];

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
