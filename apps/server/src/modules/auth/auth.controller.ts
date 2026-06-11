import type { Request, Response } from 'express';

import { StatusCodes } from 'http-status-codes';

import type {
  LoginInput,
  RegisterInput,
  UpdatePasswordInput,
} from '#src/modules/auth/auth.schema.js';
import type { AuthenticatedRequest } from '#src/modules/auth/auth.type.js';

import { enrichRequestLogger } from '#src/app/middlewares/logging.middleware.js';
import { AuthService } from '#src/modules/auth/auth.service.js';
import { BaseController } from '#src/modules/core/base.controller.js';

export class AuthController extends BaseController {
  constructor(private readonly authService: AuthService) {
    super();
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.newAccessToken = this.newAccessToken.bind(this);
    this.updatePassword = this.updatePassword.bind(this);
  }

  public async register(req: Request, res: Response) {
    const { passwordConfirm: _, ...body } = req.validatedData
      .body as RegisterInput;

    const user = await this.authService.register(body);

    enrichRequestLogger(req, { userId: user.id, role: user.role });
    req.log.info('User registration successful');

    return this.sendSuccessResponse(
      req,
      res,
      {
        message: 'Registered successfully',
        user,
      },
      StatusCodes.CREATED,
    );
  }

  public async login(req: Request, res: Response) {
    const { email, password } = req.validatedData.body as LoginInput;
    const { jwt: currentCookieToken } = req.validatedData.cookies as {
      jwt: string;
    };

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

      return this.sendSuccessResponse(req, res, {
        message: 'Logged in successfully',
        user,
        accessToken,
      });
    } catch (error) {
      const { maxAge: _, ...clearOptions } = cookieOptions;
      res.clearCookie('jwt', clearOptions);
      throw error;
    }
  }

  public async logout(req: Request, res: Response) {
    const { jwt: currentCookieToken } = req.validatedData.cookies as {
      jwt: string;
    };

    const cookieOptions = this.getCookieOptions(0);

    res.clearCookie('jwt', cookieOptions);

    if (!currentCookieToken) {
      return this.sendSuccessResponse(req, res, {
        message: 'Already logged out',
      });
    }

    const user = await this.authService.logout(currentCookieToken);

    if (!user) {
      return this.sendSuccessResponse(req, res, {
        message: 'Already logged out',
      });
    }

    req.log.info('User logged out successfully');

    return this.sendSuccessResponse(req, res, {
      message: 'Logged out successfully',
    });
  }

  public async newAccessToken(req: Request, res: Response) {
    const { jwt: refreshToken } = req.validatedData.cookies as { jwt: string };

    const cookieOptions = this.getCookieOptions(24 * 60 * 60 * 1000);

    try {
      const {
        user,
        accessToken,
        refreshToken: newRefreshToken,
      } = await this.authService.newAccessToken(refreshToken);

      req.log.info('Tokens rotated successfully');

      res.cookie('jwt', newRefreshToken, cookieOptions);

      return this.sendSuccessResponse(req, res, {
        message: 'Tokens rotated successfully',
        user,
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
    const { password } = req.validatedData.body as UpdatePasswordInput;

    const updatedUser = await this.authService.updatePassword({
      userId: user.id,
      password,
    });

    req.log.info('Password reset successful');

    return this.sendSuccessResponse(req, res, {
      message: 'Password updated successfully',
      user: updatedUser,
    });
  }
}
