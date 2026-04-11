import type { Request } from 'express';
import type { JWTPayload } from 'jose';

import type { User, UserRole } from '@repo/db';

export interface AuthenticatedRequest extends Request {
  user: Pick<User, 'id' | 'email'>;
  role: UserRole;
}

export interface MyAccessTokenPayload extends JWTPayload {
  id: string;
  role: UserRole;
}

export interface MyRefreshTokenPayload extends JWTPayload {
  id: string;
}
