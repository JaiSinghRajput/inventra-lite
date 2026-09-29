import { z } from 'zod';
import { CHARGE_TYPES, PAYMENT_METHODS } from '../../lib/constants';

export const checkoutItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  lineDiscount: z.number().int().nonnegative('Line discount cannot be negative').default(0),
});

export const checkoutChargeSchema = z.object({
  chargeType: z.enum(CHARGE_TYPES),
  description: z.string().max(150).optional(),
  amount: z.number().int().positive('Charge amount must be greater than 0'),
});

export const checkoutPaymentSchema = z.object({
  amount: z.number().int().positive('Payment amount must be greater than 0'),
  method: z.enum(PAYMENT_METHODS),
  referenceNote: z.string().max(100).optional(),
});

export const checkoutBillSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'Cart must have at least one product'),
  charges: z.array(checkoutChargeSchema).default([]),
  billDiscount: z.number().int().nonnegative().default(0),
  customerId: z.string().nullable().optional(),
  payments: z.array(checkoutPaymentSchema).default([]),
  idempotencyKey: z.string().min(10, 'Idempotency key required'),
});

export const cancelBillSchema = z.object({
  billId: z.string(),
  reason: z.string().min(3, 'Cancellation reason is mandatory'),
});

export type CheckoutBillInput = z.infer<typeof checkoutBillSchema>;
export type CancelBillInput = z.infer<typeof cancelBillSchema>;
export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;
export type CheckoutChargeInput = z.infer<typeof checkoutChargeSchema>;
export type CheckoutPaymentInput = z.infer<typeof checkoutPaymentSchema>;
