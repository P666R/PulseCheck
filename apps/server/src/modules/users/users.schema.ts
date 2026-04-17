import validator from 'validator';
import * as z from 'zod';

import { UserSortableField, UserSortOrder } from '#src/config/constants.js';
import { passwordStrength } from '#src/lib/utils/password-strength.util.js';
import { UserRole } from '@repo/db';

// Reusable base schemas
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
  .trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(80, 'Password cannot be longer than 80 characters')
  .trim();

export const passwordConfirmSchema = z
  .string()
  .min(1, 'Password confirmation is required')
  .trim();

export const roleSchema = z
  .enum(UserRole)
  .optional()
  .default(UserRole.NORMAL_USER);

export const pageSchema = z.coerce.number().min(1).default(1);

export const limitSchema = z.coerce.number().min(1).max(100).default(10);

export const searchSchema = z.string().trim().optional();

export const sortBySchema = z
  .enum(UserSortableField)
  .default(UserSortableField.CREATED_AT);

export const sortOrderSchema = z
  .enum(UserSortOrder)
  .default(UserSortOrder.DESC);

export const idSchema = z.uuidv4({
  version: 'v4',
  error: 'Invalid identifier format',
});

// Schemas
export const createUserSchema = z
  .strictObject({
    name: nameSchema,
    email: emailSchema,
    address: addressSchema,
    password: passwordSchema.refine((v) => passwordStrength(v), {
      error:
        'Password is too weak. Try a longer phrase or add more unique words',
    }),
    passwordConfirm: passwordConfirmSchema,
    role: roleSchema,
  })
  .refine((v) => v.password === v.passwordConfirm, {
    error: 'Passwords do not match',
    path: ['passwordConfirm'],
  })
  .readonly();

export const userQuerySchema = z
  .strictObject({
    page: pageSchema,
    limit: limitSchema,
    role: roleSchema,
    search: searchSchema,
    sortBy: sortBySchema,
    sortOrder: sortOrderSchema,
  })
  .readonly();

export const userIdSchema = z
  .strictObject({
    id: idSchema,
  })
  .readonly();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type UserIdInput = z.infer<typeof userIdSchema>;
