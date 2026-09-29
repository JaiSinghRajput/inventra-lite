import { pgTable, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { user } from './auth';

export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => user.id),
  action: varchar('action', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 36 }).notNull(),
  metadataJson: text('metadata_json'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  tenantActionIdx: index('idx_audit_tenant_action').on(table.tenantId, table.action, table.createdAt),
}));
