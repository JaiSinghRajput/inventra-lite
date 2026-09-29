import { pgTable, varchar, text, numeric, bigint, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { user } from './auth';

export const productStatusEnum = pgEnum('product_status', ['active', 'inactive']);

export const products = pgTable('products', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  sku: varchar('sku', { length: 30 }).notNull(),
  name: varchar('name', { length: 191 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  stockQuantity: numeric('stock_quantity', { precision: 12, scale: 3 }).notNull().default('0.000'),
  unit: varchar('unit', { length: 20 }).notNull().default('unit'),
  sellingPrice: bigint('selling_price', { mode: 'number' }).notNull(),
  purchasePrice: bigint('purchase_price', { mode: 'number' }).notNull().default(0),
  lowStockThreshold: numeric('low_stock_threshold', { precision: 12, scale: 3 }),
  features: text('features'),
  category: varchar('category', { length: 50 }),
  barcode: varchar('barcode', { length: 64 }),
  status: productStatusEnum('status').notNull().default('active'),
  createdBy: varchar('created_by', { length: 36 }).references(() => user.id),
  updatedBy: varchar('updated_by', { length: 36 }).references(() => user.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  tenantSkuUq: uniqueIndex('uq_tenant_sku').on(table.tenantId, table.sku),
  tenantLookupIdx: index('idx_tenant_product_lookup').on(table.tenantId, table.status, table.name),
  tenantBarcodeIdx: index('idx_tenant_barcode').on(table.tenantId, table.barcode),
}));
