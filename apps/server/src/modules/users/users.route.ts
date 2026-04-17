import { Router } from 'express';

import { AuthMiddleware } from '#src/app/middlewares/check-auth.middleware.js';
import { validateRequest } from '#src/app/middlewares/validation.middleware.js';
import { UserController } from '#src/modules/users/users.controller.js';
import {
  createUserSchema,
  userIdSchema,
  userQuerySchema,
} from '#src/modules/users/users.schema.js';

export class UserRouter {
  private readonly userRouter = Router();

  constructor(
    private readonly userController: UserController,
    private readonly authMiddleware: AuthMiddleware,
  ) {}

  mountRoutes(): Router {
    this.userRouter.use(this.authMiddleware.checkAuth);

    this.userRouter.route('/me').get(this.userController.getProfile);

    this.userRouter.use(this.authMiddleware.checkRole(['SYSTEM_ADMIN']));

    this.userRouter
      .route('/')
      .get(
        validateRequest({ query: userQuerySchema }),
        this.userController.getAllUsers,
      )
      .post(
        validateRequest({ body: createUserSchema }),
        this.userController.createUser,
      );

    this.userRouter.route('/stats').get(this.userController.getSystemStats);

    this.userRouter
      .route('/:id')
      .get(
        validateRequest({ params: userIdSchema }),
        this.userController.getUserDetails,
      );

    return this.userRouter;
  }
}
