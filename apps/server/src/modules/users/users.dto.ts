import type { SortOrder, UserSortableField } from '#src/config/constants.js';

import { UserRole } from '@repo/db';

export interface UserQueryDto {
  page: number;
  limit: number;
  role?: UserRole;
  search?: string;
  sortBy?: UserSortableField;
  sortOrder?: SortOrder;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  address: string;
  role: UserRole;
}
