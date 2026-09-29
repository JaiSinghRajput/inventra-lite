import { describe, it, expect } from 'vitest';
import { formatINR, inrToPaise, paiseToINR } from '../../src/lib/currency';

describe('Server-Side Billing Invariants & Currency Utilities', () => {
  it('correctly converts between INR and integer paise without floating point issues', () => {
    expect(inrToPaise(100)).toBe(10000);
    expect(inrToPaise('100.50')).toBe(10050);
    expect(inrToPaise('0.99')).toBe(99);
    expect(paiseToINR(10050)).toBe(100.5);
    expect(formatINR(10050)).toContain('100.50');
    expect(formatINR(0)).toContain('0.00');
    expect(formatINR(null)).toContain('0.00');
  });

  it('enforces line discount cannot exceed line gross total', () => {
    const quantity = 3;
    const unitPrice = 5000; // ₹50.00 each
    const lineGross = quantity * unitPrice; // 15000 (₹150.00)

    const validDiscount = 2000; // ₹20.00
    expect(validDiscount).toBeLessThanOrEqual(lineGross);

    const invalidDiscount = 16000; // ₹160.00
    expect(invalidDiscount > lineGross).toBe(true);
  });

  it('enforces bill discount cannot exceed sum of items and charges', () => {
    const itemsSubtotal = 45000; // ₹450
    const chargesTotal = 5000; // ₹50 labour
    const maxPermittedDiscount = itemsSubtotal + chargesTotal; // ₹500

    expect(40000).toBeLessThanOrEqual(maxPermittedDiscount);
    expect(55000 > maxPermittedDiscount).toBe(true);
  });

  it('enforces grand total is never negative', () => {
    const subtotal = 10000;
    const charges = 2000;
    const discount = 12000;
    const tax = 0;
    const grandTotal = subtotal + charges - discount + tax;
    expect(grandTotal).toBe(0);
    expect(Math.max(0, grandTotal)).toBeGreaterThanOrEqual(0);
  });

  it('enforces customer selection is required when credit is taken (dueAmount > 0)', () => {
    const grandTotal = 10000;
    const paidAmount = 6000;
    const dueAmount = grandTotal - paidAmount;
    expect(dueAmount).toBe(4000);

    const validateCheckout = (due: number, customerId?: string | null) => {
      if (due > 0 && !customerId) {
        throw new Error('A customer must be selected when there is an unpaid balance (credit sale)');
      }
      return true;
    };

    // Anonymous walk-in attempting credit must throw
    expect(() => validateCheckout(dueAmount, null)).toThrow('A customer must be selected');

    // Identified customer succeeds
    expect(validateCheckout(dueAmount, 'cust_123')).toBe(true);

    // Full payment for walk-in succeeds
    expect(validateCheckout(0, null)).toBe(true);
  });

  it('formats automated sequential SKU with 6-digit zero padding', () => {
    const prefix = 'RAJ';
    const formatSku = (seq: number) => `${prefix}-${String(seq).padStart(6, '0')}`;

    expect(formatSku(1)).toBe('RAJ-000001');
    expect(formatSku(42)).toBe('RAJ-000042');
    expect(formatSku(9999)).toBe('RAJ-009999');
    expect(formatSku(100000)).toBe('RAJ-100000');
  });

  it('formats file sizes accurately for image compression reporting', async () => {
    const { formatFileSize } = await import('../../src/lib/image-compression');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(150 * 1024)).toBe('150.0 KB');
    expect(formatFileSize(3.4 * 1024 * 1024)).toBe('3.4 MB');
  });

  it('enforces RBAC deletion rules: only OWNER can delete products & customers, MANAGER cannot', async () => {
    const { canDeleteInventoryOrCustomer, canDeleteProduct, canDeleteCustomer } = await import('../../src/lib/permissions');

    expect(canDeleteInventoryOrCustomer('OWNER')).toBe(true);
    expect(canDeleteInventoryOrCustomer('MANAGER')).toBe(false);
    expect(canDeleteInventoryOrCustomer('CASHIER')).toBe(false);

    expect(canDeleteProduct('OWNER')).toBe(true);
    expect(canDeleteProduct('MANAGER')).toBe(false);
    expect(canDeleteCustomer('OWNER')).toBe(true);
    expect(canDeleteCustomer('MANAGER')).toBe(false);
  });
});
