import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { resolveTenantContext } from '../auth/middleware';
import { StaffService } from './service';

const roleSchema = z.enum(['OWNER', 'MANAGER', 'CASHIER']);

export const listStaffFn = createServerFn({ method: 'GET' }).handler(async () => {
  const context = await resolveTenantContext();
  return await StaffService.listStaff(context);
});

export const addStaffFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z
      .object({
        email: z.string().email(),
        role: roleSchema,
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await StaffService.addStaff(context, data);
  });

export const updateStaffRoleFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z
      .object({
        membershipId: z.string(),
        role: roleSchema,
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await StaffService.updateRole(context, data);
  });

export const toggleStaffStatusFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z
      .object({
        membershipId: z.string(),
        isActive: z.boolean(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await StaffService.toggleStatus(context, data);
  });

export const removeStaffFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z
      .object({
        membershipId: z.string(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await StaffService.removeStaff(context, data);
  });

export const listUserStoresFn = createServerFn({ method: 'GET' }).handler(async () => {
  const context = await resolveTenantContext();
  return await StaffService.listUserStores(context);
});

export const createNewStoreFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z
      .object({
        name: z.string().min(2),
        currency: z.string().default('INR'),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await StaffService.createStore(context, data);
  });
