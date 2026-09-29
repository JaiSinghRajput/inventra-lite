import { z } from 'zod';

export const purchaseItemInputSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitCost: z.number().int().nonnegative('Unit cost cannot be negative'),
});

export const recordStockInSchema = z.object({
  supplierName: z.string().max(150).optional(),
  referenceInvoice: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(purchaseItemInputSchema).min(1, 'At least one item required for stock-in'),
});

export type RecordStockInInput = z.infer<typeof recordStockInSchema>;
export type PurchaseItemInput = z.infer<typeof purchaseItemInputSchema>;
