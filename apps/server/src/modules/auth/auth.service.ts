import { jwtVerify, SignJWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';

import type {
  LoginDto,
  RegisterDto,
  UpdatePasswordDto,
} from '#src/modules/auth/auth.dto.js';
import type { MyRefreshTokenPayload } from '#src/modules/auth/auth.type.js';

import { envConfig } from '#src/config/env.config.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '#src/lib/api/client-error.api.js';
import { logger } from '#src/lib/logger/pino.logger.js';
import { hashPassword, verifyPassword } from '#src/lib/utils/password.util.js';
import { AuthRepository } from '#src/modules/auth/auth.repository.js';

const {
  JWT_ALGO,
  JWT_ACCESS_SECRET_KEY,
  DUMMY_HASHED_PASSWORD,
  JWT_REFRESH_SECRET_KEY,
} = envConfig;

export class AuthService {
  private readonly jwtAccessSecret = new TextEncoder().encode(
    JWT_ACCESS_SECRET_KEY,
  );
  private readonly jwtRefreshSecret = new TextEncoder().encode(
    JWT_REFRESH_SECRET_KEY,
  );
  private readonly logger = logger.createChild({ service: 'AuthService' });

  constructor(private readonly authRepository: AuthRepository) {}

  private async signAccess(id: string, role: string) {
    return new SignJWT({ id, role })
      .setProtectedHeader({ alg: JWT_ALGO })
      .setIssuedAt()
      .setExpirationTime('10m')
      .setJti(uuidv4()) // JTI prevents replay attacks
      .sign(this.jwtAccessSecret);
  }

  private async signRefresh(id: string) {
    return new SignJWT({ id })
      .setProtectedHeader({ alg: JWT_ALGO })
      .setIssuedAt()
      .setExpirationTime('1d')
      .setJti(uuidv4())
      .sign(this.jwtRefreshSecret);
  }

  async register(dto: RegisterDto) {
    const { name, email, address, password } = dto;

    const userExists = await this.authRepository.findByEmail(email);
    if (userExists) {
      this.logger.info('Email already registered');
      throw new ConflictError('Email already registered');
    }

    const hashedPassword = await hashPassword(password);

    const user = await this.authRepository.register({
      name,
      email,
      address,
      password: hashedPassword,
    });

    return user;
  }

  async login(dto: LoginDto) {
    const { email, password, currentCookieToken } = dto;

    const existingUser = await this.authRepository.findByEmailInsecure(email);

    const storedHash = existingUser
      ? existingUser.password
      : DUMMY_HASHED_PASSWORD;

    const passwordMatch = await verifyPassword(password, storedHash);

    if (!existingUser || !passwordMatch) {
      this.logger.info('Invalid credentials');
      throw new UnauthorizedError('Invalid credentials');
    }

    if (currentCookieToken) {
      try {
        await jwtVerify<MyRefreshTokenPayload>(
          currentCookieToken,
          this.jwtRefreshSecret,
        );

        if (!existingUser.refreshTokens.includes(currentCookieToken)) {
          const compromisedUser = await this.authRepository.updateRefreshTokens(
            existingUser.id,
            [],
          );

          this.logger.warn(
            { userId: compromisedUser.id },
            'Token reuse detected',
          );
          throw new UnauthorizedError('Session expired. Please login again');
        }
      } catch {
        this.logger.info('Stale cookie ignored');
      }
    }

    const [accessToken, newRefreshToken] = await Promise.all([
      this.signAccess(existingUser.id, existingUser.role),
      this.signRefresh(existingUser.id),
    ]);

    const filteredRefreshTokensArray = currentCookieToken
      ? existingUser.refreshTokens.filter((rt) => rt !== currentCookieToken)
      : existingUser.refreshTokens;

    const updatedRefreshTokens = [
      ...filteredRefreshTokensArray,
      newRefreshToken,
    ].slice(-5);

    const user = await this.authRepository.updateRefreshTokens(
      existingUser.id,
      updatedRefreshTokens,
    );

    return { user, accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    const user =
      await this.authRepository.findByRefTokenAndDeleteRefToken(refreshToken);

    return user;
  }

  async newAccessToken(refreshToken: string) {
    let payload: MyRefreshTokenPayload;

    // 1. Verify integrity (Async non-blocking check)
    try {
      const result = await jwtVerify<MyRefreshTokenPayload>(
        refreshToken,
        this.jwtRefreshSecret,
      );
      payload = result.payload;
    } catch {
      this.logger.info('Token Verification failed');
      throw new ForbiddenError('Session expired. Please login again');
    }

    // 2. Pre-generate new token (Edge-compatible signing)
    const newRefreshToken = await this.signRefresh(payload.id);

    // / 3. Atomic rotation (Single DB transaction)
    const existingUser =
      await this.authRepository.findByRefTokenAndRotateRefToken(
        refreshToken,
        newRefreshToken,
      );

    // 4. Theft Detection Logic
    if (!existingUser) {
      await this.authRepository.updateRefreshTokens(payload.id, []);
      this.logger.warn(
        { userId: payload.id },
        'Potential token reuse detected. All sessions revoked',
      );

      throw new ForbiddenError('Session expired. Please login again');
    }

    // 5. Short-lived Access Token generation
    const accessToken = await this.signAccess(
      existingUser.id,
      existingUser.role,
    );

    return { user: existingUser, accessToken, refreshToken: newRefreshToken };
  }

  async updatePassword(dto: UpdatePasswordDto) {
    const { password, userId } = dto;

    const existingUser = await this.authRepository.findById(userId);

    if (!existingUser) {
      this.logger.info('User not found');
      throw new NotFoundError('User not found');
    }

    const hashedPassword = await hashPassword(password);

    const user = await this.authRepository.updatePassword(
      userId,
      hashedPassword,
    );

    return user;
  }
}
