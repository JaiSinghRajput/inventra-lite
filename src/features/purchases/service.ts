import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../server/db';
import { purchases, purchaseItems, products, stockMovements, auditLogs } from '../../server/db/schema';
import { generateId } from '../../server/utils/id';
import type { TenantContext } from '../auth/middleware';
import type { RecordStockInInput } from './schemas';

export class PurchaseService {
  static async recordStockIn(context: TenantContext, input: RecordStockInInput) {
    return await db.transaction(async (tx) => {
      let totalAmount = 0;
      for (const item of input.items) {
        if (item.quantity <= 0) throw new Error('Quantity must be strictly positive');
        totalAmount += Math.round(item.quantity * item.unitCost);
      }

      const purchaseId = generateId('pur');

      // 1. Insert purchase header
      await tx.insert(purchases).values({
        id: purchaseId,
        tenantId: context.tenantId,
        referenceInvoice: input.referenceInvoice?.trim() || null,
        totalAmount,
        notes: input.notes?.trim() || null,
        createdBy: context.userId,
      });

      // 2. Insert items, update product stock & cost, and append movements
      for (const item of input.items) {
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.tenantId, context.tenantId), eq(products.id, item.productId)))
          .for('update');

        if (!product) throw new Error(`Product not found: ${item.productId}`);

        const itemTotal = Math.round(item.quantity * item.unitCost);
        await tx.insert(purchaseItems).values({
          id: generateId('pi'),
          tenantId: context.tenantId,
          purchaseId,
          productId: item.productId,
          quantity: item.quantity.toFixed(3),
          unitCost: item.unitCost,
          totalCost: itemTotal,
        });

        const newStock = parseFloat(product.stockQuantity) + item.quantity;
        await tx
          .update(products)
          .set({
            stockQuantity: newStock.toFixed(3),
            purchasePrice: item.unitCost, // Update latest cost price
          })
          .where(and(eq(products.tenantId, context.tenantId), eq(products.id, item.productId)));

        await tx.insert(stockMovements).values({
          id: generateId('sm'),
          tenantId: context.tenantId,
          productId: item.productId,
          quantityDelta: item.quantity.toFixed(3),
          balanceAfter: newStock.toFixed(3),
          movementType: 'purchase',
          referenceId: purchaseId,
          reason: `Stock-In / Purchase Delivery${input.referenceInvoice ? ` (Inv: ${input.referenceInvoice})` : ''}`,
          createdBy: context.userId,
        });
      }

      // 3. Audit log
      await tx.insert(auditLogs).values({
        id: generateId('aud'),
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'RECORD_STOCK_IN',
        entityType: 'purchase',
        entityId: purchaseId,
        metadataJson: JSON.stringify({ totalAmount, itemsCount: input.items.length }),
      });

      return { purchaseId, totalAmount };
    });
  }

  static async listPurchases(context: TenantContext) {
    return await db
      .select()
      .from(purchases)
      .where(eq(purchases.tenantId, context.tenantId))
      .orderBy(desc(purchases.createdAt))
      .limit(50);
  }
}
