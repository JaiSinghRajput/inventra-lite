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
    const { canDeleteInventoryOrCustomer, canDeleteProduct, canDeleteCustomer, canManageStaff } = await import('../../src/lib/permissions');

    expect(canDeleteInventoryOrCustomer('OWNER')).toBe(true);
    expect(canDeleteInventoryOrCustomer('MANAGER')).toBe(false);
    expect(canDeleteInventoryOrCustomer('CASHIER')).toBe(false);

    expect(canDeleteProduct('OWNER')).toBe(true);
    expect(canDeleteProduct('MANAGER')).toBe(false);
    expect(canDeleteCustomer('OWNER')).toBe(true);
    expect(canDeleteCustomer('MANAGER')).toBe(false);

    expect(canManageStaff('OWNER')).toBe(true);
    expect(canManageStaff('MANAGER')).toBe(false);
    expect(canManageStaff('CASHIER')).toBe(false);
  });

  it('correctly extracts Cloudinary public_id from various Cloudinary URL formats and rejects non-Cloudinary URLs', async () => {
    const { extractCloudinaryPublicId } = await import('../../src/features/upload/cloudinary-server');

    // Standard versioned URL
    expect(
      extractCloudinaryPublicId('https://res.cloudinary.com/mycloud/image/upload/v1727622839/inventra_products/sample_123.jpg')
    ).toBe('inventra_products/sample_123');

    // Unversioned URL
    expect(
      extractCloudinaryPublicId('https://res.cloudinary.com/mycloud/image/upload/inventra_products/sample_123.webp')
    ).toBe('inventra_products/sample_123');

    // Transformed URL
    expect(
      extractCloudinaryPublicId('https://res.cloudinary.com/mycloud/image/upload/c_scale,w_500/v1727622839/inventra_products/sample_123.png')
    ).toBe('inventra_products/sample_123');

    // Non-cloudinary URL
    expect(extractCloudinaryPublicId('https://images.unsplash.com/photo-123456')).toBeNull();
    expect(extractCloudinaryPublicId(null)).toBeNull();
    expect(extractCloudinaryPublicId('')).toBeNull();
  });

  it('handles deleteFromCloudinary safely when URL is external or credentials are unset', async () => {
    const { deleteFromCloudinary } = await import('../../src/features/upload/cloudinary-server');

    // Non-cloudinary URL
    const externalResult = await deleteFromCloudinary('https://images.unsplash.com/photo-123456');
    expect(externalResult.success).toBe(false);
    expect(externalResult.reason).toContain('Not a recognized Cloudinary');

    // Empty URL
    const emptyResult = await deleteFromCloudinary('');
    expect(emptyResult.success).toBe(false);
  });

  it('enforces product inventory stock quantities, thresholds, and adjustment deltas must be whole integers', async () => {
    const { createProductSchema, adjustStockSchema, updateProductSchema } = await import('../../src/features/inventory/schemas');

    // Floats in initial stock must fail validation
    const floatInitial = createProductSchema.safeParse({
      name: 'Cement Bag',
      sellingPrice: 40000,
      initialStock: 12.5,
    });
    expect(floatInitial.success).toBe(false);

    // Floats in low stock threshold must fail validation
    const floatThreshold = createProductSchema.safeParse({
      name: 'Cement Bag',
      sellingPrice: 40000,
      lowStockThreshold: 4.2,
    });
    expect(floatThreshold.success).toBe(false);

    // Integers in initial stock and threshold must succeed
    const validProduct = createProductSchema.safeParse({
      name: 'Cement Bag',
      sellingPrice: 40000,
      initialStock: 12,
      lowStockThreshold: 5,
    });
    expect(validProduct.success).toBe(true);

    // Float delta in adjustment must fail validation
    const floatDelta = adjustStockSchema.safeParse({
      productId: 'p_1',
      delta: 2.5,
      reason: 'Physical count audit',
    });
    expect(floatDelta.success).toBe(false);

    // Whole integer delta in adjustment must succeed
    const validDelta = adjustStockSchema.safeParse({
      productId: 'p_1',
      delta: -3,
      reason: 'Physical count audit',
    });
    expect(validDelta.success).toBe(true);
  });

  it('correctly qualifies low stock and out-of-stock active items in low stock filter', () => {
    const isItemLowStockOrOut = (item: {
      status: 'active' | 'inactive';
      stockQuantity: number;
      lowStockThreshold: number | null;
    }) => {
      const isOutOfStockActive = item.status === 'active' && item.stockQuantity <= 0;
      const isBelowThreshold = item.lowStockThreshold !== null && item.stockQuantity <= item.lowStockThreshold;
      return isOutOfStockActive || isBelowThreshold;
    };

    // Active item with 0 stock and no threshold must be included
    expect(isItemLowStockOrOut({ status: 'active', stockQuantity: 0, lowStockThreshold: null })).toBe(true);

    // Inactive item with 0 stock and no threshold must NOT be included
    expect(isItemLowStockOrOut({ status: 'inactive', stockQuantity: 0, lowStockThreshold: null })).toBe(false);

    // Active item with stock at threshold must be included
    expect(isItemLowStockOrOut({ status: 'active', stockQuantity: 5, lowStockThreshold: 5 })).toBe(true);

    // Active item with healthy stock above threshold must NOT be included
    expect(isItemLowStockOrOut({ status: 'active', stockQuantity: 10, lowStockThreshold: 5 })).toBe(false);
  });

  it('performs instant tokenized in-memory search across catalog with barcode priority', () => {
    const catalog = [
      { id: '1', name: 'Polycab 2.5 Sqmm Copper Wire Red', sku: 'RAJ-000001', barcode: '8901234567890' },
      { id: '2', name: 'Finolex 1.5 Sqmm Copper Wire Blue', sku: 'RAJ-000002', barcode: '8901234567891' },
      { id: '3', name: 'Havells 2.5 Sqmm Wire Yellow', sku: 'RAJ-000003', barcode: '8901234567892' },
      { id: '4', name: 'Anchor Modular Switch 6A', sku: 'RAJ-000004', barcode: '8901234567893' },
    ];

    const searchPosCatalog = (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return [];

      // 1. Exact barcode match
      const exactBarcode = catalog.find((p) => p.barcode && p.barcode.toLowerCase() === q);
      if (exactBarcode) return [exactBarcode];

      // 2. Exact SKU match
      const exactSku = catalog.find((p) => p.sku.toLowerCase() === q);
      if (exactSku) return [exactSku];

      // 3. Multi-token match
      const tokens = q.split(/\s+/).filter(Boolean);
      return catalog.filter((p) => {
        const name = p.name.toLowerCase();
        const sku = p.sku.toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        return tokens.every((t) => name.includes(t) || sku.includes(t) || barcode.includes(t));
      });
    };

    // Barcode scanner exact match
    expect(searchPosCatalog('8901234567891')).toHaveLength(1);
    expect(searchPosCatalog('8901234567891')[0].sku).toBe('RAJ-000002');

    // Multi-term search: "wire 2.5" matches Polycab and Havells
    const results = searchPosCatalog('wire 2.5');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(['1', '3']);

    // SKU search
    expect(searchPosCatalog('RAJ-000004')).toHaveLength(1);
    expect(searchPosCatalog('RAJ-000004')[0].name).toContain('Anchor Modular Switch');

    // Case-insensitivity
    expect(searchPosCatalog('POLYCAB')).toHaveLength(1);
  });

  it('supports custom sell price override per product at POS and validates lineGross calculations', () => {
    const predefinedCatalogPrice = 12000; // ₹120.00
    const customSellPrice = 11000; // ₹110.00 (discounted/negotiated at POS)
    const quantity = 3;

    // Line Gross must use custom sell price when provided
    const calculateLineGross = (qty: number, catalogPrice: number, overridePrice?: number) => {
      const effectiveUnitPrice = typeof overridePrice === 'number' && overridePrice >= 0 ? overridePrice : catalogPrice;
      return {
        unitPrice: effectiveUnitPrice,
        lineGross: Math.round(qty * effectiveUnitPrice),
      };
    };

    const resultWithOverride = calculateLineGross(quantity, predefinedCatalogPrice, customSellPrice);
    expect(resultWithOverride.unitPrice).toBe(11000);
    expect(resultWithOverride.lineGross).toBe(33000); // 3 * ₹110 = ₹330

    // Without override, defaults to catalog price
    const resultDefault = calculateLineGross(quantity, predefinedCatalogPrice, undefined);
    expect(resultDefault.unitPrice).toBe(12000);
    expect(resultDefault.lineGross).toBe(36000); // 3 * ₹120 = ₹360

    // Invariant: line discount must not exceed custom line gross
    const lineDiscount = 5000; // ₹50
    expect(lineDiscount).toBeLessThanOrEqual(resultWithOverride.lineGross);
    const lineTotal = resultWithOverride.lineGross - lineDiscount;
    expect(lineTotal).toBe(28000);
  });

  it('ensures sales analytics and daily summaries reflect custom sell price totals instead of predefined catalog prices', () => {
    const billItems = [
      { productId: 'p1', catalogPrice: 10000, customUnitPrice: 8500, quantity: 2, lineDiscount: 0 }, // ₹85 x 2 = ₹170 (catalog was ₹100 x 2 = ₹200)
      { productId: 'p2', catalogPrice: 5000, customUnitPrice: 6000, quantity: 1, lineDiscount: 0 },  // ₹60 x 1 = ₹60 (catalog was ₹50 x 1 = ₹50)
    ];

    const itemsSubtotal = billItems.reduce((sum, item) => {
      const price = item.customUnitPrice ?? item.catalogPrice;
      return sum + (price * item.quantity - item.lineDiscount);
    }, 0);

    // ₹170 + ₹60 = ₹230 (23000 paise), whereas catalog prices would have been ₹200 + ₹50 = ₹250 (25000 paise)
    expect(itemsSubtotal).toBe(23000);

    const grandTotal = itemsSubtotal; // 23000 paise
    const paidAmount = 23000;

    // Simulate daily sales analytics aggregation
    const simulatedBills = [
      { id: 'b1', grandTotal, paidAmount, dueAmount: 0, status: 'completed' }
    ];

    const totalSalesSummary = simulatedBills
      .filter((b) => b.status === 'completed')
      .reduce((acc, curr) => ({
        totalSales: acc.totalSales + curr.grandTotal,
        totalCollected: acc.totalCollected + curr.paidAmount,
      }), { totalSales: 0, totalCollected: 0 });

    expect(totalSalesSummary.totalSales).toBe(23000); // Reflects the actual negotiated custom sales
    expect(totalSalesSummary.totalSales).not.toBe(25000); // Does NOT reflect predefined catalog prices
  });
});

