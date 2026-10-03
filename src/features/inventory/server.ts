import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { resolveTenantContext } from '../auth/middleware';
import { InventoryService } from './service';
import { createProductSchema, updateProductSchema, adjustStockSchema } from './schemas';

export const listProductsFn = createServerFn({ method: 'GET' })
  .validator((params: unknown) =>
    z
      .object({
        search: z.string().optional(),
        category: z.string().optional(),
        lowStockOnly: z.boolean().optional(),
        stockFilter: z.enum(['all', 'low', 'out', 'in']).optional(),
        status: z.enum(['active', 'inactive']).optional(),
      })
      .optional()
      .parse(params)
  )
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await InventoryService.listProducts(context, data);
  });

export const getProductDetailsFn = createServerFn({ method: 'GET' })
  .validator((params: unknown) => z.object({ id: z.string() }).parse(params))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await InventoryService.getProductDetails(context, data.id);
  });

export const createProductFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createProductSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await InventoryService.createProduct(context, data);
  });

export const updateProductFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => updateProductSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await InventoryService.updateProduct(context, data);
  });

export const adjustStockFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => adjustStockSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await InventoryService.adjustStock(context, data);
  });

export const deleteProductFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await InventoryService.deleteProduct(context, data.id);
  });

