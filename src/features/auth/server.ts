import { createServerFn } from '@tanstack/react-start';
import { resolveTenantContext } from './middleware';
import { AuthService } from './service';
import { registerStoreSchema } from './schemas';

export const getViewerFn = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const context = await resolveTenantContext();
    const tenant = await AuthService.getTenant(context.tenantId);
    return { user: context, tenant };
  } catch {
    return { user: null, tenant: null };
  }
});

export const registerStoreFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => registerStoreSchema.parse(data))
  .handler(async ({ data }) => {
    return await AuthService.registerStore(data);
  });
