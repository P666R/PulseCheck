export type AppErrorDetails = Record<string, unknown>;

import { STATUS } from '#src/config/constants.js';

export class AppError extends Error {
  public readonly details?: AppErrorDetails;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly status: STATUS;
  public readonly statusCode: number;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    details?: AppErrorDetails,
    options?: ErrorOptions,
  ) {
    // 1. Pass message and options (like 'cause') to base Error class
    super(message, options);
    // 2. Set the prototype explicitly
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    // 3. Logic for 'warn' (4xx) vs 'error' (5xx), for logs and monitoring only, not in responses
    this.status =
      statusCode >= 400 && statusCode < 500 ? STATUS.WARN : STATUS.ERROR;
    // 4. Mark as operational (trusted error we know how to handle)
    this.isOperational = statusCode < 500;
    this.errorCode = errorCode ?? this.name;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}
