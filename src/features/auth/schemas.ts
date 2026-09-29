import { z } from 'zod';

export const registerStoreSchema = z.object({
  storeName: z.string().min(2, 'Store name must be at least 2 characters').max(150),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  currency: z.string().default('INR'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterStoreInput = z.infer<typeof registerStoreSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
