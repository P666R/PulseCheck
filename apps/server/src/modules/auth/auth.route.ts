import { Router } from 'express';

import { AuthMiddleware } from '#src/app/middlewares/check-auth.middleware.js';
import { validateRequest } from '#src/app/middlewares/validation.middleware.js';
import { AuthController } from '#src/modules/auth/auth.controller.js';
import {
  loginSchema,
  registerSchema,
  updatePasswordSchema,
} from '#src/modules/auth/auth.schema.js';

export class AuthRouter {
  private readonly authRouter = Router();
  constructor(
    private readonly authController: AuthController,
    private readonly authMiddleware: AuthMiddleware,
  ) {}

  mountRoutes(): Router {
    this.authRouter
      .route('/register')
      .post(
        validateRequest({ body: registerSchema }),
        this.authController.register,
      );

    this.authRouter
      .route('/login')
      .post(validateRequest({ body: loginSchema }), this.authController.login);

    this.authRouter.route('/refresh').post(this.authController.newAccessToken);

    this.authRouter.use(
      this.authMiddleware.checkAuth.bind(this.authMiddleware),
    );

    this.authRouter.route('/logout').post(this.authController.logout);

    this.authRouter
      .route('/password')
      .patch(
        validateRequest({ body: updatePasswordSchema }),
        this.authController.updatePassword,
      );

    return this.authRouter;
  }
}
