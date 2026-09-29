import { createServerFn } from '@tanstack/react-start';
import { resolveTenantContext } from '../auth/middleware';
import { PaymentService } from './service';
import { recordSubsequentPaymentSchema, reversePaymentSchema } from './schemas';

export const recordSubsequentPaymentFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => recordSubsequentPaymentSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await PaymentService.recordSubsequentPayment(context, data);
  });

export const reversePaymentFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => reversePaymentSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await PaymentService.reversePayment(context, data);
  });
