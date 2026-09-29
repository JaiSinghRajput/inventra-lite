import { createServerFn } from '@tanstack/react-start';
import { resolveTenantContext } from '../auth/middleware';
import { PurchaseService } from './service';
import { recordStockInSchema } from './schemas';

export const recordStockInFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => recordStockInSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await PurchaseService.recordStockIn(context, data);
  });

export const listPurchasesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const context = await resolveTenantContext();
  return await PurchaseService.listPurchases(context);
});
