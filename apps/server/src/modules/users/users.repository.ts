import type {
  UserSortableField,
  UserSortOrder,
} from '#src/config/constants.js';
import type { Prisma, UserRole } from '@repo/db';

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
    sortOrder?: UserSortOrder;
  }) {
    const {
      page = 1,
      limit = 10,
      role,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search.toLowerCase() } },
          { email: { contains: search.toLowerCase() } },
        ],
      }),
    };

    // Parallel execution for 2026 performance standards
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        omit: this.defaultOmit,
      }),
    ]);

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
    return this.prisma.user.create({
      data,
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
