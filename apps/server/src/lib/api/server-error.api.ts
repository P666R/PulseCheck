import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import { AppError, type AppErrorDetails } from './app-error.api.js';

/** 500: Unexpected server-side failure */
export class InternalServerError extends AppError {
  constructor(
    message: string = ReasonPhrases.INTERNAL_SERVER_ERROR,
    details?: AppErrorDetails,
    options?: ErrorOptions,
  ) {
    super(
      message,
      StatusCodes.INTERNAL_SERVER_ERROR,
      StatusCodes[StatusCodes.INTERNAL_SERVER_ERROR],
      details,
      options,
    );
  }
}

/** 503: Server is overloaded or down for maintenance */
export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = ReasonPhrases.SERVICE_UNAVAILABLE,
    details?: AppErrorDetails,
    options?: ErrorOptions,
  ) {
    super(
      message,
      StatusCodes.SERVICE_UNAVAILABLE,
      StatusCodes[StatusCodes.SERVICE_UNAVAILABLE],
      details,
      options,
    );
  }
}

/** 502: Invalid response from an upstream server */
export class BadGatewayError extends AppError {
  constructor(
    message: string = ReasonPhrases.BAD_GATEWAY,
    details?: AppErrorDetails,
    options?: ErrorOptions,
  ) {
    super(
      message,
      StatusCodes.BAD_GATEWAY,
      StatusCodes[StatusCodes.BAD_GATEWAY],
      details,
      options,
    );
  }
}
