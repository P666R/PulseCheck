import type {
  CreateUserDto,
  UserQueryDto,
} from '#src/modules/users/users.dto.js';

import { ConflictError, NotFoundError } from '#src/lib/api/client-error.api.js';
import { logger } from '#src/lib/logger/pino.logger.js';
import { hashPassword } from '#src/lib/utils/password.util.js';
import { UserRepository } from '#src/modules/users/users.repository.js';
import { UserRole } from '@repo/db';

export class UserService {
  private readonly logger = logger.createChild({ service: 'UserService' });
  private readonly defaultOmit = {
    password: true,
    refreshTokens: true,
    passwordChangedAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId, this.defaultOmit);
    if (!user) {
      throw new NotFoundError(`User profile not found`);
    }
    return user;
  }

  async getAllUsers(query: UserQueryDto) {
    return this.userRepository.findAllPaginated(query, this.defaultOmit);
  }

  async createUser(dto: CreateUserDto) {
    const { email, password } = dto;

    const existingUser = await this.userRepository.findByEmail(
      email,
      this.defaultOmit,
    );
    if (existingUser) {
      this.logger.info('Email already registered');
      throw new ConflictError('Email already registered');
    }

    const hashedPassword = await hashPassword(password);

    return this.userRepository.create(
      {
        ...dto,
        password: hashedPassword,
      },
      this.defaultOmit,
    );
  }

  async getUserDetails(userId: string) {
    const user = await this.userRepository.findWithStats(
      userId,
      this.defaultOmit,
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const { ratings, ownedStores, ...rest } = user;

    const filterRating = user.role === UserRole.NORMAL_USER ? { ratings } : {};

    const filterStore =
      user.role === UserRole.STORE_OWNER
        ? { ownedStores: ownedStores }
        : filterRating;

    return {
      ...rest,
      ...(user.role !== UserRole.SYSTEM_ADMIN && { ...filterStore }),
    };
  }

  async getSystemStats() {
    return this.userRepository.getSystemStats();
  }
}
