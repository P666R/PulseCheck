import validator from 'validator';
import * as z from 'zod';

import { SortOrder, StoreSortableField } from '#src/config/constants.js';

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .trim()
  .toLowerCase()
  .refine((v) => validator.isEmail(v), { error: 'Invalid email address' });

export const nameSchema = z
  .string()
  .min(20, 'Name must be at least 20 characters')
  .max(60, 'Name must be at most 60 characters')
  .trim()
  .toLowerCase();

export const addressSchema = z
  .string()
  .min(1, 'Address is required')
  .max(400, 'Address must be at most 400 characters')
  .trim()
  .toLowerCase();

export const idSchema = z.uuidv4({
  version: 'v4',
  error: 'Invalid identifier format',
});

export const pageSchema = z.coerce.number().min(1).default(1);

export const limitSchema = z.coerce.number().min(1).max(100).default(10);

export const searchSchema = z.string().trim().optional();

export const sortBySchema = z
  .enum(StoreSortableField)
  .default(StoreSortableField.CREATED_AT);

export const sortOrderSchema = z.enum(SortOrder).default(SortOrder.DESC);

export const ratingSchema = z.coerce
  .number()
  .min(1, 'Rating must be at least 1')
  .max(5, 'Rating must be at most 5')
  .refine((v) => Number.isInteger(v), { error: 'Rating must be an integer' });

export const createStoreSchema = z
  .strictObject({
    name: nameSchema,
    email: emailSchema,
    address: addressSchema,
    ownerId: idSchema,
  })
  .readonly();

export const storeQuerySchema = z.strictObject({
  page: pageSchema,
  limit: limitSchema,
  search: searchSchema,
  sortBy: sortBySchema,
  sortOrder: sortOrderSchema,
});

export const storeIdSchema = z
  .strictObject({
    id: idSchema,
  })
  .readonly();

export const createRatingSchema = z
  .strictObject({
    rating: ratingSchema,
  })
  .readonly();

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type StoreQueryInput = z.infer<typeof storeQuerySchema>;
export type StoreIdInput = z.infer<typeof storeIdSchema>;
export type CreateRatingInput = z.infer<typeof createRatingSchema>;
