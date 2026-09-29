import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { resolveTenantContext } from '../auth/middleware';
import { BillingService } from './service';
import { checkoutBillSchema, cancelBillSchema } from './schemas';

export const lookupPosItemsFn = createServerFn({ method: 'GET' })
  .validator((params: unknown) => z.object({ query: z.string() }).parse(params))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await BillingService.lookupPosItems(context, data.query);
  });

export const checkoutBillFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => checkoutBillSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await BillingService.checkoutBill(context, data);
  });

export const listBillsFn = createServerFn({ method: 'GET' })
  .validator((params: unknown) =>
    z
      .object({
        customerId: z.string().optional(),
        status: z.enum(['completed', 'cancelled']).optional(),
        paymentStatus: z.enum(['unpaid', 'partial', 'paid']).optional(),
      })
      .optional()
      .parse(params)
  )
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await BillingService.listBills(context, data);
  });

export const getBillDetailsFn = createServerFn({ method: 'GET' })
  .validator((params: unknown) => z.object({ id: z.string() }).parse(params))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await BillingService.getBillDetails(context, data.id);
  });

export const cancelBillFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => cancelBillSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await BillingService.cancelBill(context, data);
  });
