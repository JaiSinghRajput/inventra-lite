import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../../server/db';
import * as schema from '../../server/db/schema';
import { generateId } from '../../server/utils/id';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user: any) => {
          let tenantId = user.tenantId as string | undefined;
          let role = (user.role as 'OWNER' | 'STAFF') || 'OWNER';

          if (!tenantId) {
            const rawName = String(user.name || 'Store').trim();
            const storeName = `${rawName}'s Store`;
            const cleanName = storeName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const skuPrefix = (cleanName.slice(0, 3) || 'ITM').padEnd(3, 'X');
            tenantId = generateId('ten');

            await db.insert(schema.tenants).values({
              id: tenantId,
              name: storeName,
              skuPrefix,
              nextSkuSeq: 1,
              invoicePrefix: 'INV-',
              nextInvoiceSeq: 1,
              currency: 'INR',
              taxEnabled: false,
              defaultTaxRate: '0.00',
            });
          }

          return {
            data: {
              ...user,
              tenantId,
              role,
              isActive: user.isActive !== false,
            },
          };
        },
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
      requireLocalEmailVerified: false,
    },
  },
  user: {
    additionalFields: {
      tenantId: {
        type: 'string',
        required: false,
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'STAFF',
      },
      isActive: {
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days session
    updateAge: 60 * 60 * 24, // Update session every 24h of activity (sliding session)
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min cache
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  },
  secret: process.env.BETTER_AUTH_SECRET || 'inventra_lite_super_secret_session_key_32_chars_min',
  baseURL: process.env.NODE_ENV === 'development'
    ? (process.env.BETTER_AUTH_DEV_URL || 'http://localhost:5173')
    : (process.env.BETTER_AUTH_URL || 'http://localhost:5173'),
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'https://inventra-lite.vercel.app',
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
});
