import validator from 'validator';
import * as z from 'zod';

import { passwordStrength } from '#src/lib/utils/password-strength.util.js';

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

// Schemas
export const registerSchema = z
  .strictObject({
    name: nameSchema,
    email: emailSchema,
    address: addressSchema,
    password: passwordSchema.refine((v) => passwordStrength(v), {
      error:
        'Password is too weak. Try a longer phrase or add more unique words',
    }),
    passwordConfirm: passwordConfirmSchema,
  })
  .refine((v) => v.password === v.passwordConfirm, {
    error: 'Passwords do not match',
    path: ['passwordConfirm'],
  })
  .readonly();

export const loginSchema = z
  .strictObject({
    email: emailSchema,
    password: passwordSchema,
  })
  .readonly();

export const updatePasswordSchema = z
  .strictObject({
    password: passwordSchema.refine((v) => passwordStrength(v), {
      error:
        'Password is too weak. Try a longer phrase or add more unique words',
    }),
    passwordConfirm: passwordConfirmSchema,
  })
  .refine((v) => v.password === v.passwordConfirm, {
    error: 'Passwords do not match',
    path: ['passwordConfirm'],
  })
  .readonly();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
