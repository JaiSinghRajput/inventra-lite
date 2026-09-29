import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { resolveTenantContext } from '../auth/middleware';
import { ReportsService } from './service';

export const getDailySalesSummaryFn = createServerFn({ method: 'GET' })
  .validator((params: unknown) => z.object({ date: z.string().optional() }).optional().parse(params))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await ReportsService.getDailySalesSummary(context, data?.date);
  });

export const getLowStockAlertsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const context = await resolveTenantContext();
  return await ReportsService.getLowStockAlerts(context);
});
