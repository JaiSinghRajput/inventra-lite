import { pgTable, varchar, numeric, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { products } from './products';
import { user } from './auth';

export const stockMovementTypeEnum = pgEnum('movement_type', ['sale', 'sale_reversal', 'purchase', 'adjustment', 'return']);

export const stockMovements = pgTable('stock_movements', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  productId: varchar('product_id', { length: 36 }).notNull().references(() => products.id),
  quantityDelta: numeric('quantity_delta', { precision: 12, scale: 3 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 12, scale: 3 }).notNull(),
  movementType: stockMovementTypeEnum('movement_type').notNull(),
  referenceId: varchar('reference_id', { length: 36 }),
  reason: varchar('reason', { length: 255 }),
  createdBy: varchar('created_by', { length: 36 }).notNull().references(() => user.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  tenantProductIdx: index('idx_movements_tenant_product').on(table.tenantId, table.productId, table.createdAt),
}));
