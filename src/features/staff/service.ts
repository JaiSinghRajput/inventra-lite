import { eq, and } from 'drizzle-orm';
import { db } from '../../server/db';
import { tenantMemberships, user, tenants, auditLogs } from '../../server/db/schema';
import { generateId } from '../../server/utils/id';
import { enforceOwner, enforceManagerOrOwner, type TenantContext, type Role } from '../auth/middleware';

export class StaffService {
  static async listStaff(context: TenantContext) {
    enforceManagerOrOwner(context);

    const members = await db
      .select({
        id: tenantMemberships.id,
        tenantId: tenantMemberships.tenantId,
        userId: tenantMemberships.userId,
        invitedEmail: tenantMemberships.invitedEmail,
        role: tenantMemberships.role,
        isActive: tenantMemberships.isActive,
        createdAt: tenantMemberships.createdAt,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(tenantMemberships)
      .leftJoin(user, eq(tenantMemberships.userId, user.id))
      .where(eq(tenantMemberships.tenantId, context.tenantId));

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.email || m.invitedEmail || '',
      name: m.name || 'Invited Staff',
      role: m.role as Role,
      isActive: m.isActive,
      isPending: !m.userId,
      createdAt: m.createdAt,
    }));
  }

  static async addStaff(context: TenantContext, input: { email: string; role: Role }) {
    enforceOwner(context);
    const cleanEmail = input.email.trim().toLowerCase();

    // Check if user already exists in the system
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, cleanEmail))
      .limit(1);

    // Check if membership already exists in this tenant
    const existingMembership = existingUser
      ? await db
          .select()
          .from(tenantMemberships)
          .where(
            and(
              eq(tenantMemberships.tenantId, context.tenantId),
              eq(tenantMemberships.userId, existingUser.id)
            )
          )
          .limit(1)
      : await db
          .select()
          .from(tenantMemberships)
          .where(
            and(
              eq(tenantMemberships.tenantId, context.tenantId),
              eq(tenantMemberships.invitedEmail, cleanEmail)
            )
          )
          .limit(1);

    if (existingMembership.length > 0) {
      throw new Error('This user is already added to this store.');
    }

    const membershipId = generateId('mem');
    await db.insert(tenantMemberships).values({
      id: membershipId,
      tenantId: context.tenantId,
      userId: existingUser ? existingUser.id : null,
      invitedEmail: cleanEmail,
      role: input.role,
      isActive: true,
    });

    await db.insert(auditLogs).values({
      id: generateId('aud'),
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'ADD_STAFF',
      entityType: 'staff',
      entityId: membershipId,
      metadataJson: JSON.stringify({ email: cleanEmail, role: input.role }),
    });

    return { success: true, membershipId };
  }

  static async updateRole(context: TenantContext, input: { membershipId: string; role: Role }) {
    enforceOwner(context);

    const [mem] = await db
      .select()
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.id, input.membershipId),
          eq(tenantMemberships.tenantId, context.tenantId)
        )
      )
      .limit(1);

    if (!mem) throw new Error('Staff membership not found');

    // Prevent removing the last owner
    if (mem.role === 'OWNER' && input.role !== 'OWNER') {
      const owners = await db
        .select()
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, context.tenantId),
            eq(tenantMemberships.role, 'OWNER'),
            eq(tenantMemberships.isActive, true)
          )
        );
      if (owners.length <= 1) {
        throw new Error('A store must have at least one active Owner.');
      }
    }

    await db
      .update(tenantMemberships)
      .set({ role: input.role })
      .where(eq(tenantMemberships.id, input.membershipId));

    return { success: true };
  }

  static async toggleStatus(context: TenantContext, input: { membershipId: string; isActive: boolean }) {
    enforceOwner(context);

    const [mem] = await db
      .select()
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.id, input.membershipId),
          eq(tenantMemberships.tenantId, context.tenantId)
        )
      )
      .limit(1);

    if (!mem) throw new Error('Staff membership not found');

    if (mem.userId === context.userId && !input.isActive) {
      throw new Error('You cannot deactivate your own access.');
    }

    await db
      .update(tenantMemberships)
      .set({ isActive: input.isActive })
      .where(eq(tenantMemberships.id, input.membershipId));

    return { success: true };
  }

  static async removeStaff(context: TenantContext, input: { membershipId: string }) {
    enforceOwner(context);

    const [mem] = await db
      .select()
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.id, input.membershipId),
          eq(tenantMemberships.tenantId, context.tenantId)
        )
      )
      .limit(1);

    if (!mem) throw new Error('Staff membership not found');

    if (mem.userId === context.userId) {
      throw new Error('You cannot remove yourself from the store.');
    }

    await db
      .delete(tenantMemberships)
      .where(eq(tenantMemberships.id, input.membershipId));

    return { success: true };
  }

  static async listUserStores(context: TenantContext) {
    const list = await db
      .select({
        tenantId: tenants.id,
        name: tenants.name,
        skuPrefix: tenants.skuPrefix,
        currency: tenants.currency,
        role: tenantMemberships.role,
        isActive: tenantMemberships.isActive,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .where(and(eq(tenantMemberships.userId, context.userId), eq(tenantMemberships.isActive, true)));

    return list;
  }

  static async createStore(context: TenantContext, input: { name: string; currency?: string }) {
    const storeName = input.name.trim();
    if (!storeName) throw new Error('Store name is required');

    const cleanName = storeName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const skuPrefix = (cleanName.slice(0, 3) || 'ITM').padEnd(3, 'X');
    const newTenantId = generateId('ten');

    await db.insert(tenants).values({
      id: newTenantId,
      name: storeName,
      skuPrefix,
      nextSkuSeq: 1,
      invoicePrefix: 'INV-',
      nextInvoiceSeq: 1,
      currency: input.currency || 'INR',
      taxEnabled: false,
      defaultTaxRate: '0.00',
    });

    const membershipId = generateId('mem');
    await db.insert(tenantMemberships).values({
      id: membershipId,
      tenantId: newTenantId,
      userId: context.userId,
      role: 'OWNER',
      isActive: true,
    });

    return { success: true, tenantId: newTenantId, name: storeName };
  }
}
