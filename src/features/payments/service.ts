import { eq, and } from 'drizzle-orm';
import { db } from '../../server/db';
import { payments, bills, customers, customerLedgerEntries, auditLogs } from '../../server/db/schema';
import { generateId } from '../../server/utils/id';
import type { TenantContext } from '../auth/middleware';
import type { RecordSubsequentPaymentInput, ReversePaymentInput } from './schemas';

export class PaymentService {
  static async recordSubsequentPayment(context: TenantContext, input: RecordSubsequentPaymentInput) {
    return await db.transaction(async (tx) => {
      // 1. Lock bill row
      const [bill] = await tx
        .select()
        .from(bills)
        .where(and(eq(bills.tenantId, context.tenantId), eq(bills.id, input.billId)))
        .for('update');

      if (!bill) throw new Error('Bill not found');
      if (bill.status !== 'completed') throw new Error(`Cannot record payment on a ${bill.status} bill`);

      if (input.amount <= 0) {
        throw new Error('Payment amount must be strictly positive');
      }

      if (input.amount > bill.dueAmount) {
        throw new Error(`Payment amount (${input.amount}) exceeds outstanding due amount (${bill.dueAmount})`);
      }

      const paymentId = generateId('pay');

      // 2. Insert payment record
      await tx.insert(payments).values({
        id: paymentId,
        tenantId: context.tenantId,
        billId: bill.id,
        customerId: bill.customerId,
        amount: input.amount,
        method: input.method,
        status: 'completed',
        referenceNote: input.referenceNote?.trim() || null,
        createdBy: context.userId,
      });

      // 3. Update bill balances
      const newPaid = bill.paidAmount + input.amount;
      const newDue = bill.dueAmount - input.amount;
      const newPaymentStatus = newDue === 0 ? 'paid' : 'partial';

      await tx
        .update(bills)
        .set({
          paidAmount: newPaid,
          dueAmount: newDue,
          paymentStatus: newPaymentStatus,
        })
        .where(and(eq(bills.tenantId, context.tenantId), eq(bills.id, bill.id)));

      // 4. Update customer balance and ledger
      if (bill.customerId) {
        const [customer] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, bill.customerId)))
          .for('update');

        if (customer) {
          const newCustomerBalance = customer.receivableBalance - input.amount;
          await tx
            .update(customers)
            .set({ receivableBalance: newCustomerBalance })
            .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, bill.customerId)));

          await tx.insert(customerLedgerEntries).values({
            id: generateId('cle'),
            tenantId: context.tenantId,
            customerId: bill.customerId,
            entryType: 'payment_received',
            amount: -input.amount,
            balanceAfter: newCustomerBalance,
            paymentId,
            billId: bill.id,
            notes: `Subsequent payment (${input.method}) for ${bill.billNumber}`,
            createdBy: context.userId,
          });
        }
      }

      // 5. Audit log
      await tx.insert(auditLogs).values({
        id: generateId('aud'),
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'SUBSEQUENT_PAYMENT',
        entityType: 'payment',
        entityId: paymentId,
        metadataJson: JSON.stringify({ billNumber: bill.billNumber, amount: input.amount, method: input.method }),
      });

      return { success: true, paymentId, remainingDue: newDue };
    });
  }

  static async reversePayment(context: TenantContext, input: ReversePaymentInput) {
    return await db.transaction(async (tx) => {
      // 1. Lock payment row
      const [payment] = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, context.tenantId), eq(payments.id, input.paymentId)))
        .for('update');

      if (!payment) throw new Error('Payment not found');
      if (payment.status === 'reversed') throw new Error('Payment is already reversed');

      // 2. Lock associated bill
      const [bill] = await tx
        .select()
        .from(bills)
        .where(and(eq(bills.tenantId, context.tenantId), eq(bills.id, payment.billId)))
        .for('update');

      if (!bill) throw new Error('Associated bill not found');

      // 3. Walk-In Protection Invariant:
      // Standalone payment reversal is rejected for walk-in bills. Must cancel bill instead.
      if (!bill.customerId) {
        throw new Error('Standalone payment reversal is not permitted for walk-in bills. Cancel the bill instead.');
      }

      // 4. Mark payment reversed (preserves original positive amount)
      await tx
        .update(payments)
        .set({
          status: 'reversed',
          reversedAt: new Date(),
          reversedBy: context.userId,
          reversalReason: input.reason.trim(),
        })
        .where(and(eq(payments.tenantId, context.tenantId), eq(payments.id, payment.id)));

      // 5. Update bill balance
      const newPaid = bill.paidAmount - payment.amount;
      const newDue = bill.dueAmount + payment.amount;
      const newPaymentStatus = newPaid === 0 ? 'unpaid' : 'partial';

      await tx
        .update(bills)
        .set({
          paidAmount: newPaid,
          dueAmount: newDue,
          paymentStatus: newPaymentStatus,
        })
        .where(and(eq(bills.tenantId, context.tenantId), eq(bills.id, bill.id)));

      // 6. Lock customer & append reversal ledger entry
      const [customer] = await tx
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, bill.customerId)))
        .for('update');

      if (customer) {
        const newCustomerBalance = customer.receivableBalance + payment.amount;
        await tx
          .update(customers)
          .set({ receivableBalance: newCustomerBalance })
          .where(and(eq(customers.tenantId, context.tenantId), eq(customers.id, bill.customerId)));

        await tx.insert(customerLedgerEntries).values({
          id: generateId('cle'),
          tenantId: context.tenantId,
          customerId: bill.customerId,
          entryType: 'reversal',
          amount: payment.amount,
          balanceAfter: newCustomerBalance,
          paymentId: payment.id,
          billId: bill.id,
          notes: `Reversal of payment for ${bill.billNumber}: ${input.reason}`,
          createdBy: context.userId,
        });
      }

      // 7. Audit log (No inventory movement created)
      await tx.insert(auditLogs).values({
        id: generateId('aud'),
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'REVERSE_PAYMENT',
        entityType: 'payment',
        entityId: payment.id,
        metadataJson: JSON.stringify({ billNumber: bill.billNumber, amount: payment.amount, reason: input.reason }),
      });

      return { success: true };
    });
  }
}
