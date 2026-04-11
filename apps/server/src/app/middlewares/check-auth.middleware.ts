import type { NextFunction, Request, Response } from 'express';

import { errors, jwtVerify } from 'jose';

import type {
  AuthenticatedRequest,
  MyAccessTokenPayload,
} from '#src/modules/auth/auth.type.js';
import type { UserRole } from '@repo/db';

import { enrichRequestLogger } from '#src/app/middlewares/logging.middleware.js';
import { envConfig } from '#src/config/env.config.js';
import { AppError } from '#src/lib/api/app-error.api.js';
import {
  ForbiddenError,
  UnauthorizedError,
} from '#src/lib/api/client-error.api.js';
import { AuthRepository } from '#src/modules/auth/auth.repository.js';

const { JWT_ALGO, JWT_ACCESS_SECRET_KEY } = envConfig;

export class AuthMiddleware {
  private readonly jwtAccessSecret = new TextEncoder().encode(
    JWT_ACCESS_SECRET_KEY,
  );

  constructor(private readonly authRepository: AuthRepository) {}

  async checkAuth(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication required');
    }

    const jwtToken = authHeader.split(' ')[1] as string;

    try {
      const { payload } = await jwtVerify<MyAccessTokenPayload>(
        jwtToken,
        this.jwtAccessSecret,
        {
          algorithms: [JWT_ALGO],
        },
      );

      if (!payload.id || !payload.role || !payload.iat) {
        req.log.info('Invalid token, missing required claims');
        throw new UnauthorizedError('Authentication required');
      }

      const user = await this.authRepository.findById(payload.id);

      if (!user) {
        req.log.info('User no longer exists');
        throw new UnauthorizedError('Invalid or expired session');
      }

      if (user.passwordChangedAt) {
        const changedTimestamp = Math.floor(
          user.passwordChangedAt.getTime() / 1000,
        );

        if (payload.iat < changedTimestamp - 1) {
          req.log.info('Password recently changed');
          throw new UnauthorizedError(
            'Security settings changed. Please login again',
          );
        }
      }

      req.user = user;
      req.role = user.role;

      enrichRequestLogger(req, {
        userId: user.id,
        role: user.role,
      });

      next();
    } catch (error) {
      req.log.info('Authentication verification failed');

      if (error instanceof errors.JWTExpired) {
        throw new UnauthorizedError('Invalid or expired session');
      }

      if (error instanceof AppError && error.isOperational) throw error;

      throw new UnauthorizedError('Authentication failed');
    }
  }

  checkRole = (allowedRoles: UserRole[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
      const authReq = req as AuthenticatedRequest;

      if (!authReq.user || !authReq.role) {
        req.log.info('Authentication required');
        throw new UnauthorizedError('Authentication required');
      }

      const hasAccess = allowedRoles.includes(authReq.role);

      if (!hasAccess) {
        req.log.info(
          {
            userId: authReq.user.id,
            userRole: authReq.role,
            required: allowedRoles,
          },
          'RBAC denied',
        );
        throw new ForbiddenError('RBAC denied');
      }

      next();
    };
  };
}
