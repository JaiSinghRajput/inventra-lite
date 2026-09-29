import { pgTable, varchar, bigint, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { bills } from './billing';
import { customers } from './customers';
import { user } from './auth';

export const paymentMethodEnum = pgEnum('payment_method', ['CASH', 'UPI', 'CARD', 'OTHER']);
export const paymentRecordStatusEnum = pgEnum('payment_record_status', ['completed', 'reversed']);

export const payments = pgTable('payments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  billId: varchar('bill_id', { length: 36 }).notNull().references(() => bills.id),
  customerId: varchar('customer_id', { length: 36 }).references(() => customers.id),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  method: paymentMethodEnum('method').notNull(),
  status: paymentRecordStatusEnum('status').notNull().default('completed'),
  referenceNote: varchar('reference_note', { length: 100 }),
  reversedAt: timestamp('reversed_at', { mode: 'date' }),
  reversedBy: varchar('reversed_by', { length: 36 }).references(() => user.id),
  reversalReason: varchar('reversal_reason', { length: 255 }),
  createdBy: varchar('created_by', { length: 36 }).notNull().references(() => user.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  tenantBillIdx: index('idx_payments_tenant_bill').on(table.tenantId, table.billId),
}));
