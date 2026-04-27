import type { SortOrder, StoreSortableField } from '#src/config/constants.js';

export interface StoreQueryDto {
  page: number;
  limit: number;
  search?: string;
  sortBy?: StoreSortableField;
  sortOrder?: SortOrder;
}

export interface CreateStoreDto {
  name: string;
  email: string;
  address: string;
  ownerId: string;
}

export interface CreateRatingDto {
  rating: number;
}
