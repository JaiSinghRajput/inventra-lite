
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { resolveTenantContext } from '../auth/middleware';
import { SettingsService } from './service';
import { StaffService } from '../staff/service';

const membershipRoleSchema = z.enum(['OWNER', 'MANAGER', 'CASHIER']);

export const getStoreSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const context = await resolveTenantContext();
  return await SettingsService.getStoreSettings(context);
});

export const updateStoreSettingsFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z
      .object({
        name: z.string().optional(),
        taxEnabled: z.boolean().optional(),
        defaultTaxRate: z.number().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const context = await resolveTenantContext();
    return await SettingsService.updateStoreSettings(context, data);
  });

export const listStaffFn = createServerFn({ method: 'GET' }).handler(async () => {
  const context = await resolveTenantContext();
  return await StaffService.listStaff(context);
});

export const addStaffFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z
      .object({
        email: z.string().email(),
        role: membershipRoleSchema.default('CASHIER'),
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
        role: membershipRoleSchema,
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
  .validator((data: unknown) => z.object({ membershipId: z.string() }).parse(data))
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

