import type { CookieOptions, Request, Response } from 'express';

import { StatusCodes } from 'http-status-codes';

import type { ApiSuccessResponse } from '#src/types/response.type.js';

export abstract class BaseController {
  protected sendSuccessResponse<T extends Record<string, unknown>>(
    _req: Request,
    res: Response,
    payload: ApiSuccessResponse<T>,
    status = StatusCodes.OK,
  ) {
    return res.status(status).json(payload);
  }

  protected getCookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: maxAge || undefined,
    };
  }
}
