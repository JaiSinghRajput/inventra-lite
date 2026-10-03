import { eq, and, sql, desc, or, like, inArray } from 'drizzle-orm';
import { db } from '../../server/db';
import {
  bills,
  billItems,
  billCharges,
  payments,
  products,
  stockMovements,
  customers,
  customerLedgerEntries,
  tenants,
  auditLogs,
} from '../../server/db/schema';
import { generateId } from '../../server/utils/id';
import { enforceOwner, type TenantContext } from '../auth/middleware';
import type { CheckoutBillInput, CancelBillInput } from './schemas';

export class BillingService {
  static async getPosCatalog(context: TenantContext) {
    return await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        unit: products.unit,
        sellingPrice: products.sellingPrice,
        purchasePrice: products.purchasePrice,
        stockQuantity: products.stockQuantity,
        imageUrl: products.imageUrl,
      })
      .from(products)
      .where(
        and(
          eq(products.tenantId, context.tenantId),
          eq(products.status, 'active')
        )
      )
      .orderBy(products.name);
  }

  static async lookupPosItems(context: TenantContext, query: string) {
    if (!query || query.trim().length === 0) return [];
    const q = `%${query.trim()}%`;

    return await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        unit: products.unit,
        sellingPrice: products.sellingPrice,
        purchasePrice: products.purchasePrice,
        stockQuantity: products.stockQuantity,
        imageUrl: products.imageUrl,
      })
      .from(products)
      .where(
        and(
          eq(products.tenantId, context.tenantId),
          eq(products.status, 'active'),
          or(like(products.name, q), like(products.sku, q), like(products.barcode, q))!
        )
      )
      .limit(20);
  }

  static async checkoutBill(context: TenantContext, input: CheckoutBillInput) {
    return await db.transaction(async (tx) => {
      // 1. Idempotency Guard
      const [existing] = await tx
        .select()
        .from(bills)
        .where(and(eq(bills.tenantId, context.tenantId), eq(bills.idempotencyKey, input.idempotencyKey)))
        .limit(1);

      if (existing) {
        return { billId: existing.id, billNumber: existing.billNumber };
      }

      // 2. Fetch tenant tax configuration
      const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, context.tenantId));
      if (!tenant) throw new Error('Tenant not found');

      // 3. Lock all requested products with FOR UPDATE
      const productIds = input.items.map((i) => i.productId);
      const lockedProducts = await tx
        .select()
        .from(products)
        .where(and(eq(products.tenantId, context.tenantId), inArray(products.id, productIds)))
        .for('update');

      const productMap = new Map(lockedProducts.map((p) => [p.id, p]));

      // 4. Validate items & compute subtotal with server-side invariants
      let itemsSubtotal = 0;
      const verifiedItems: {
        product: typeof lockedProducts[0];
        quantity: number;
        lineDiscount: number;
        lineTotal: number;
      }[] = [];

      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product || product.status !== 'active') {
          throw new Error(`Product not available: ${item.productId}`);
        }

        // Invariant: quantity > 0
        if (item.quantity <= 0) {
          throw new Error(`Quantity must be strictly positive for ${product.name}`);
        }

        const currentStock = parseFloat(product.stockQuantity);
        if (currentStock < item.quantity) {
          throw new Error(`Insufficient stock for "${product.name}". Available: ${currentStock} ${product.unit}, requested: ${item.quantity}`);
        }

        const lineGross = Math.round(item.quantity * product.sellingPrice);
        const lineDiscount = item.lineDiscount || 0;

        // Invariant: lineDiscount <= lineGross
        if (lineDiscount < 0 || lineDiscount > lineGross) {
          throw new Error(`Line discount for "${product.name}" exceeds item gross total`);
        }

        const lineTotal = lineGross - lineDiscount;
        itemsSubtotal += lineTotal;

        verifiedItems.push({
          product,
          quantity: item.quantity,
          lineDiscount,
          lineTotal,
        });
      }

      // 5. Compute charges
      let chargesTotal = 0;
      for (const charge of input.charges) {
        if (charge.amount <= 0) {
          throw new Error(`Charge amount must be positive for ${charge.chargeType}`);
        }
        chargesTotal += charge.amount;
      }

      // 6. Invariant: billDiscount <= itemsSubtotal + chargesTotal
      const billDiscount = input.billDiscount || 0;
      if (billDiscount < 0 || billDiscount > itemsSubtotal + chargesTotal) {
        throw new Error('Bill discount cannot exceed total value of items and charges');
      }

      // 7. Compute tax & grand total
      const taxableAmount = itemsSubtotal + chargesTotal - billDiscount;
      let taxTotal = 0;
      if (tenant.taxEnabled && parseFloat(tenant.defaultTaxRate) > 0) {
        taxTotal = Math.round((taxableAmount * parseFloat(tenant.defaultTaxRate)) / 100);
      }

      const grandTotal = taxableAmount + taxTotal;
      if (grandTotal < 0) {
        throw new Error('Grand total cannot be negative');
      }

      // 8. Validate payments
      let paidAmount = 0;
      for (const p of input.payments) {
        if (p.amount <= 0) {
          throw new Error('Payment amounts must be strictly positive');
        }
        paidAmount += p.amount;
      }

      if (paidAmount > grandTotal) {
        throw new Error(`Total payments (${paidAmount}) cannot exceed grand total (${grandTotal})`);
      }

      const dueAmount = grandTotal - paidAmount;

      // Invariant: dueAmount > 0 => customer_id is mandatory
      if (dueAmount > 0 && !input.customerId) {
        throw new Error('A customer must be selected when there is an unpaid balance (credit sale)');
      }

      // 9. Allocate monotonic invoice sequence
      await tx
        .update(tenants)
        .set({ nextInvoiceSeq: sql`${tenants.nextInvoiceSeq} + 1` })
        .where(eq(tenants.id, context.tenantId));

      const [updatedTenant] = await tx.select().from(tenants).where(eq(tenants.id, context.tenantId));
      const billNumber = `${updatedTenant.invoicePrefix}${String(updatedTenant.nextInvoiceSeq - 1).padStart(6, '0')}`;

      const billId = generateId('bil');
      const paymentStatus = dueAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

      // 10. Insert bill header
      await tx.insert(bills).values({
        id: billId,
        tenantId: context.tenantId,
        billNumber,
        customerId: input.customerId || null,
        status: 'completed',
        paymentStatus,
        itemsSubtotal,
        chargesTotal,
        discountTotal: billDiscount,
        taxTotal,
        grandTotal,
        paidAmount,
        dueAmount,
        createdBy: context.userId,
        idempotencyKey: input.idempotencyKey,
      });

      // 11. Insert bill items & deduct stock
      for (const item of verifiedItems) {
        const billItemId = generateId('bi');
        await tx.insert(billItems).values({
          id: billItemId,
          tenantId: context.tenantId,
          billId,
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku,
          unit: item.product.unit,
          unitPrice: item.product.sellingPrice,
          purchasePrice: item.product.purchasePrice,
          quantity: item.quantity.toFixed(3),
          lineDiscount: item.lineDiscount,
          lineTotal: item.lineTotal,
        });

        const newStock = parseFloat(item.product.stockQuantity) - item.quantity;
        await tx
          .update(products)
          .set({ stockQuantity: newStock.toFixed(3) })
          .where(and(eq(products.tenantId, context.tenantId), eq(products.id, item.product.id)));

        await tx.insert(stockMovements).values({
          id: generateId('sm'),
          tenantId: context.tenantId,
          productId: item.product.id,
          quantityDelta: (-item.quantity).toFixed(3),
          balanceAfter: newStock.toFixed(3),
          movementType: 'sale',
          referenceId: billId,
          reason: `Counter Sale (${billNumber})`,
          createdBy: context.userId,
        });
      }

      // 12. Insert bill charges
      for (const charge of input.charges) {
        await tx.insert(billCharges).values({
          id: generateId('bc'),
          tenantId: context.tenantId,
          billId,
          chargeType: charge.chargeType,
          description: charge.description?.trim() || null,
          amount: charge.amount,
        });
      }

      // 13. Insert payments
      for (const p of input.payments) {
        await tx.insert(payments).values({
          id: generateId('pay'),
          tenantId: context.tenantId,
          billId,
          customerId: input.customerId || null,
          amount: p.amount,
          method: p.method,
          status: 'completed',
          referenceNote: p.referenceNote?.trim() || null,
          createdBy: context.userId,
        });
      }

      // 14. Customer Ledger Updates (if customer attached)
      if (input.customerId) {
        const [customer] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, input.customerId)))
          .for('update');

        if (!customer) throw new Error('Customer not found');

        let runningBalance = customer.receivableBalance;

        // Debit gross bill
        runningBalance += grandTotal;
        await tx.insert(customerLedgerEntries).values({
          id: generateId('cle'),
          tenantId: context.tenantId,
          customerId: input.customerId,
          entryType: 'credit_sale',
          amount: grandTotal,
          balanceAfter: runningBalance,
          billId,
          notes: `Invoice ${billNumber}`,
          createdBy: context.userId,
        });

        // Credit each payment made at checkout
        for (const p of input.payments) {
          runningBalance -= p.amount;
          await tx.insert(customerLedgerEntries).values({
            id: generateId('cle'),
            tenantId: context.tenantId,
            customerId: input.customerId,
            entryType: 'payment_received',
            amount: -p.amount,
            balanceAfter: runningBalance,
            billId,
            notes: `Payment (${p.method}) for ${billNumber}`,
            createdBy: context.userId,
          });
        }

        // Update cached customer receivable balance
        await tx
          .update(customers)
          .set({ receivableBalance: runningBalance })
          .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, input.customerId)));
      }

      // 15. Audit log
      await tx.insert(auditLogs).values({
        id: generateId('aud'),
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'CHECKOUT_BILL',
        entityType: 'bill',
        entityId: billId,
        metadataJson: JSON.stringify({ billNumber, grandTotal, paidAmount, dueAmount }),
      });

      return { billId, billNumber };
    });
  }

  static async cancelBill(context: TenantContext, input: CancelBillInput) {
    enforceOwner(context);

    return await db.transaction(async (tx) => {
      // 1. Lock bill row
      const [bill] = await tx
        .select()
        .from(bills)
        .where(and(eq(bills.tenantId, context.tenantId), eq(bills.id, input.billId)))
        .for('update');

      if (!bill) throw new Error('Bill not found');

      // Idempotency: return existing if already cancelled
      if (bill.status === 'cancelled') {
        return { success: true, alreadyCancelled: true };
      }

      // 2. Restore physical inventory
      const items = await tx
        .select()
        .from(billItems)
        .where(and(eq(billItems.tenantId, context.tenantId), eq(billItems.billId, input.billId)));

      for (const item of items) {
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.tenantId, context.tenantId), eq(products.id, item.productId)))
          .for('update');

        if (product) {
          const restoredStock = parseFloat(product.stockQuantity) + parseFloat(item.quantity);
          await tx
            .update(products)
            .set({ stockQuantity: restoredStock.toFixed(3) })
            .where(and(eq(products.tenantId, context.tenantId), eq(products.id, item.productId)));

          await tx.insert(stockMovements).values({
            id: generateId('sm'),
            tenantId: context.tenantId,
            productId: item.productId,
            quantityDelta: parseFloat(item.quantity).toFixed(3),
            balanceAfter: restoredStock.toFixed(3),
            movementType: 'sale_reversal',
            referenceId: bill.id,
            reason: `Bill Cancelled (${bill.billNumber}): ${input.reason}`,
            createdBy: context.userId,
          });
        }
      }

      // 3. Reverse active payments
      const activePayments = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, context.tenantId), eq(payments.billId, input.billId), eq(payments.status, 'completed')));

      let customer: (typeof customers.$inferSelect) | null = null;
      if (bill.customerId) {
        const [c] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, bill.customerId)))
          .for('update');
        customer = c || null;
      }

      let runningBalance = customer?.receivableBalance || 0;

      for (const p of activePayments) {
        await tx
          .update(payments)
          .set({
            status: 'reversed',
            reversedAt: new Date(),
            reversedBy: context.userId,
            reversalReason: `Bill Cancelled: ${input.reason}`,
          })
          .where(and(eq(payments.tenantId, context.tenantId), eq(payments.id, p.id)));

        // If customer attached, reversal of payment increases customer debt by payment amount
        if (customer && bill.customerId) {
          runningBalance += p.amount;
          await tx.insert(customerLedgerEntries).values({
            id: generateId('cle'),
            tenantId: context.tenantId,
            customerId: bill.customerId,
            entryType: 'reversal',
            amount: p.amount,
            balanceAfter: runningBalance,
            paymentId: p.id,
            billId: bill.id,
            notes: `Payment reversal on cancelled bill ${bill.billNumber}`,
            createdBy: context.userId,
          });
        }
      }

      // 4. Reverse original bill charge from customer ledger
      if (customer && bill.customerId) {
        runningBalance -= bill.grandTotal;
        await tx.insert(customerLedgerEntries).values({
          id: generateId('cle'),
          tenantId: context.tenantId,
          customerId: bill.customerId,
          entryType: 'reversal',
          amount: -bill.grandTotal,
          balanceAfter: runningBalance,
          billId: bill.id,
          notes: `Credit sale reversal for cancelled bill ${bill.billNumber}`,
          createdBy: context.userId,
        });

        await tx
          .update(customers)
          .set({ receivableBalance: runningBalance })
          .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, bill.customerId)));
      }

      // 5. Update bill active status
      await tx
        .update(bills)
        .set({
          status: 'cancelled',
          paidAmount: 0,
          dueAmount: 0,
          paymentStatus: 'reversed',
          cancelledAt: new Date(),
          cancelledBy: context.userId,
          cancelReason: input.reason.trim(),
        })
        .where(and(eq(bills.tenantId, context.tenantId), eq(bills.id, input.billId)));

      // 6. Audit log
      await tx.insert(auditLogs).values({
        id: generateId('aud'),
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'CANCEL_BILL',
        entityType: 'bill',
        entityId: bill.id,
        metadataJson: JSON.stringify({ billNumber: bill.billNumber, reason: input.reason }),
      });

      return { success: true };
    });
  }

  static async listBills(
    context: TenantContext,
    params?: { customerId?: string; status?: 'completed' | 'cancelled'; paymentStatus?: 'unpaid' | 'partial' | 'paid' }
  ) {
    const conditions = [eq(bills.tenantId, context.tenantId)];

    if (params?.customerId) {
      conditions.push(eq(bills.customerId, params.customerId));
    }
    if (params?.status) {
      conditions.push(eq(bills.status, params.status));
    }
    if (params?.paymentStatus) {
      conditions.push(eq(bills.paymentStatus, params.paymentStatus));
    }

    return await db
      .select()
      .from(bills)
      .where(and(...conditions))
      .orderBy(desc(bills.createdAt))
      .limit(100);
  }

  static async getBillDetails(context: TenantContext, billId: string) {
    const [bill] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.tenantId, context.tenantId), eq(bills.id, billId)))
      .limit(1);

    if (!bill) return null;

    const items = await db
      .select()
      .from(billItems)
      .where(and(eq(billItems.tenantId, context.tenantId), eq(billItems.billId, billId)));

    const charges = await db
      .select()
      .from(billCharges)
      .where(and(eq(billCharges.tenantId, context.tenantId), eq(billCharges.billId, billId)));

    const billPayments = await db
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, context.tenantId), eq(payments.billId, billId)))
      .orderBy(desc(payments.createdAt));

    let customer = null;
    if (bill.customerId) {
      const [c] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, bill.customerId)))
        .limit(1);
      customer = c || null;
    }

    return { bill, items, charges, payments: billPayments, customer };
  }
}
