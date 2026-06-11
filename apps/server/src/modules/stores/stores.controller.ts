import type { Request, Response } from 'express';

import { StatusCodes } from 'http-status-codes';

import type { AuthenticatedRequest } from '#src/modules/auth/auth.type.js';
import type {
  CreateRatingInput,
  CreateStoreInput,
  StoreIdInput,
  StoreQueryInput,
} from '#src/modules/stores/stores.schema.js';

import { BaseController } from '#src/modules/core/base.controller.js';
import { StoreService } from '#src/modules/stores/stores.service.js';

export class StoreController extends BaseController {
  constructor(private readonly storeService: StoreService) {
    super();
    this.createStore = this.createStore.bind(this);
    this.getAllStores = this.getAllStores.bind(this);
    this.getStoreDetails = this.getStoreDetails.bind(this);
    this.getMyStores = this.getMyStores.bind(this);
    this.rateStore = this.rateStore.bind(this);
    this.getStoreRatings = this.getStoreRatings.bind(this);
  }
  async createStore(req: Request, res: Response) {
    const { name, email, address, ownerId } = req.validatedData
      .body as CreateStoreInput;

    const store = await this.storeService.createStore({
      name,
      email,
      address,
      ownerId,
    });

    req.log.info({ newStoreId: store.id }, 'Store created successfully');

    return this.sendSuccessResponse(
      req,
      res,
      {
        message: 'Store created successfully',
        store,
      },
      StatusCodes.CREATED,
    );
  }

  async getAllStores(req: Request, res: Response) {
    const query = req.validatedData.query as StoreQueryInput;

    const stores = await this.storeService.getAllStores(query);

    return this.sendSuccessResponse(req, res, {
      message: 'Stores fetched successfully',
      ...stores,
    });
  }

  async getStoreDetails(req: Request, res: Response) {
    const { id } = req.validatedData.params as StoreIdInput;

    const store = await this.storeService.getStoreDetails(id);

    req.log.info({ storeId: id }, 'Store details fetched successfully');

    return this.sendSuccessResponse(req, res, {
      message: 'Store details fetched successfully',
      store,
    });
  }

  async getMyStores(req: Request, res: Response) {
    const { user, role } = req as AuthenticatedRequest;

    const stores = await this.storeService.getMyStores(user.id, role);

    req.log.info({ ownerId: user.id }, 'Stores fetched successfully');

    return this.sendSuccessResponse(req, res, {
      message: 'Stores fetched successfully',
      stores,
    });
  }

  async rateStore(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { id: storeId } = req.validatedData.params as StoreIdInput;
    const { rating } = req.validatedData.body as CreateRatingInput;

    const store = await this.storeService.rateStore(user.id, storeId, rating);

    req.log.info({ storeId }, 'Store rated successfully');

    return this.sendSuccessResponse(req, res, {
      message: 'Store rated successfully',
      store,
    });
  }

  async getStoreRatings(req: Request, res: Response) {
    const { role } = req as AuthenticatedRequest;
    const { id: storeId } = req.validatedData.params as StoreIdInput;

    const store = await this.storeService.getStoreRatings(storeId, role);

    req.log.info({ storeId }, 'Store ratings fetched successfully');

    return this.sendSuccessResponse(req, res, {
      message: 'Store ratings fetched successfully',
      store,
    });
  }
}
