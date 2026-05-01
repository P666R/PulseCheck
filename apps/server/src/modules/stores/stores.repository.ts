import type {
  CreateStoreDto,
  StoreQueryDto,
} from '#src/modules/stores/stores.dto.js';
import type { Prisma } from '@repo/db';

import { SortOrder, StoreSortableField } from '#src/config/constants.js';
import { db } from '#src/lib/prisma/client.prisma.js';

export class StoreRepository {
  private readonly prisma = db.getClient();
  private transformStore<T extends { ratings: { rating: number }[] }>(
    store: T,
  ) {
    const ratings = store.ratings || [];
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

    const { ratings: _, ...rest } = store;

    return {
      ...rest,
      avgRating: Number.parseFloat(avgRating.toFixed(1)),
      totalRatings: ratings.length,
    };
  }

  async findAllPaginated(params: StoreQueryDto, omit: Prisma.StoreOmit) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = StoreSortableField.CREATED_AT,
      sortOrder = SortOrder.DESC,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.StoreWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { address: { contains: search } },
        ],
      }),
    };

    const [total, rawStores] = await Promise.all([
      this.prisma.store.count({ where }),
      this.prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        omit,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              address: true,
              ownedStores: {
                select: { id: true, name: true },
              },
              _count: { select: { ownedStores: true } },
            },
          },
          ratings: { select: { rating: true } },
        },
      }),
    ]);

    const stores = rawStores.map((store) => this.transformStore(store));

    return {
      stores,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
        sortBy,
        sortOrder,
      },
    };
  }

  async create(data: CreateStoreDto, omit: Prisma.StoreOmit) {
    const { name, email, address, ...rest } = data;
    return this.prisma.store.create({
      data: {
        name: name.toLowerCase(),
        email: email.toLowerCase(),
        address: address.toLowerCase(),
        ...rest,
      },
      omit,
    });
  }

  async findById(id: string, omit: Prisma.StoreOmit) {
    return this.prisma.store.findUnique({
      where: { id },
      include: {
        owner: {
          omit: {
            password: true,
            refreshTokens: true,
            passwordChangedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        ratings: { omit },
      },
      omit,
    });
  }

  async findByEmail(email: string, omit: Prisma.StoreOmit) {
    return this.prisma.store.findUnique({
      where: { email: email.toLowerCase() },
      omit,
    });
  }

  async findByOwner(ownerId: string, omit: Prisma.StoreOmit) {
    const stores = await this.prisma.store.findMany({
      where: { ownerId },
      include: {
        ratings: { select: { rating: true } },
        _count: { select: { ratings: true } },
      },
      omit,
    });

    return stores.map((store) => this.transformStore(store));
  }

  async getOwnerStats(ownerId: string) {
    const stats = await this.prisma.store.aggregate({
      where: { ownerId },
      _count: { id: true },
    });

    const ratingStats = await this.prisma.rating.aggregate({
      where: { store: { ownerId } },
      _avg: { rating: true },
      _count: { id: true },
    });

    return {
      totalStores: stats._count.id,
      totalReviews: ratingStats._count.id,
      overallAvgRating: ratingStats._avg.rating ?? 0,
    };
  }

  async upsertRating(
    userId: string,
    storeId: string,
    value: number,
    omit: Prisma.StoreOmit,
  ) {
    return this.prisma.rating.upsert({
      where: {
        userId_storeId: { userId, storeId },
      },
      update: { rating: value },
      create: { userId, storeId, rating: value },
      omit,
    });
  }

  async getStoreRatings(
    storeId: string,
    isAdmin: boolean,
    omit: Prisma.StoreOmit,
  ) {
    return this.prisma.rating.findMany({
      where: { storeId },
      include: {
        user: { select: { id: true, name: true, email: isAdmin } },
      },
      omit,
    });
  }
}
