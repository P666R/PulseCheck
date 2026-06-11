import type { User, UserRole } from '@repo/db';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      user?: Pick<User, 'id' | 'email'>;
      role?: UserRole;
      validatedData: {
        body?: Record<string, unknown>;
        params?: Record<string, unknown>;
        query?: Record<string, unknown>;
        cookies?: Record<string, unknown>;
      };
    }
  }
}

export {};
