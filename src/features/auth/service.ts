import { eq, and } from 'drizzle-orm';
import { db } from '../../server/db';
import { tenants, user, account, tenantMemberships } from '../../server/db/schema';
import { generateId } from '../../server/utils/id';
import { auth } from './auth-server';
import type { RegisterStoreInput } from './schemas';

export class AuthService {
  static async registerStore(input: RegisterStoreInput) {
    const existingUser = await db.select().from(user).where(eq(user.email, input.email.toLowerCase().trim())).limit(1);
    if (existingUser.length > 0) {
      const existingAccount = await db
        .select()
        .from(account)
        .where(and(eq(account.userId, existingUser[0].id), eq(account.providerId, 'credential')))
        .limit(1);

      if (existingAccount.length === 0) {
        throw new Error('An account with this email was created via Google Sign-In. Please sign in with Google.');
      }
      throw new Error('An account with this email address already exists. Please sign in.');
    }

    // Derive 3-to-4 letter uppercase prefix from store name (e.g. "Raj Hardware" -> "RAJ")
    const cleanName = input.storeName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const skuPrefix = (cleanName.slice(0, 3) || 'ITM').padEnd(3, 'X');

    const tenantId = generateId('ten');

    // Create tenant
    await db.insert(tenants).values({
      id: tenantId,
      name: input.storeName.trim(),
      skuPrefix,
      nextSkuSeq: 1,
      invoicePrefix: 'INV-',
      nextInvoiceSeq: 1,
      currency: input.currency || 'INR',
      taxEnabled: false,
      defaultTaxRate: '0.00',
    });

    // Create owner user via Better Auth
    const newUser = await auth.api.signUpEmail({
      body: {
        name: input.ownerName.trim(),
        email: input.email.toLowerCase().trim(),
        password: input.password,
        tenantId,
        role: 'OWNER',
        isActive: true,
      },
    });

    // Explicitly create tenant membership record for the new store owner
    const membershipId = generateId('mem');
    await db.insert(tenantMemberships).values({
      id: membershipId,
      tenantId,
      userId: newUser.user.id,
      role: 'OWNER',
      isActive: true,
    });

    return {
      success: true,
      tenantId,
      user: newUser,
    };
  }

  static async getTenant(tenantId: string) {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    return t || null;
  }
}
