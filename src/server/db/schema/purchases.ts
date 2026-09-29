import { pgTable, varchar, numeric, bigint, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { products } from './products';
import { user } from './auth';

export const suppliers = pgTable('suppliers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  name: varchar('name', { length: 150 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 191 }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  tenantIdx: index('idx_suppliers_tenant').on(table.tenantId),
}));

export const purchases = pgTable('purchases', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  supplierId: varchar('supplier_id', { length: 36 }).references(() => suppliers.id),
  referenceInvoice: varchar('reference_invoice', { length: 50 }),
  totalAmount: bigint('total_amount', { mode: 'number' }).notNull().default(0),
  notes: text('notes'),
  createdBy: varchar('created_by', { length: 36 }).notNull().references(() => user.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  tenantPurchasesIdx: index('idx_purchases_tenant').on(table.tenantId, table.createdAt),
}));

export const purchaseItems = pgTable('purchase_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  purchaseId: varchar('purchase_id', { length: 36 }).notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  productId: varchar('product_id', { length: 36 }).notNull().references(() => products.id),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
  unitCost: bigint('unit_cost', { mode: 'number' }).notNull(),
  totalCost: bigint('total_cost', { mode: 'number' }).notNull(),
}, (table) => ({
  tenantPurchaseItemsIdx: index('idx_purchase_items_purchase').on(table.tenantId, table.purchaseId),
}));
