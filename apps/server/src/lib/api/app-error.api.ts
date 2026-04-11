export type AppErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  public readonly details?: AppErrorDetails;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly status: string;
  public readonly statusCode: number;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    details?: AppErrorDetails,
    options?: ErrorOptions,
  ) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true;
    this.errorCode = errorCode ?? this.name;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}
