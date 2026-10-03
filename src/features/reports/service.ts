import { eq, and, or, sql, gte, lte, isNotNull, desc, asc } from 'drizzle-orm';
import { db } from '../../server/db';
import { bills, products } from '../../server/db/schema';
import type { TenantContext } from '../auth/middleware';

export class ReportsService {
  static async getDailySalesSummary(context: TenantContext, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    const [stats] = await db
      .select({
        billsCount: sql<number>`count(*)`,
        totalSales: sql<number>`coalesce(sum(${bills.grandTotal}), 0)`,
        totalCollected: sql<number>`coalesce(sum(${bills.paidAmount}), 0)`,
        totalDue: sql<number>`coalesce(sum(${bills.dueAmount}), 0)`,
        totalTax: sql<number>`coalesce(sum(${bills.taxTotal}), 0)`,
        totalDiscount: sql<number>`coalesce(sum(${bills.discountTotal}), 0)`,
      })
      .from(bills)
      .where(
        and(
          eq(bills.tenantId, context.tenantId),
          eq(bills.status, 'completed'),
          gte(bills.createdAt, startOfDay),
          lte(bills.createdAt, endOfDay)
        )
      );

    return {
      date: startOfDay.toISOString().split('T')[0],
      billsCount: Number(stats?.billsCount || 0),
      totalSales: Number(stats?.totalSales || 0),
      totalCollected: Number(stats?.totalCollected || 0),
      totalDue: Number(stats?.totalDue || 0),
      totalTax: Number(stats?.totalTax || 0),
      totalDiscount: Number(stats?.totalDiscount || 0),
    };
  }

  static async getLowStockAlerts(context: TenantContext) {
    return await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, context.tenantId),
          eq(products.status, 'active'),
          or(
            // Out of stock active items (qty 0 or negative)
            sql`CAST(${products.stockQuantity} AS DECIMAL(12,3)) <= 0`,
            // Items at or below configured low stock threshold
            and(
              isNotNull(products.lowStockThreshold),
              sql`CAST(${products.stockQuantity} AS DECIMAL(12,3)) <= CAST(${products.lowStockThreshold} AS DECIMAL(12,3))`
            )
          )
        )
      )
      .orderBy(sql`CAST(${products.stockQuantity} AS DECIMAL(12,3)) ASC`);
  }
}
