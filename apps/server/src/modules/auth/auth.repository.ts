import type { Prisma } from '@repo/db';

import { db } from '#src/lib/prisma/client.prisma.js';

export class AuthRepository {
  private readonly prisma = db.getClient();

  async register(data: Prisma.UserCreateInput, omit: Prisma.UserOmit) {
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

  async findByEmail(email: string, omit?: Prisma.UserOmit) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      omit,
    });
  }

  async findById(id: string, omit: Prisma.UserOmit) {
    return this.prisma.user.findUnique({
      where: { id },
      omit,
    });
  }

  async updateRefreshTokens(
    id: string,
    tokens: string[],
    omit: Prisma.UserOmit,
  ) {
    return this.prisma.user.update({
      where: { id },
      data: { refreshTokens: tokens },
      omit,
    });
  }

  async updatePassword(
    id: string,
    passwordHash: string,
    omit: Prisma.UserOmit,
  ) {
    return this.prisma.user.update({
      where: { id },
      data: {
        password: passwordHash,
        passwordChangedAt: new Date(),
        refreshTokens: { set: [] },
      },
      omit,
    });
  }

  async findByRefTokenAndDeleteRefToken(
    refreshToken: string,
    omit: Prisma.UserOmit,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { refreshTokens: { has: refreshToken } },
      });

      if (!user) return null;

      const updatedTokens = user.refreshTokens.filter(
        (rt) => rt !== refreshToken,
      );

      return tx.user.update({
        where: { id: user.id },
        data: { refreshTokens: { set: updatedTokens } },
        omit,
      });
    });
  }

  async findByRefTokenAndRotateRefToken(
    oldToken: string,
    newToken: string,
    omit: Prisma.UserOmit,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { refreshTokens: { has: oldToken } },
      });

      if (!user) return null;

      const updatedTokens = [
        ...user.refreshTokens.filter((token) => token !== oldToken),
        newToken,
      ].slice(-5);

      return tx.user.update({
        where: { id: user.id },
        data: { refreshTokens: { set: updatedTokens } },
        omit,
      });
    });
  }
}
