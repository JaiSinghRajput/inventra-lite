import { getRequest } from '@tanstack/react-start/server';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from './auth-server';
import { db } from '../../server/db';
import * as schema from '../../server/db/schema';
import { generateId } from '../../server/utils/id';
import { Role, canDeleteInventoryOrCustomer } from '../../lib/permissions';

export type { Role };
export { canDeleteInventoryOrCustomer };

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: Role;
}

export async function resolveTenantContext(request?: Request): Promise<TenantContext> {
  let req = request;
  if (!req) {
    try {
      req = getRequest();
    } catch {
      // ignore outside request scope
    }
  }

  if (!req) {
    throw new Response('Unauthorized: No active request', { status: 401 });
  }

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session || !session.user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const user = session.user as Record<string, any>;
  if (user.isActive === false) {
    throw new Response('Forbidden: Account is deactivated', { status: 403 });
  }

  const userEmail = (user.email as string).toLowerCase().trim();

  // 1. Auto-claim any invitations sent to this user's email
  const pendingInvites = await db.select().from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.invitedEmail, userEmail), isNull(schema.tenantMemberships.userId)));

  for (const invite of pendingInvites) {
    await db.update(schema.tenantMemberships)
      .set({ userId: user.id })
      .where(eq(schema.tenantMemberships.id, invite.id));
  }

  // 2. Fetch all active memberships for this user
  let memberships = await db.select({
    membershipId: schema.tenantMemberships.id,
    tenantId: schema.tenantMemberships.tenantId,
    role: schema.tenantMemberships.role,
    isActive: schema.tenantMemberships.isActive,
    tenantName: schema.tenants.name,
  })
  .from(schema.tenantMemberships)
  .innerJoin(schema.tenants, eq(schema.tenantMemberships.tenantId, schema.tenants.id))
  .where(and(
    eq(schema.tenantMemberships.userId, user.id),
    eq(schema.tenantMemberships.isActive, true)
  ));

  // 3. If no memberships found: check if user had legacy tenantId or auto-provision a store
  if (memberships.length === 0) {
    let tenantId = user.tenantId as string | undefined;
    let storeName = `${String(user.name || 'Store').trim()}'s Store`;

    if (tenantId) {
      const [existingTenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
      if (existingTenant) {
        storeName = existingTenant.name;
      }
    }

    if (!tenantId) {
      const cleanName = storeName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const skuPrefix = (cleanName.slice(0, 3) || 'ITM').padEnd(3, 'X');
      tenantId = generateId('ten');

      await db.insert(schema.tenants).values({
        id: tenantId,
        name: storeName,
        skuPrefix,
        nextSkuSeq: 1,
        invoicePrefix: 'INV-',
        nextInvoiceSeq: 1,
        currency: 'INR',
        taxEnabled: false,
        defaultTaxRate: '0.00',
      });
    }

    const membershipId = generateId('mem');
    await db.insert(schema.tenantMemberships).values({
      id: membershipId,
      tenantId,
      userId: user.id,
      role: 'OWNER',
      isActive: true,
    });

    memberships = [{
      membershipId,
      tenantId,
      role: 'OWNER',
      isActive: true,
      tenantName: storeName,
    }];
  }

  // 4. Determine which tenant is active (cookie or header)
  let requestedTenantId: string | null = null;
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/inventra_active_tenant=([^;]+)/);
  if (match) {
    requestedTenantId = decodeURIComponent(match[1].trim());
  }
  if (!requestedTenantId) {
    requestedTenantId = req.headers.get('x-tenant-id');
  }

  let activeMembership = memberships[0];
  if (requestedTenantId) {
    const found = memberships.find((m) => m.tenantId === requestedTenantId);
    if (found) {
      activeMembership = found;
    }
  }

  return {
    tenantId: activeMembership.tenantId,
    tenantName: activeMembership.tenantName,
    userId: user.id as string,
    userName: user.name as string,
    userEmail: user.email as string,
    role: activeMembership.role as Role,
  };
}

export function enforceOwner(context: TenantContext): void {
  if (context.role !== 'OWNER') {
    throw new Response('Forbidden: OWNER role required for this action', { status: 403 });
  }
}

export function enforceManagerOrOwner(context: TenantContext): void {
  if (context.role !== 'OWNER' && context.role !== 'MANAGER') {
    throw new Response('Forbidden: MANAGER or OWNER role required for this action', { status: 403 });
  }
}
