import { eq, and } from 'drizzle-orm';
import { db } from '../../server/db';
import { tenants, user } from '../../server/db/schema';
import { enforceOwner, type TenantContext } from '../auth/middleware';
import { auth } from '../auth/auth-server';

export class SettingsService {
  static async getStoreSettings(context: TenantContext) {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, context.tenantId)).limit(1);
    return t || null;
  }

  static async updateStoreSettings(
    context: TenantContext,
    input: { name?: string; taxEnabled?: boolean; defaultTaxRate?: number }
  ) {
    enforceOwner(context);

    await db
      .update(tenants)
      .set({
        name: input.name?.trim(),
        taxEnabled: input.taxEnabled !== undefined ? input.taxEnabled : undefined,
        defaultTaxRate: input.defaultTaxRate !== undefined ? input.defaultTaxRate.toFixed(2) : undefined,
      })
      .where(eq(tenants.id, context.tenantId));

    return { success: true };
  }

  static async listStaff(context: TenantContext) {
    return await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.tenantId, context.tenantId));
  }

  static async addStaff(
    context: TenantContext,
    input: { name: string; email: string; password: string; role?: 'OWNER' | 'STAFF' }
  ) {
    enforceOwner(context);

    const newUser = await auth.api.signUpEmail({
      body: {
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        password: input.password,
        tenantId: context.tenantId,
        role: input.role || 'STAFF',
        isActive: true,
      },
    });

    return { success: true, user: newUser };
  }

  static async toggleStaffStatus(context: TenantContext, targetUserId: string) {
    enforceOwner(context);
    if (targetUserId === context.userId) {
      throw new Error('You cannot deactivate your own account');
    }

    const [target] = await db
      .select()
      .from(user)
      .where(and(eq(user.tenantId, context.tenantId), eq(user.id, targetUserId)))
      .limit(1);

    if (!target) throw new Error('Staff member not found');

    const newStatus = !target.isActive;
    await db
      .update(user)
      .set({ isActive: newStatus })
      .where(and(eq(user.tenantId, context.tenantId), eq(user.id, targetUserId)));

    return { success: true, isActive: newStatus };
  }
}
