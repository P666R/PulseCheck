import type {
  CreateUserDto,
  UserQueryDto,
} from '#src/modules/users/users.dto.js';

import { ConflictError, NotFoundError } from '#src/lib/api/client-error.api.js';
import { logger } from '#src/lib/logger/pino.logger.js';
import { hashPassword } from '#src/lib/utils/password.util.js';
import { UserRepository } from '#src/modules/users/users.repository.js';

export class UserService {
  private readonly logger = logger.createChild({ service: 'UserService' });

  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User profile not found`);
    }
    return user;
  }

  async getAllUsers(query: UserQueryDto) {
    return this.userRepository.findAllPaginated(query);
  }

  async createUser(dto: CreateUserDto) {
    const { email, password } = dto;

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      this.logger.info('Email already registered');
      throw new ConflictError('Email already registered');
    }

    const hashedPassword = await hashPassword(password);

    return this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });
  }

  async getUserDetails(userId: string) {
    const user = await this.userRepository.findWithStats(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async getSystemStats() {
    return this.userRepository.getSystemStats();
  }
}
