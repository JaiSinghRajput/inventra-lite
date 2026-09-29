import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { resolveTenantContext } from '../auth/middleware';
import { CustomerService } from './service';
import { createCustomerSchema, updateCustomerSchema } from './schemas';

export const listCustomersFn = createServerFn({ method: 'GET' })
  .validator((params: unknown) => z.object({ search: z.string().optional() }).optional().parse(params))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await CustomerService.listCustomers(context, data?.search);
  });

export const getCustomerDetailsFn = createServerFn({ method: 'GET' })
  .validator((params: unknown) => z.object({ id: z.string() }).parse(params))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await CustomerService.getCustomerDetails(context, data.id);
  });

export const createCustomerFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createCustomerSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await CustomerService.createCustomer(context, data);
  });

export const updateCustomerFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => updateCustomerSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await CustomerService.updateCustomer(context, data);
  });

export const deleteCustomerFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await CustomerService.deleteCustomer(context, data.id);
  });

