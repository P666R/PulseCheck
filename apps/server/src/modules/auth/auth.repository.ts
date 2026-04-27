import type { Prisma } from '@repo/db';

import { db } from '#src/lib/prisma/client.prisma.js';

export class AuthRepository {
  private readonly prisma = db.getClient();
  private readonly defaultOmit = {
    password: true,
    refreshTokens: true,
  } as const;

  async register(data: Prisma.UserCreateInput) {
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

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      omit: this.defaultOmit,
    });
  }

  async findByEmailInsecure(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      omit: this.defaultOmit,
    });
  }

  async updateRefreshTokens(id: string, tokens: string[]) {
    return this.prisma.user.update({
      where: { id },
      data: { refreshTokens: tokens },
      omit: this.defaultOmit,
    });
  }

  async updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        password: passwordHash,
        passwordChangedAt: new Date(),
        refreshTokens: { set: [] },
      },
      omit: this.defaultOmit,
    });
  }

  async findByRefTokenAndDeleteRefToken(refreshToken: string) {
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
        omit: this.defaultOmit,
      });
    });
  }

  async findByRefTokenAndRotateRefToken(oldToken: string, newToken: string) {
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
        omit: this.defaultOmit,
      });
    });
  }
}
