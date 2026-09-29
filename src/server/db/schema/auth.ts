import { pgTable, varchar, text, boolean, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const userRoleEnum = pgEnum('user_role', ['OWNER', 'STAFF']);
export const membershipRoleEnum = pgEnum('membership_role', ['OWNER', 'MANAGER', 'CASHIER']);

export const user = pgTable('user', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 191 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  tenantId: varchar('tenant_id', { length: 36 }).references(() => tenants.id),
  role: userRoleEnum('role').notNull().default('STAFF'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  tenantIdx: index('idx_user_tenant').on(table.tenantId),
}));

export const tenantMemberships = pgTable('tenant_memberships', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 36 }).references(() => user.id, { onDelete: 'cascade' }),
  invitedEmail: varchar('invited_email', { length: 191 }),
  role: membershipRoleEnum('role').notNull().default('CASHIER'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  tenantIdx: index('idx_membership_tenant').on(table.tenantId),
  userIdx: index('idx_membership_user').on(table.userId),
  emailIdx: index('idx_membership_email').on(table.invitedEmail),
  tenantUserUq: uniqueIndex('uq_membership_tenant_user').on(table.tenantId, table.userId),
}));

export const session = pgTable('session', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  userIdx: index('idx_session_user').on(table.userId),
}));

export const account = pgTable('account', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 50 }).notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { mode: 'date' }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { mode: 'date' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  userIdx: index('idx_account_user').on(table.userId),
}));

export const verification = pgTable('verification', {
  id: varchar('id', { length: 36 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date()),
});

