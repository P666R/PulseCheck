import type { Prisma, UserRole } from '@repo/db';

import { SortOrder, UserSortableField } from '#src/config/constants.js';
import { db } from '#src/lib/prisma/client.prisma.js';

export class UserRepository {
  private readonly prisma = db.getClient();

  async findById(id: string, omit: Prisma.UserOmit) {
    return this.prisma.user.findUnique({
      where: { id },
      omit,
    });
  }

  async findByEmail(email: string, omit: Prisma.UserOmit) {
    return this.prisma.user.findUnique({
      where: { email },
      omit,
    });
  }

  async findAllPaginated(
    params: {
      page: number;
      limit: number;
      role?: UserRole;
      search?: string;
      sortBy?: UserSortableField;
      sortOrder?: SortOrder;
    },
    omit: Prisma.UserOmit,
  ) {
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

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        omit,
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

  async create(data: Prisma.UserCreateInput, omit: Prisma.UserOmit) {
    const { name, email, address, ...rest } = data;

    return this.prisma.user.create({
      data: {
        name: name.toLowerCase(),
        email: email.toLowerCase(),
        address: address.toLowerCase(),
        ...rest,
      },
      omit,
    });
  }

  async findWithStats(id: string, omit: Prisma.UserOmit) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        ratings: { omit: { userId: true, updatedAt: true, createdAt: true } },
        ownedStores: {
          omit: { ownerId: true, updatedAt: true, createdAt: true },
        },
      },
      omit,
    });
  }

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
