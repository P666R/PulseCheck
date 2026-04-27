import type {
  CreateStoreDto,
  StoreQueryDto,
} from '#src/modules/stores/stores.dto.js';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '#src/lib/api/client-error.api.js';
import { logger } from '#src/lib/logger/pino.logger.js';
import { StoreRepository } from '#src/modules/stores/stores.repository.js';
import { UserRepository } from '#src/modules/users/users.repository.js';
import { UserRole } from '@repo/db';

export class StoreService {
  private readonly logger = logger.createChild({ service: 'StoreService' });

  constructor(
    private readonly storeRepository: StoreRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async createStore(dto: CreateStoreDto) {
    const { email, ownerId } = dto;

    const [existingStore, owner] = await Promise.all([
      this.storeRepository.findByEmail(email),
      this.userRepository.findById(ownerId),
    ]);

    if (existingStore) {
      this.logger.info('Email already registered');
      throw new ConflictError('Email already registered');
    }

    if (!owner || owner?.role !== UserRole.STORE_OWNER) {
      this.logger.info({ ownerId }, 'Invalid store owner');
      throw new NotFoundError('Invalid store owner');
    }

    return this.storeRepository.create(dto);
  }

  async getAllStores(query: StoreQueryDto) {
    return this.storeRepository.findAllPaginated(query);
  }

  async getStoreDetails(storeId: string) {
    const store = await this.storeRepository.findById(storeId);

    if (!store) {
      throw new NotFoundError('Store not found');
    }

    return store;
  }

  async getMyStores(ownerId: string, role: UserRole) {
    if (role !== UserRole.STORE_OWNER) {
      throw new ForbiddenError('You are not a store owner');
    }

    const [stores, stats] = await Promise.all([
      this.storeRepository.findByOwner(ownerId),
      this.storeRepository.getOwnerStats(ownerId),
    ]);

    return {
      stores,
      stats,
    };
  }

  async rateStore(userId: string, storeId: string, value: number) {
    const storeExists = await this.storeRepository.findById(storeId);

    if (!storeExists) {
      this.logger.info({ storeId }, 'Store not found');
      throw new NotFoundError('Store not found');
    }

    return this.storeRepository.upsertRating(userId, storeId, value);
  }

  async getStoreRatings(storeId: string, role: UserRole) {
    const isAdmin = role === UserRole.SYSTEM_ADMIN;
    return this.storeRepository.getStoreRatings(storeId, isAdmin);
  }
}
