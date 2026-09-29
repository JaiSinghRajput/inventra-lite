import { eq, and, or, like, desc } from 'drizzle-orm';
import { db } from '../../server/db';
import { customers, customerLedgerEntries, auditLogs, user } from '../../server/db/schema';
import { generateId } from '../../server/utils/id';
import type { TenantContext } from '../auth/middleware';
import type { CreateCustomerInput, UpdateCustomerInput } from './schemas';

export class CustomerService {
  static async createCustomer(context: TenantContext, input: CreateCustomerInput) {
    const customerId = generateId('cust');

    await db.insert(customers).values({
      id: customerId,
      tenantId: context.tenantId,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      receivableBalance: 0,
      createdBy: context.userId,
      updatedBy: context.userId,
    });

    await db.insert(auditLogs).values({
      id: generateId('aud'),
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'CREATE_CUSTOMER',
      entityType: 'customer',
      entityId: customerId,
      metadataJson: JSON.stringify({ name: input.name, phone: input.phone }),
    });

    return { id: customerId };
  }

  static async updateCustomer(context: TenantContext, input: UpdateCustomerInput) {
    await db
      .update(customers)
      .set({
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        updatedBy: context.userId,
      })
      .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, input.id)));

    return { success: true };
  }

  static async deleteCustomer(context: TenantContext, customerId: string) {
    // RBAC: Only OWNER can delete customers
    if (context.role !== 'OWNER') {
      throw new Error('Forbidden: Only the store Owner can delete customers.');
    }

    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, customerId)))
        .limit(1);

      if (!existing) throw new Error('Customer not found');

      if (existing.receivableBalance !== 0) {
        throw new Error(`Cannot delete customer with active balance (₹${(existing.receivableBalance / 100).toFixed(2)}). Settle their account first.`);
      }

      const hasEntries = await tx
        .select()
        .from(customerLedgerEntries)
        .where(and(eq(customerLedgerEntries.tenantId, context.tenantId), eq(customerLedgerEntries.customerId, customerId)))
        .limit(1);

      if (hasEntries.length > 0) {
        throw new Error('Cannot delete customer with recorded financial ledger history.');
      }

      await tx.delete(customers).where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, customerId)));

      await tx.insert(auditLogs).values({
        id: generateId('aud'),
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'DELETE_CUSTOMER',
        entityType: 'customer',
        entityId: customerId,
        metadataJson: JSON.stringify({ name: existing.name, phone: existing.phone }),
      });

      return { success: true };
    });
  }

  static async listCustomers(context: TenantContext, search?: string) {
    const conditions = [eq(customers.tenantId, context.tenantId)];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(or(like(customers.name, q), like(customers.phone, q), like(customers.email, q))!);
    }

    return await db
      .select()
      .from(customers)
      .where(and(...conditions))
      .orderBy(desc(customers.updatedAt));
  }

  static async getCustomerDetails(context: TenantContext, customerId: string) {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, customerId)))
      .limit(1);

    if (!customer) return null;

    const [createdUser] = customer.createdBy
      ? await db.select({ name: user.name }).from(user).where(eq(user.id, customer.createdBy)).limit(1)
      : [{ name: null }];
    const [updatedUser] = customer.updatedBy
      ? await db.select({ name: user.name }).from(user).where(eq(user.id, customer.updatedBy)).limit(1)
      : [{ name: null }];

    const ledger = await db
      .select()
      .from(customerLedgerEntries)
      .where(and(eq(customerLedgerEntries.tenantId, context.tenantId), eq(customerLedgerEntries.customerId, customerId)))
      .orderBy(desc(customerLedgerEntries.createdAt))
      .limit(100);

    return {
      customer: {
        ...customer,
        createdByName: createdUser?.name || null,
        updatedByName: updatedUser?.name || null,
      },
      ledger,
    };
  }
}

