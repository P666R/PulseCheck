import type { User, UserRole } from '@repo/db';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      user?: Pick<User, 'id' | 'email'>;
      role?: UserRole;
    }
  }
}

export {};
