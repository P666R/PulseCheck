import type { CookieOptions, Request, Response } from 'express';

import { StatusCodes } from 'http-status-codes';

import type { ApiSuccessResponse } from '#src/types/response.type.js';

import { STATUS } from '#src/config/constants.js';

export abstract class BaseController {
  protected sendSuccessResponse(
    req: Request,
    res: Response,
    {
      message,
      data,
      accessToken,
      status = StatusCodes.OK,
    }: {
      message: string;
      data?: object;
      accessToken?: string;
      status?: StatusCodes;
    },
  ) {
    const response: ApiSuccessResponse = {
      status: STATUS.SUCCESS,
      message,
      data,
      accessToken,
      requestId: req.id,
      correlationId: req.correlationId,
      timestamp: new Date(),
    };

    return res.status(status).json(response);
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
