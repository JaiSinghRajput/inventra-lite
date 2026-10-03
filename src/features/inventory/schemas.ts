import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(191),
  sellingPrice: z.number().int().positive('Selling price must be greater than 0'),
  purchasePrice: z.number().int().nonnegative('Purchase price cannot be negative').default(0),
  unit: z.string().default('unit'),
  initialStock: z.number().int('Stock quantity must be a whole integer').nonnegative('Initial stock cannot be negative').default(0),
  lowStockThreshold: z.number().int('Low stock threshold must be a whole integer').nonnegative('Low stock threshold cannot be negative').nullable().optional(),
  features: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  barcode: z.string().max(64).optional(),
  imageUrl: z.string().max(500).optional(),
});

export const updateProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(191),
  sellingPrice: z.number().int().positive(),
  purchasePrice: z.number().int().nonnegative().default(0),
  unit: z.string().default('unit'),
  lowStockThreshold: z.number().int('Low stock threshold must be a whole integer').nonnegative('Low stock threshold cannot be negative').nullable().optional(),
  features: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  barcode: z.string().max(64).optional(),
  imageUrl: z.string().max(500).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const adjustStockSchema = z.object({
  productId: z.string(),
  delta: z.number().int('Adjustment quantity must be a whole integer'), // positive to add, negative to subtract
  reason: z.string().min(3, 'Audit reason is mandatory for stock adjustments'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
