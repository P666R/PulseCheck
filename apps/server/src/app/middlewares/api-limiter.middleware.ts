import type { NextFunction, Request, Response } from 'express';
import type { Options } from 'express-rate-limit';

import { rateLimit } from 'express-rate-limit';

const limitHandler = (
  req: Request,
  res: Response,
  _next: NextFunction,
  options: Options,
) => {
  const isAuth = options.message.error.includes('login attempts');
  const reason = isAuth ? 'AUTH_PROTECTION' : 'API_ABUSE';
  const status = isAuth ? 'warn' : 'error';

  // Capture the User-Agent for bot identification with log bloat attack prevention
  const userAgent = req.headers['user-agent']?.substring(0, 255) || 'unknown';

  req.log[status](
    {
      ip: req.ip,
      method: req.method,
      url: req.url,
      errorCode: 'TOO_MANY_REQUESTS',
      reason,
      userAgent,
    },
    `${options.message.error}`,
  );

  res.status(options.statusCode).json({
    requestId: req.id,
    correlationId: req.correlationId,
    errorCode: 'TOO_MANY_REQUESTS',
    message: options.message.error,
    status,
    timestamp: new Date().toISOString(),
  });
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes',
  },
  handler: limitHandler,
});

export const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error:
      'Too many login attempts from this IP, please try again after 30 minutes',
  },
  handler: limitHandler,
});
