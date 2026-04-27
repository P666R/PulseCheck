import type { Prisma, UserRole } from '@repo/db';

import { SortOrder, UserSortableField } from '#src/config/constants.js';
import { db } from '#src/lib/prisma/client.prisma.js';

export class UserRepository {
  private readonly prisma = db.getClient();

  private readonly defaultOmit = {
    password: true,
    refreshTokens: true,
  } as const;

  /**
   * GET /me
   * Fetches the profile of the currently authenticated user.
   */
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      omit: this.defaultOmit,
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      omit: this.defaultOmit,
    });
  }

  /**
   * GET / (Admin)
   * Lists users with pagination and filtering by role/search term.
   */
  async findAllPaginated(params: {
    page: number;
    limit: number;
    role?: UserRole;
    search?: string;
    sortBy?: UserSortableField;
    sortOrder?: SortOrder;
  }) {
    const {
      page = 1,
      limit = 10,
      role,
      search,
      sortBy = UserSortableField.CREATED_AT,
      sortOrder = SortOrder.DESC,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { address: { contains: search } },
        ],
      }),
    };

    const [total, rawUsers] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        omit: this.defaultOmit,
        include: {
          ratings: { select: { rating: true } },
          ownedStores: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: { select: { ownedStores: true } },
        },
      }),
    ]);

    const users = rawUsers.map((user) => {
      const ratings = user.ratings || [];
      const avgRating =
        ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
          : 0;

      const { ratings: _, ...rest } = user;
      return {
        ...rest,
        avgRating: Number.parseFloat(avgRating.toFixed(1)),
        totalRatings: ratings.length,
      };
    });

    return {
      users,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
        sortBy,
        sortOrder,
      },
    };
  }

  /**
   * POST / (Admin)
   * Manually adds a user with a specific role (e.g., adding another Admin).
   */
  async create(data: Prisma.UserCreateInput) {
    const { name, email, address, ...rest } = data;

    return this.prisma.user.create({
      data: {
        name: name.toLowerCase(),
        email: email.toLowerCase(),
        address: address.toLowerCase(),
        ...rest,
      },
      omit: this.defaultOmit,
    });
  }

  /**
   * GET /:id (Admin)
   * Detailed view including aggregated activity counts.
   */
  async findWithStats(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ownedStores: true, // Counts stores they own
            ratings: true, // Counts ratings they've given
          },
        },
      },
      omit: this.defaultOmit,
    });
  }

  /**
   * GET /stats (Admin)
   * High-level system dashboard snapshot.
   */
  async getSystemStats() {
    const [totalUsers, totalStores, totalRatings] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.store.count(),
      this.prisma.rating.count(),
    ]);

    return {
      totalUsers,
      totalStores,
      totalRatings,
    };
  }
}
