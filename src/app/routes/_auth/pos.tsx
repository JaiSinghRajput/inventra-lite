import React, { useState, useEffect, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Tag,
  Wrench,
  User,
  CreditCard,
  Printer,
  CheckCircle,
  AlertCircle,
  Barcode,
  Package,
  Zap,
} from 'lucide-react';
import { lookupPosItemsFn, getPosCatalogFn, checkoutBillFn } from '../../../features/billing/server';
import { listCustomersFn } from '../../../features/customers/server';
import { formatINR, inrToPaise, paiseToINR } from '../../../lib/currency';
import { formatQuantity, parseCleanQuantity } from '../../../lib/quantity';
import { CHARGE_TYPES, CHARGE_LABELS, type ChargeType, type PaymentMethod } from '../../../lib/constants';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { ImageModal } from '../../../components/ui/image-modal';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';

export const Route = createFileRoute('/_auth/pos')({
  component: PosComponent,
});

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  imageUrl?: string;
  unitPrice: number; // in paise
  quantity: number;
  lineDiscount: number; // in paise
  lineTotal: number; // in paise
  availableStock: number;
}

interface CartCharge {
  chargeType: ChargeType;
  description: string;
  amount: number; // in paise
}

interface PaymentEntry {
  method: PaymentMethod;
  amount: number; // in paise
  referenceNote?: string;
}

function generateClientUuid() {
  return 'pos_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
}

function PosComponent() {
  const queryClient = useQueryClient();

  // Pre-load and cache entire active POS product catalog in client memory
  const { data: posCatalog = [], isLoading: isCatalogLoading } = useQuery({
    queryKey: ['pos-catalog'],
    queryFn: () => getPosCatalogFn(),
    staleTime: 5 * 60 * 1000, // 5 min client-side cache
  });

  // POS State
  const [searchQuery, setSearchQuery] = useState('');
  const [serverResults, setServerResults] = useState<any[]>([]);
  const [isServerSearching, setIsServerSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [charges, setCharges] = useState<CartCharge[]>([]);
  const [billDiscountINR, setBillDiscountINR] = useState<string>('0');
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; phone?: string | null } | null>(null);

  // Modals
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [completedBill, setCompletedBill] = useState<{ billId: string; billNumber: string; grandTotal: number; items: CartItem[]; payments: PaymentEntry[]; charges: CartCharge[] } | null>(null);

  // Full-screen image preview lightbox
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // New Charge form
  const [newChargeType, setNewChargeType] = useState<ChargeType>('labour');
  const [newChargeDesc, setNewChargeDesc] = useState('');
  const [newChargeAmountINR, setNewChargeAmountINR] = useState('');

  // Customer search modal
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerList, setCustomerList] = useState<any[]>([]);

  // Payment modal state
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [paymentAmountINR, setPaymentAmountINR] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashTenderedINR, setCashTenderedINR] = useState('');
  const [paymentRefNote, setPaymentRefNote] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(generateClientUuid);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global F2 keyboard shortcut to jump to search bar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Instant in-memory search across pre-loaded catalog (0ms latency, zero DB queries on keystroke)
  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    if (posCatalog.length > 0) {
      // 1. Exact barcode match (highest priority, immediate for barcode scanners)
      const exactBarcode = posCatalog.find(
        (p) => p.barcode && p.barcode.toLowerCase() === q
      );
      if (exactBarcode) return [exactBarcode];

      // 2. Exact SKU match
      const exactSku = posCatalog.find((p) => p.sku.toLowerCase() === q);
      if (exactSku) return [exactSku];

      // 3. Multi-token match across name, SKU, and barcode
      const tokens = q.split(/\s+/).filter(Boolean);
      return posCatalog
        .filter((p) => {
          const name = p.name.toLowerCase();
          const sku = p.sku.toLowerCase();
          const barcode = (p.barcode || '').toLowerCase();
          return tokens.every(
            (token) =>
              name.includes(token) || sku.includes(token) || barcode.includes(token)
          );
        })
        .slice(0, 30);
    }

    // Fallback to server results only if catalog is still fetching
    return serverResults;
  }, [searchQuery, posCatalog, serverResults]);

  // Fallback server query only when catalog has not finished initial load
  useEffect(() => {
    if (!searchQuery.trim() || posCatalog.length > 0) {
      setServerResults([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsServerSearching(true);
      try {
        const results = await lookupPosItemsFn({ data: { query: searchQuery } });
        if (isMounted) setServerResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setIsServerSearching(false);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, posCatalog.length]);

  // Load customers when modal opens
  useEffect(() => {
    let isCancelled = false;
    if (isCustomerModalOpen) {
      listCustomersFn({ data: { search: customerSearch } })
        .then((res) => {
          if (!isCancelled) setCustomerList(res);
        })
        .catch((err) => {
          console.warn('[POS] Failed to search customers:', err);
        });
    }
    return () => {
      isCancelled = true;
    };
  }, [isCustomerModalOpen, customerSearch]);

  // Add Item to Cart
  const addToCart = (product: any) => {
    const existingIndex = cart.findIndex((i) => i.productId === product.id);
    const available = parseCleanQuantity(product.stockQuantity);

    if (existingIndex > -1) {
      const existing = cart[existingIndex];
      const newQty = existing.quantity + 1;
      if (newQty > available) {
        alert(`Cannot add more. Only ${formatQuantity(available)} ${product.unit} in stock.`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        lineTotal: Math.round(newQty * existing.unitPrice) - existing.lineDiscount,
      };
      setCart(updated);
    } else {
      if (available <= 0) {
        alert(`Product is out of stock (${formatQuantity(available)} ${product.unit}).`);
        return;
      }
      const unitPrice = Number(product.sellingPrice);
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          imageUrl: product.imageUrl || undefined,
          unitPrice,
          quantity: 1,
          lineDiscount: 0,
          lineTotal: unitPrice,
          availableStock: available,
        },
      ]);
    }
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  // Update Cart Item Quantity (Direct Edit or +/-)
  const updateQuantity = (index: number, val: number | string) => {
    const item = cart[index];
    if (!item) return;

    let qty: number;
    if (typeof val === 'string') {
      const clean = val.replace(/[^0-9]/g, '').trim();
      if (clean === '') {
        qty = 0;
      } else {
        qty = parseInt(clean, 10);
        if (isNaN(qty)) qty = 0;
      }
    } else {
      qty = Math.round(val);
    }

    if (qty <= 0) {
      removeFromCart(index);
      return;
    }

    if (qty > item.availableStock) {
      alert(`Cannot set quantity to ${formatQuantity(qty)}. Only ${formatQuantity(item.availableStock)} ${item.unit} available in stock.`);
      qty = item.availableStock;
    }

    const updated = [...cart];
    updated[index] = {
      ...item,
      quantity: qty,
      lineTotal: Math.round(qty * item.unitPrice) - item.lineDiscount,
    };
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Add Charge
  const handleAddCharge = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = inrToPaise(newChargeAmountINR);
    if (paise <= 0) return;
    setCharges([
      ...charges,
      {
        chargeType: newChargeType,
        description: newChargeDesc.trim() || CHARGE_LABELS[newChargeType],
        amount: paise,
      },
    ]);
    setNewChargeDesc('');
    setNewChargeAmountINR('');
    setIsChargeModalOpen(false);
  };

  const removeCharge = (index: number) => {
    setCharges(charges.filter((_, i) => i !== index));
  };

  // Calculations
  const itemsSubtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  const billDiscount = inrToPaise(billDiscountINR);
  const grandTotal = Math.max(0, itemsSubtotal + chargesTotal - billDiscount);

  // Open Checkout / Payment Modal
  const openCheckout = () => {
    if (cart.length === 0) return;
    setCheckoutError('');
    setPayments([
      {
        method: 'CASH',
        amount: grandTotal,
      },
    ]);
    setPaymentAmountINR(paiseToINR(grandTotal).toString());
    setPaymentMethod('CASH');
    setCashTenderedINR(paiseToINR(grandTotal).toString());
    setIsPaymentModalOpen(true);
  };

  // Add Split Payment
  const addPaymentEntry = () => {
    const paise = inrToPaise(paymentAmountINR);
    if (paise <= 0) return;

    const currentTotalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    if (currentTotalPaid + paise > grandTotal) {
      setCheckoutError(`Total payments cannot exceed ${formatINR(grandTotal)}`);
      return;
    }

    setPayments([
      ...payments,
      {
        method: paymentMethod,
        amount: paise,
        referenceNote: paymentRefNote.trim() || undefined,
      },
    ]);
    setCheckoutError('');
    setPaymentRefNote('');

    const remaining = grandTotal - (currentTotalPaid + paise);
    setPaymentAmountINR(paiseToINR(remaining).toString());
  };

  const removePaymentEntry = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const dueAmount = grandTotal - totalPaid;
  const cashTenderedPaise = inrToPaise(cashTenderedINR);
  const cashPaidAmount = payments.filter((p) => p.method === 'CASH').reduce((sum, p) => sum + p.amount, 0);
  const changeDue = Math.max(0, cashTenderedPaise - cashPaidAmount);

  // Submit Checkout Mutation
  const handleFinalizeBill = async () => {
    if (isSubmitting) return;
    setCheckoutError('');

    if (dueAmount > 0 && !selectedCustomer) {
      setCheckoutError('A customer must be selected when there is an unpaid balance (credit sale).');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await checkoutBillFn({
        data: {
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            lineDiscount: i.lineDiscount,
          })),
          charges: charges.map((c) => ({
            chargeType: c.chargeType,
            description: c.description,
            amount: c.amount,
          })),
          billDiscount,
          customerId: selectedCustomer?.id || null,
          payments: payments.map((p) => ({
            amount: p.amount,
            method: p.method,
            referenceNote: p.referenceNote,
          })),
          idempotencyKey,
        },
      });

      // Bill completed successfully!
      setCompletedBill({
        billId: res.billId,
        billNumber: res.billNumber,
        grandTotal,
        items: [...cart],
        payments: [...payments],
        charges: [...charges],
      });

      // Invalidate relevant queries so other pages have fresh data
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });

      // Reset cart and generate new idempotency key
      setCart([]);
      setCharges([]);
      setBillDiscountINR('0');
      setSelectedCustomer(null);
      setPayments([]);
      setIsPaymentModalOpen(false);
      setIdempotencyKey(generateClientUuid());
    } catch (err: any) {
      setCheckoutError(err?.message || 'Checkout failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 h-full min-w-0">
      {/* LEFT PANE: Search & Product Quick Catalog */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 select-none pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Scan barcode or search product by name/SKU... (F2)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (searchResults.length > 0) {
                  addToCart(searchResults[0]);
                }
              }
            }}
            className="w-full pl-9 pr-24 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
          />
          {isCatalogLoading && posCatalog.length === 0 ? (
            <div className="absolute right-3 top-3 text-xs text-slate-400 animate-pulse">Loading catalog...</div>
          ) : isServerSearching ? (
            <div className="absolute right-3 top-3 text-xs text-slate-400 animate-pulse">Searching...</div>
          ) : posCatalog.length > 0 ? (
            <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full select-none pointer-events-none">
              <Zap className="w-3 h-3 text-emerald-500" />
              <span>Instant</span>
            </div>
          ) : null}
        </div>

        {searchQuery.trim() && searchResults.length === 0 && (
          <div className="mb-4 p-4 rounded-lg border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
            No active products found matching "{searchQuery}"
          </div>
        )}

        {/* Search Results Dropdown / Grid */}
        {searchResults.length > 0 && (
          <div className="mb-4 max-h-60 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white shadow-md z-20">
            {searchResults.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-brand-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  {product.imageUrl ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage({
                          url: product.imageUrl,
                          title: product.name,
                          subtitle: `${product.sku} • Available: ${formatQuantity(product.stockQuantity)} ${product.unit}`,
                        });
                      }}
                      className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100 hover:opacity-80 transition-opacity cursor-pointer"
                      title="Click to view full photo"
                    >
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate">{product.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400">{product.sku}</span>
                      {product.barcode && (
                        <span className="flex items-center gap-0.5 text-slate-400 text-[10px]">
                          <Barcode className="w-3 h-3" /> {product.barcode}
                        </span>
                      )}
                      <span>• Stock: {formatQuantity(product.stockQuantity)} {product.unit}</span>
                    </div>
                  </div>
                </div>
                <div className="text-sm font-bold text-brand-700">
                  {formatINR(product.sellingPrice)}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Instructions / Quick Hints */}
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg text-slate-400">
          <Barcode className="w-8 h-8 mb-2 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Scan Barcode or Type Product Name</p>
          <p className="text-xs text-slate-400 mt-0.5">Use barcode scanner at counter or search to add items to cart</p>
        </div>
      </div>

      {/* RIGHT PANE: Cart & Checkout Summary */}
      <div className="w-full md:w-[420px] lg:w-[460px] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Customer Header */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <div className="text-xs">
              <span className="text-slate-500">Customer: </span>
              <strong className="text-slate-900 font-semibold">
                {selectedCustomer ? selectedCustomer.name : 'Walk-in Guest'}
              </strong>
              {selectedCustomer?.phone && (
                <span className="text-slate-400 ml-1">({selectedCustomer.phone})</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsCustomerModalOpen(true)}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            {selectedCustomer ? 'Change' : '+ Add Customer'}
          </button>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[220px] max-h-[calc(100vh-380px)]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-10">
              Your cart is empty. Scan an item or search above.
            </div>
          ) : (
            cart.map((item, index) => (
              <div
                key={item.productId}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                  {item.imageUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          url: item.imageUrl!,
                          title: item.name,
                          subtitle: `${item.sku} • In Cart: ${formatQuantity(item.quantity)} ${item.unit}`,
                        })
                      }
                      className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-white hover:opacity-80 transition-opacity cursor-pointer"
                      title="Click to view full photo"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{item.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {formatINR(item.unitPrice)} / {item.unit}
                    </div>
                  </div>
                </div>

                {/* Direct Quantity Edit & +/- Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(index, item.quantity - 1)}
                    className="w-6 h-6 rounded flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer active:scale-95"
                    title="Decrease by 1"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={item.quantity}
                    onChange={(e) => updateQuantity(index, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-12 h-6 text-center text-xs font-bold border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-inner"
                    title="Direct quantity edit (replaces existing)"
                  />
                  <button
                    onClick={() => updateQuantity(index, item.quantity + 1)}
                    className="w-6 h-6 rounded flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer active:scale-95"
                    title="Increase by 1"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="w-20 text-right font-bold text-xs text-slate-900 pl-2">
                  {formatINR(item.lineTotal)}
                </div>

                <button
                  onClick={() => removeFromCart(index)}
                  className="ml-2 p-1 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}

          {/* Additional Charges in Cart */}
          {charges.map((charge, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg border border-teal-100 bg-teal-50/50 text-xs"
            >
              <div className="flex items-center gap-1.5 text-teal-800 font-medium">
                <Wrench className="w-3.5 h-3.5 text-teal-600" />
                <span>{charge.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-teal-900">{formatINR(charge.amount)}</span>
                <button
                  onClick={() => removeCharge(idx)}
                  className="text-teal-400 hover:text-rose-600 p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons: Add Charges & Bill Discount */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChargeModalOpen(true)}
            className="flex-1 text-xs"
          >
            <Wrench className="w-3.5 h-3.5" /> Add Charge
          </Button>

          <div className="flex items-center gap-1 flex-1">
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="number"
              placeholder="Discount ₹"
              value={billDiscountINR}
              onChange={(e) => setBillDiscountINR(e.target.value)}
              className="w-full text-xs rounded border border-slate-300 px-2 py-1.5 bg-white text-right font-semibold"
            />
          </div>
        </div>

        {/* Totals Summary */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Items Subtotal:</span>
            <span>{formatINR(itemsSubtotal)}</span>
          </div>
          {chargesTotal > 0 && (
            <div className="flex justify-between text-xs text-slate-600">
              <span>Additional Charges:</span>
              <span>+{formatINR(chargesTotal)}</span>
            </div>
          )}
          {billDiscount > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 font-medium">
              <span>Discount:</span>
              <span>-{formatINR(billDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-100">
            <span>Grand Total:</span>
            <span className="text-brand-700 text-lg">{formatINR(grandTotal)}</span>
          </div>

          <Button
            onClick={openCheckout}
            disabled={cart.length === 0}
            className="w-full mt-3 h-12 text-base font-bold shadow-md"
          >
            Checkout {formatINR(grandTotal)}
          </Button>
        </div>
      </div>

      {/* MODAL 1: ADD CHARGES */}
      <Modal
        isOpen={isChargeModalOpen}
        onClose={() => setIsChargeModalOpen(false)}
        title="Add Bill Charge"
        description="Add service, labour, delivery or installation fees to this bill."
      >
        <form onSubmit={handleAddCharge} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Charge Category</label>
            <select
              value={newChargeType}
              onChange={(e) => setNewChargeType(e.target.value as ChargeType)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {CHARGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CHARGE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Description (Optional)"
            placeholder="e.g. AC Fitting, Express Delivery"
            value={newChargeDesc}
            onChange={(e) => setNewChargeDesc(e.target.value)}
          />

          <Input
            label="Amount (₹)"
            type="number"
            placeholder="e.g. 250"
            value={newChargeAmountINR}
            onChange={(e) => setNewChargeAmountINR(e.target.value)}
            required
            autoFocus
          />

          <Button type="submit" className="w-full">
            Add to Bill
          </Button>
        </form>
      </Modal>

      {/* MODAL 2: SELECT CUSTOMER */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Select Customer"
        description="Search customer by name or phone to associate with this bill."
      >
        <div className="space-y-3">
          <Input
            placeholder="Type customer name or phone..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            autoFocus
          />

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setIsCustomerModalOpen(false);
              }}
              className="w-full p-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Walk-in Guest (No Customer)</span>
              {!selectedCustomer && <Badge variant="neutral">Active</Badge>}
            </button>

            {customerList.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone });
                  setIsCustomerModalOpen(false);
                }}
                className="w-full p-2.5 text-left text-xs hover:bg-brand-50 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900">{c.name}</div>
                  {c.phone && <div className="text-[11px] text-slate-500">{c.phone}</div>}
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Due Balance</div>
                  <div
                    className={`font-semibold text-xs ${
                      c.receivableBalance > 0 ? 'text-rose-600' : 'text-slate-600'
                    }`}
                  >
                    {formatINR(c.receivableBalance)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* MODAL 3: CHECKOUT & PAYMENT MODAL */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Finalize Bill Payment"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {checkoutError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{checkoutError}</span>
            </div>
          )}

          {/* Amount Overview */}
          <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Grand Total</span>
              <p className="text-sm font-extrabold text-slate-900">{formatINR(grandTotal)}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Paid Amount</span>
              <p className="text-sm font-extrabold text-emerald-600">{formatINR(totalPaid)}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Remaining Due</span>
              <p className={`text-sm font-extrabold ${dueAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {formatINR(dueAmount)}
              </p>
            </div>
          </div>

          {dueAmount > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
              <div>
                <strong>Credit Sale:</strong> ₹{paiseToINR(dueAmount)} will be debited to{' '}
                <strong>{selectedCustomer?.name || 'Walk-in'}</strong>.
              </div>
              {!selectedCustomer && (
                <button
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="underline font-bold text-amber-900"
                >
                  Select Customer
                </button>
              )}
            </div>
          )}

          {/* Existing Payments List */}
          {payments.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-700">Tenders Allocated:</span>
              {payments.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="brand">{p.method}</Badge>
                    {p.referenceNote && <span className="text-slate-400">({p.referenceNote})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{formatINR(p.amount)}</span>
                    <button onClick={() => removePaymentEntry(idx)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Split Tender Entry if not fully paid */}
          {dueAmount > 0 && (
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2.5">
              <span className="text-xs font-semibold text-slate-700 block">Add Payment Mode:</span>
              <div className="flex gap-2">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium focus:ring-brand-500"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="CARD">CARD</option>
                  <option value="OTHER">OTHER</option>
                </select>

                <input
                  type="number"
                  placeholder="Amount ₹"
                  value={paymentAmountINR}
                  onChange={(e) => setPaymentAmountINR(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold bg-white"
                />

                <Button size="sm" onClick={addPaymentEntry} type="button">
                  Add Tender
                </Button>
              </div>

              {paymentMethod !== 'CASH' && (
                <input
                  type="text"
                  placeholder="Reference Note / UPI Trans ID / Last 4 Digits"
                  value={paymentRefNote}
                  onChange={(e) => setPaymentRefNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-xs bg-white"
                />
              )}
            </div>
          )}

          {/* Cash Change Due Calculator */}
          {cashPaidAmount > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-900">Cash Tendered by Customer:</span>
                <input
                  type="number"
                  value={cashTenderedINR}
                  onChange={(e) => setCashTenderedINR(e.target.value)}
                  className="w-24 text-right rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-bold"
                />
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-emerald-800">
                <span>Change Due to Customer:</span>
                <span className="text-base text-emerald-900">{formatINR(changeDue)}</span>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              onClick={handleFinalizeBill}
              isLoading={isSubmitting}
              className="w-full h-12 text-base font-bold shadow-md"
            >
              Complete Sale & Record Bill
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: THERMAL RECEIPT MODAL */}
      {completedBill && (
        <Modal
          isOpen={true}
          onClose={() => setCompletedBill(null)}
          title="Sale Completed Successfully"
          maxWidth="sm"
        >
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-slate-900">{completedBill.billNumber}</h4>
              <p className="text-xs text-slate-500">Invoice recorded atomically with stock deductions</p>
            </div>

            {/* Printable 80mm Receipt Container */}
            <div id="printable-receipt" className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-left text-xs font-mono space-y-2">
              <div className="text-center font-bold text-sm border-b pb-1">INVENTRA LITE POS</div>
              <div className="flex justify-between text-[11px]">
                <span>Bill: {completedBill.billNumber}</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="border-t border-b py-1 space-y-1">
                {completedBill.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.name} x {item.quantity}</span>
                    <span>{formatINR(item.lineTotal)}</span>
                  </div>
                ))}
                {completedBill.charges.map((c, idx) => (
                  <div key={idx} className="flex justify-between text-slate-600">
                    <span>{c.description}</span>
                    <span>{formatINR(c.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-sm pt-1">
                <span>TOTAL:</span>
                <span>{formatINR(completedBill.grandTotal)}</span>
              </div>
              <div className="text-center text-[10px] text-slate-500 pt-2 border-t">
                Thank you for your visit!
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </Button>
              <Button
                className="flex-1"
                onClick={() => setCompletedBill(null)}
              >
                Next Sale (F2)
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* FULL-SCREEN IMAGE LIGHTBOX MODAL */}
      <ImageModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url}
        title={previewImage?.title}
        subtitle={previewImage?.subtitle}
      />
    </div>
  );
}
