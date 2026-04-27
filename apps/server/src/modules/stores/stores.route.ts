// /stores	GET	All	Search: Filter by name and address (via the composite index).	Paginated<Store[]> + AvgRating
// /stores	POST	Admin	Creates a new store and assigns a STORE_OWNER.	Store object
// /stores/:id	GET	All	Fetch specific store details + owner info.	Store + OwnerProfile
// /stores/my-stores	GET	Owner	Returns stores owned by the logged-in user.

// /:id/ratings	POST	User	Submits a 1-5 rating for a store.	Rating object
// /:id/ratings	PUT	User	Updates an existing rating (enforced by @@unique).	Rating object
// /:id/ratings	GET	All	List of ratings for a store (Admin sees user emails).	Rating[] + UserSummary

import { Router } from 'express';

import { AuthMiddleware } from '#src/app/middlewares/check-auth.middleware.js';
import { validateRequest } from '#src/app/middlewares/validation.middleware.js';
import { StoreController } from '#src/modules/stores/stores.controller.js';
import {
  createRatingSchema,
  createStoreSchema,
  storeIdSchema,
  storeQuerySchema,
} from '#src/modules/stores/stores.schema.js';
import { UserRole } from '@repo/db';

export class StoreRouter {
  private readonly storeRouter = Router();

  constructor(
    private readonly storeController: StoreController,
    private readonly authMiddleware: AuthMiddleware,
  ) {}

  mountRoutes(): Router {
    const { checkAuth, checkRole } = this.authMiddleware;

    this.storeRouter.use(checkAuth);

    this.storeRouter
      .route('/')
      .get(
        validateRequest({ query: storeQuerySchema }),
        this.storeController.getAllStores,
      )
      .post(
        checkRole([UserRole.SYSTEM_ADMIN]),
        validateRequest({ body: createStoreSchema }),
        this.storeController.createStore,
      );

    this.storeRouter
      .route('/my-stores')
      .get(checkRole([UserRole.STORE_OWNER]), this.storeController.getMyStores);

    this.storeRouter
      .route('/:id')
      .get(
        validateRequest({ params: storeIdSchema }),
        this.storeController.getStoreDetails,
      );

    this.storeRouter
      .route('/:id/ratings')
      .get(
        validateRequest({ params: storeIdSchema }),
        this.storeController.getStoreRatings,
      )
      .post(
        checkRole([UserRole.NORMAL_USER]),
        validateRequest({ params: storeIdSchema, body: createRatingSchema }),
        this.storeController.rateStore,
      );

    return this.storeRouter;
  }
}
