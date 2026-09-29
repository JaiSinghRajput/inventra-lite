import { pgTable, varchar, text, bigint, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { user } from './auth';

export const customerLedgerEntryTypeEnum = pgEnum('customer_ledger_entry_type', [
  'credit_sale',
  'payment_received',
  'adjustment',
  'reversal',
]);

export const customers = pgTable('customers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  name: varchar('name', { length: 150 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 191 }),
  address: text('address'),
  receivableBalance: bigint('receivable_balance', { mode: 'number' }).notNull().default(0),
  createdBy: varchar('created_by', { length: 36 }).references(() => user.id),
  updatedBy: varchar('updated_by', { length: 36 }).references(() => user.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  tenantPhoneIdx: index('idx_customer_tenant_phone').on(table.tenantId, table.phone),
  tenantNameIdx: index('idx_customer_tenant_name').on(table.tenantId, table.name),
}));

export const customerLedgerEntries = pgTable('customer_ledger_entries', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  customerId: varchar('customer_id', { length: 36 }).notNull().references(() => customers.id),
  entryType: customerLedgerEntryTypeEnum('entry_type').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
  billId: varchar('bill_id', { length: 36 }),
  paymentId: varchar('payment_id', { length: 36 }),
  notes: varchar('notes', { length: 255 }),
  createdBy: varchar('created_by', { length: 36 }).notNull().references(() => user.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  tenantCustomerIdx: index('idx_ledger_tenant_cust').on(table.tenantId, table.customerId, table.createdAt),
}));
