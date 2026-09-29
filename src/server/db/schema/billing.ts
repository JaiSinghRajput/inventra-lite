import { pgTable, varchar, numeric, bigint, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { user } from './auth';
import { customers } from './customers';
import { products } from './products';

export const billStatusEnum = pgEnum('bill_status', ['completed', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'partial', 'paid', 'reversed']);
export const billChargeTypeEnum = pgEnum('bill_charge_type', ['labour', 'service', 'installation', 'delivery', 'other']);

export const bills = pgTable('bills', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  billNumber: varchar('bill_number', { length: 30 }).notNull(),
  customerId: varchar('customer_id', { length: 36 }).references(() => customers.id),
  status: billStatusEnum('status').notNull().default('completed'),
  paymentStatus: paymentStatusEnum('payment_status').notNull(),
  itemsSubtotal: bigint('items_subtotal', { mode: 'number' }).notNull(),
  chargesTotal: bigint('charges_total', { mode: 'number' }).notNull().default(0),
  discountTotal: bigint('discount_total', { mode: 'number' }).notNull().default(0),
  taxTotal: bigint('tax_total', { mode: 'number' }).notNull().default(0),
  grandTotal: bigint('grand_total', { mode: 'number' }).notNull(),
  paidAmount: bigint('paid_amount', { mode: 'number' }).notNull().default(0),
  dueAmount: bigint('due_amount', { mode: 'number' }).notNull().default(0),
  createdBy: varchar('created_by', { length: 36 }).notNull().references(() => user.id),
  idempotencyKey: varchar('idempotency_key', { length: 64 }).notNull(),
  cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
  cancelledBy: varchar('cancelled_by', { length: 36 }).references(() => user.id),
  cancelReason: varchar('cancel_reason', { length: 255 }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  tenantBillNumUq: uniqueIndex('uq_tenant_bill_number').on(table.tenantId, table.billNumber),
  tenantIdempotencyUq: uniqueIndex('uq_tenant_idempotency').on(table.tenantId, table.idempotencyKey),
  tenantCreatedIdx: index('idx_tenant_bills_created').on(table.tenantId, table.createdAt),
}));

export const billItems = pgTable('bill_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  billId: varchar('bill_id', { length: 36 }).notNull().references(() => bills.id, { onDelete: 'cascade' }),
  productId: varchar('product_id', { length: 36 }).notNull().references(() => products.id),
  productName: varchar('product_name', { length: 191 }).notNull(),
  sku: varchar('sku', { length: 30 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  unitPrice: bigint('unit_price', { mode: 'number' }).notNull(),
  purchasePrice: bigint('purchase_price', { mode: 'number' }).notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
  lineDiscount: bigint('line_discount', { mode: 'number' }).notNull().default(0),
  lineTotal: bigint('line_total', { mode: 'number' }).notNull(),
}, (table) => ({
  tenantBillIdx: index('idx_bill_items_bill').on(table.tenantId, table.billId),
}));

export const billCharges = pgTable('bill_charges', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  billId: varchar('bill_id', { length: 36 }).notNull().references(() => bills.id, { onDelete: 'cascade' }),
  chargeType: billChargeTypeEnum('charge_type').notNull(),
  description: varchar('description', { length: 150 }),
  amount: bigint('amount', { mode: 'number' }).notNull(),
}, (table) => ({
  tenantBillIdx: index('idx_bill_charges_bill').on(table.tenantId, table.billId),
}));
