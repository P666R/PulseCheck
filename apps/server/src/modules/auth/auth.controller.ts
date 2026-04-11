import type { CookieOptions, Request, Response } from 'express';

import { StatusCodes } from 'http-status-codes';

import type {
  LoginInput,
  RegisterInput,
  UpdatePasswordInput,
} from '#src/modules/auth/auth.schema.js';

import { enrichRequestLogger } from '#src/app/middlewares/logging.middleware.js';
import { AuthService } from '#src/modules/auth/auth.service.js';

import type { AuthenticatedRequest } from './auth.type.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.newAccessToken = this.newAccessToken.bind(this);
    this.updatePassword = this.updatePassword.bind(this);
  }

  private getCookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: maxAge || undefined,
    };
  }

  public async register(req: Request, res: Response) {
    const { name, email, address, password } = req.body as RegisterInput;

    const user = await this.authService.register({
      name,
      email,
      address,
      password,
    });

    enrichRequestLogger(req, { userId: user.id, role: user.role });
    req.log.info('User registration successful');

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Registered successfully',
    });
  }

  public async login(req: Request, res: Response) {
    const { email, password } = req.body as LoginInput;
    const { jwt: currentCookieToken } = req.cookies;

    const cookieOptions = this.getCookieOptions(24 * 60 * 60 * 1000);

    try {
      const { user, accessToken, refreshToken } = await this.authService.login({
        email,
        password,
        currentCookieToken,
      });

      enrichRequestLogger(req, { userId: user.id, role: user.role });
      req.log.info('User logged in successfully');

      res.cookie('jwt', refreshToken, cookieOptions);

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          name: user.name,
          email: user.email,
          address: user.address,
        },
        accessToken,
      });
    } catch (error) {
      const { maxAge: _, ...clearOptions } = cookieOptions;
      res.clearCookie('jwt', clearOptions);
      throw error;
    }
  }

  public async logout(req: Request, res: Response) {
    const { jwt: currentCookieToken } = req.cookies;

    const cookieOptions = this.getCookieOptions(0);

    res.clearCookie('jwt', cookieOptions);

    if (!currentCookieToken) {
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Already logged out',
      });
      return;
    }

    const user = await this.authService.logout(currentCookieToken);

    if (!user) {
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Already logged out',
      });
      return;
    }

    req.log.info('User logged out successfully');

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  public async newAccessToken(req: Request, res: Response) {
    const { jwt: refreshToken } = req.cookies;

    const cookieOptions = this.getCookieOptions(24 * 60 * 60 * 1000);

    try {
      const {
        user,
        accessToken,
        refreshToken: newRefreshToken,
      } = await this.authService.newAccessToken(refreshToken);

      req.log.info('Tokens rotated successfully');

      res.cookie('jwt', newRefreshToken, cookieOptions);

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          name: user.name,
          email: user.email,
          address: user.address,
        },
        accessToken,
      });
    } catch (error) {
      const { maxAge: _, ...clearOptions } = cookieOptions;
      res.clearCookie('jwt', clearOptions);
      throw error;
    }
  }

  public async updatePassword(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { password } = req.body as UpdatePasswordInput;

    await this.authService.updatePassword({
      userId: user.id,
      password,
    });

    req.log.info('Password reset successful');

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Password updated successfully',
    });
  }
}
