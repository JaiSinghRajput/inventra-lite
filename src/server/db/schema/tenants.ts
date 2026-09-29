import { pgTable, varchar, integer, boolean, numeric, timestamp } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  skuPrefix: varchar('sku_prefix', { length: 10 }).notNull(),
  nextSkuSeq: integer('next_sku_seq').notNull().default(1),
  invoicePrefix: varchar('invoice_prefix', { length: 10 }).notNull().default('INV-'),
  nextInvoiceSeq: integer('next_invoice_seq').notNull().default(1),
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  taxEnabled: boolean('tax_enabled').notNull().default(false),
  defaultTaxRate: numeric('default_tax_rate', { precision: 5, scale: 2 }).notNull().default('0.00'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date()),
});
