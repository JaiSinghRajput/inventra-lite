import { z } from 'zod';
import { PAYMENT_METHODS } from '../../lib/constants';

export const recordSubsequentPaymentSchema = z.object({
  billId: z.string(),
  amount: z.number().int().positive('Payment amount must be greater than 0'),
  method: z.enum(PAYMENT_METHODS),
  referenceNote: z.string().max(100).optional(),
});

export const reversePaymentSchema = z.object({
  paymentId: z.string(),
  reason: z.string().min(3, 'Reversal reason is mandatory'),
});

export type RecordSubsequentPaymentInput = z.infer<typeof recordSubsequentPaymentSchema>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
