import { eq, and, sql, or, like, desc, isNotNull } from 'drizzle-orm';
import { db } from '../../server/db';
import { products, stockMovements, tenants, auditLogs, user } from '../../server/db/schema';
import { generateId } from '../../server/utils/id';
import type { TenantContext } from '../auth/middleware';
import type { CreateProductInput, UpdateProductInput, AdjustStockInput } from './schemas';

export class InventoryService {
  static async createProduct(context: TenantContext, input: CreateProductInput) {
    return await db.transaction(async (tx) => {
      // 1. Atomically allocate sequential SKU
      await tx
        .update(tenants)
        .set({ nextSkuSeq: sql`${tenants.nextSkuSeq} + 1` })
        .where(eq(tenants.id, context.tenantId));

      const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, context.tenantId));
      if (!tenant) throw new Error('Tenant not found');

      const seq = tenant.nextSkuSeq - 1;
      const sku = `${tenant.skuPrefix}-${String(seq).padStart(6, '0')}`;

      const productId = generateId('prd');
      const initialStock = input.initialStock || 0;

      // 2. Insert product record
      await tx.insert(products).values({
        id: productId,
        tenantId: context.tenantId,
        sku,
        name: input.name.trim(),
        sellingPrice: input.sellingPrice,
        purchasePrice: input.purchasePrice || 0,
        unit: input.unit || 'unit',
        stockQuantity: initialStock.toFixed(3),
        lowStockThreshold: input.lowStockThreshold !== undefined && input.lowStockThreshold !== null
          ? input.lowStockThreshold.toFixed(3)
          : null,
        features: input.features || null,
        category: input.category?.trim() || null,
        barcode: input.barcode?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        status: 'active',
        createdBy: context.userId,
        updatedBy: context.userId,
      });

      // 3. Append initial stock movement if quantity > 0
      if (initialStock > 0) {
        await tx.insert(stockMovements).values({
          id: generateId('sm'),
          tenantId: context.tenantId,
          productId,
          quantityDelta: initialStock.toFixed(3),
          balanceAfter: initialStock.toFixed(3),
          movementType: 'purchase',
          reason: 'Initial inventory balance',
          createdBy: context.userId,
        });
      }

      // 4. Audit log
      await tx.insert(auditLogs).values({
        id: generateId('aud'),
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'CREATE_PRODUCT',
        entityType: 'product',
        entityId: productId,
        metadataJson: JSON.stringify({ sku, name: input.name, initialStock, sellingPrice: input.sellingPrice }),
      });

      return { id: productId, sku };
    });
  }

  static async updateProduct(context: TenantContext, input: UpdateProductInput) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(products)
        .where(and(eq(products.tenantId, context.tenantId), eq(products.id, input.id)))
        .limit(1);

      if (!existing) throw new Error('Product not found');

      await tx
        .update(products)
        .set({
          name: input.name.trim(),
          sellingPrice: input.sellingPrice,
          purchasePrice: input.purchasePrice,
          unit: input.unit,
          lowStockThreshold: input.lowStockThreshold !== undefined && input.lowStockThreshold !== null
            ? input.lowStockThreshold.toFixed(3)
            : null,
          features: input.features || null,
          category: input.category?.trim() || null,
          barcode: input.barcode?.trim() || null,
          imageUrl: input.imageUrl?.trim() || null,
          status: input.status,
          updatedBy: context.userId,
        })
        .where(and(eq(products.tenantId, context.tenantId), eq(products.id, input.id)));

      await tx.insert(auditLogs).values({
        id: generateId('aud'),
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'UPDATE_PRODUCT',
        entityType: 'product',
        entityId: input.id,
        metadataJson: JSON.stringify({ name: input.name, sellingPrice: input.sellingPrice }),
      });

      return { success: true };
    });
  }

  static async deleteProduct(context: TenantContext, productId: string) {
    // RBAC: Only OWNER can delete products
    if (context.role !== 'OWNER') {
      throw new Error('Forbidden: Only the store Owner can delete products.');
    }

    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(products)
        .where(and(eq(products.tenantId, context.tenantId), eq(products.id, productId)))
        .limit(1);

      if (!existing) throw new Error('Product not found');

      // Check if product is in any bills
      const inBills = await tx
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.tenantId, context.tenantId), eq(stockMovements.productId, productId), eq(stockMovements.movementType, 'sale')))
        .limit(1);

      if (inBills.length > 0) {
        throw new Error('Cannot delete this product because it has recorded sales history. Set its status to inactive instead.');
      }

      await tx.delete(stockMovements).where(and(eq(stockMovements.tenantId, context.tenantId), eq(stockMovements.productId, productId)));
      await tx.delete(products).where(and(eq(products.tenantId, context.tenantId), eq(products.id, productId)));

      await tx.insert(auditLogs).values({
        id: generateId('aud'),
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'DELETE_PRODUCT',
        entityType: 'product',
        entityId: productId,
        metadataJson: JSON.stringify({ name: existing.name, sku: existing.sku }),
      });

      return { success: true };
    });
  }

  static async adjustStock(context: TenantContext, input: AdjustStockInput) {
    return await db.transaction(async (tx) => {
      // 1. Lock product row with FOR UPDATE
      const [product] = await tx
        .select()
        .from(products)
        .where(and(eq(products.tenantId, context.tenantId), eq(products.id, input.productId)))
        .for('update');

      if (!product) throw new Error('Product not found');

      const currentStock = parseFloat(product.stockQuantity);
      const newBalance = currentStock + input.delta;
      if (newBalance < 0) {
        throw new Error(`Insufficient stock. Current stock is ${currentStock} ${product.unit}, adjustment of ${input.delta} would result in negative stock.`);
      }

      // 2. Update stock quantity
      await tx
        .update(products)
        .set({ stockQuantity: newBalance.toFixed(3) })
        .where(and(eq(products.tenantId, context.tenantId), eq(products.id, input.productId)));

      // 3. Append to immutable stock movements
      const movementId = generateId('sm');
      await tx.insert(stockMovements).values({
        id: movementId,
        tenantId: context.tenantId,
        productId: input.productId,
        quantityDelta: input.delta.toFixed(3),
        balanceAfter: newBalance.toFixed(3),
        movementType: 'adjustment',
        reason: input.reason.trim(),
        createdBy: context.userId,
      });

      // 4. Audit log
      await tx.insert(auditLogs).values({
        id: generateId('aud'),
        tenantId: context.tenantId,
        userId: context.userId,
        action: 'STOCK_ADJUSTMENT',
        entityType: 'product',
        entityId: input.productId,
        metadataJson: JSON.stringify({
          delta: input.delta,
          previousStock: currentStock,
          newBalance,
          reason: input.reason,
        }),
      });

      return { success: true, newBalance };
    });
  }

  static async listProducts(
    context: TenantContext,
    params?: { search?: string; category?: string; lowStockOnly?: boolean; status?: 'active' | 'inactive' }
  ) {
    const conditions = [eq(products.tenantId, context.tenantId)];

    if (params?.status) {
      conditions.push(eq(products.status, params.status));
    }

    if (params?.category) {
      conditions.push(eq(products.category, params.category));
    }

    if (params?.search) {
      const q = `%${params.search.trim()}%`;
      conditions.push(or(like(products.name, q), like(products.sku, q), like(products.barcode, q))!);
    }

    if (params?.lowStockOnly) {
      conditions.push(
        and(
          isNotNull(products.lowStockThreshold),
          sql`CAST(${products.stockQuantity} AS DECIMAL(12,3)) <= CAST(${products.lowStockThreshold} AS DECIMAL(12,3))`
        )!
      );
    }

    return await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.createdAt));
  }

  static async getProductDetails(context: TenantContext, productId: string) {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, context.tenantId), eq(products.id, productId)))
      .limit(1);

    if (!product) return null;

    const [createdUser] = product.createdBy
      ? await db.select({ name: user.name }).from(user).where(eq(user.id, product.createdBy)).limit(1)
      : [{ name: null }];
    const [updatedUser] = product.updatedBy
      ? await db.select({ name: user.name }).from(user).where(eq(user.id, product.updatedBy)).limit(1)
      : [{ name: null }];

    const movements = await db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.tenantId, context.tenantId), eq(stockMovements.productId, productId)))
      .orderBy(desc(stockMovements.createdAt))
      .limit(50);

    return {
      product: {
        ...product,
        createdByName: createdUser?.name || null,
        updatedByName: updatedUser?.name || null,
      },
      movements,
    };
  }
}
