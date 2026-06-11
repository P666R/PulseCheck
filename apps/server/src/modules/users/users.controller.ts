import type { Request, Response } from 'express';

import { StatusCodes } from 'http-status-codes';

import type { AuthenticatedRequest } from '#src/modules/auth/auth.type.js';
import type {
  CreateUserInput,
  UserIdInput,
  UserQueryInput,
} from '#src/modules/users/users.schema.js';

import { BaseController } from '#src/modules/core/base.controller.js';
import { UserService } from '#src/modules/users/users.service.js';

export class UserController extends BaseController {
  constructor(private readonly userService: UserService) {
    super();
    this.getProfile = this.getProfile.bind(this);
    this.getAllUsers = this.getAllUsers.bind(this);
    this.createUser = this.createUser.bind(this);
    this.getUserDetails = this.getUserDetails.bind(this);
    this.getSystemStats = this.getSystemStats.bind(this);
  }

  async getProfile(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const profile = await this.userService.getProfile(user.id);

    req.log.info('User profile fetched successfully');

    return this.sendSuccessResponse(req, res, {
      message: 'User profile fetched successfully',
      profile,
    });
  }

  async getAllUsers(req: Request, res: Response) {
    const query = req.validatedData.query as UserQueryInput;

    const users = await this.userService.getAllUsers(query);

    req.log.info('Users fetched successfully');

    return this.sendSuccessResponse(req, res, {
      message: 'Users fetched successfully',
      ...users,
    });
  }

  async createUser(req: Request, res: Response) {
    const { name, email, address, password, role } = req.validatedData
      .body as CreateUserInput;
    const user = await this.userService.createUser({
      name,
      email,
      address,
      password,
      role,
    });

    req.log.info({ newUserId: user.id }, 'User created successfully');

    return this.sendSuccessResponse(
      req,
      res,
      {
        message: 'User created successfully',
        user,
      },
      StatusCodes.CREATED,
    );
  }

  async getUserDetails(req: Request, res: Response) {
    const { id } = req.validatedData.params as UserIdInput;
    const user = await this.userService.getUserDetails(id);

    req.log.info('User details fetched successfully');

    return this.sendSuccessResponse(req, res, {
      message: 'User details fetched successfully',
      user,
    });
  }

  async getSystemStats(req: Request, res: Response) {
    const stats = await this.userService.getSystemStats();

    req.log.info('System stats fetched successfully');

    return this.sendSuccessResponse(req, res, {
      message: 'System stats fetched successfully',
      stats,
    });
  }
}
