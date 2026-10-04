import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  UserPlus,
  CreditCard,
  Printer,
  CheckCircle,
  AlertCircle,
  Barcode,
  Package,
  Zap,
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Filter,
  DollarSign,
  Receipt,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { lookupPosItemsFn, getPosCatalogFn, checkoutBillFn } from '../../../features/billing/server';
import { listCustomersFn, createCustomerFn } from '../../../features/customers/server';
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
  loader: async () => {
    try {
      return await getPosCatalogFn();
    } catch {
      return [];
    }
  },
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

// Client-side customer field validation helper
function validateCustomerInput(name: string, phone: string): { nameError?: string; phoneError?: string; isValid: boolean } {
  const cleanName = name.trim();
  const cleanPhone = phone.trim().replace(/[\s-]/g, '');

  let nameError: string | undefined;
  let phoneError: string | undefined;

  if (!cleanName) {
    nameError = 'Customer name is required.';
  } else if (cleanName.length < 2) {
    nameError = 'Customer name must be at least 2 characters.';
  } else if (cleanName.length > 100) {
    nameError = 'Customer name cannot exceed 100 characters.';
  }

  if (cleanPhone) {
    const digitsOnly = cleanPhone.replace(/^\+91|^0/, '');
    if (!/^\d+$/.test(digitsOnly)) {
      phoneError = 'Phone number should only contain digits.';
    } else if (digitsOnly.length !== 10) {
      phoneError = `Phone number must be exactly 10 digits (${digitsOnly.length}/10 entered).`;
    } else if (!/^[6-9]\d{9}$/.test(digitsOnly)) {
      phoneError = 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.';
    }
  }

  return {
    nameError,
    phoneError,
    isValid: !nameError && !phoneError,
  };
}

function PosComponent() {
  const queryClient = useQueryClient();
  const initialCatalog = Route.useLoaderData();

  // Pre-load and cache active POS product catalog in client memory (5 min stale time)
  const { data: posCatalog = [], isLoading: isCatalogLoading } = useQuery({
    queryKey: ['pos-catalog'],
    queryFn: () => getPosCatalogFn(),
    initialData: initialCatalog && initialCatalog.length > 0 ? initialCatalog : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Mobile multi-step wizard state (1: Customer, 2: Items, 3: Bill & Charges, 4: Payment & Slip)
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3 | 4>(1);

  // In-stock only filter toggle for mobile
  const [inStockOnly, setInStockOnly] = useState(true);

  // Mobile Cart Drawer open on step 2
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Direct Quantity Edit Popup Modal for Mobile
  const [qtyEditModalItem, setQtyEditModalItem] = useState<{
    productId: string;
    name: string;
    unit: string;
    availableStock: number;
    currentQty: number;
  } | null>(null);
  const [tempQtyInput, setTempQtyInput] = useState<string>('1');

  // Customer Form & Modal State (Phone-first smart lookup & creation)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCustomerCreating, setIsCustomerCreating] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState('');

  // Real-time client-side customer field validation
  const customerValidation = useMemo(() => {
    return validateCustomerInput(newCustName, newCustPhone);
  }, [newCustName, newCustPhone]);

  // Mobile Payment Step 4 Dedicated State (NOT prefilled by default as requested!)
  const [mobilePaymentMethod, setMobilePaymentMethod] = useState<PaymentMethod>('CASH');
  const [mobileAmountReceivedINR, setMobileAmountReceivedINR] = useState<string>('');
  const [mobileRefNote, setMobileRefNote] = useState<string>('');

  // POS General State
  const [searchQuery, setSearchQuery] = useState('');
  const [serverResults, setServerResults] = useState<any[]>([]);
  const [isServerSearching, setIsServerSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [charges, setCharges] = useState<CartCharge[]>([]);
  const [billDiscountINR, setBillDiscountINR] = useState<string>('0');
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; phone?: string | null; receivableBalance?: number } | null>(null);

  // Modals
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false); // Desktop payment modal
  const [completedBill, setCompletedBill] = useState<{
    billId: string;
    billNumber: string;
    grandTotal: number;
    items: CartItem[];
    payments: PaymentEntry[];
    charges: CartCharge[];
  } | null>(null);

  // Full-screen image preview lightbox
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // New Charge form
  const [newChargeType, setNewChargeType] = useState<ChargeType>('labour');
  const [newChargeDesc, setNewChargeDesc] = useState('');
  const [newChargeAmountINR, setNewChargeAmountINR] = useState('');

  // Customer search with React Query caching & debounce
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const { data: customerList = [], isLoading: isCustomerListLoading } = useQuery({
    queryKey: ['pos-customers', debouncedCustomerSearch],
    queryFn: () => listCustomersFn({ data: { search: debouncedCustomerSearch || undefined } }),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Filtered customer list for smart phone-first lookup
  const filteredCustomerList = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customerList;
    return customerList.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').replace(/[\s-]/g, '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [customerList, customerSearch]);

  // Desktop Payment modal state
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
        setMobileStep(2);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Strictly in-stock catalog for POS: hide out-of-stock items (stock <= 0)
  const inStockCatalog = useMemo(() => {
    if (!posCatalog || posCatalog.length === 0) return [];
    return posCatalog.filter((p) => {
      const stock = parseCleanQuantity(p.stockQuantity);
      return stock > 0;
    });
  }, [posCatalog]);

  const displayedCatalog = inStockCatalog;

  // Instant in-memory search across in-stock catalog with safe normalization and server fallback
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().normalize('NFC');
    if (!q) return [];

    let localMatches: any[] = [];
    if (inStockCatalog && inStockCatalog.length > 0) {
      const exactBarcode = inStockCatalog.find(
        (p) => p.barcode && p.barcode.trim().toLowerCase() === q
      );
      if (exactBarcode) return [exactBarcode];

      const exactSku = inStockCatalog.find((p) => p.sku && p.sku.trim().toLowerCase() === q);
      if (exactSku) return [exactSku];

      const tokens = q.split(/\s+/).filter(Boolean);
      localMatches = inStockCatalog
        .filter((p) => {
          const name = (p.name || '').toLowerCase().normalize('NFC');
          const sku = (p.sku || '').toLowerCase().normalize('NFC');
          const barcode = (p.barcode || '').toLowerCase().normalize('NFC');
          return tokens.every(
            (token) =>
              name.includes(token) || sku.includes(token) || barcode.includes(token)
          );
        })
        .slice(0, 30);
    }

    if (localMatches.length > 0) {
      return localMatches;
    }

    return (serverResults || []).filter((p) => parseCleanQuantity(p.stockQuantity) > 0);
  }, [searchQuery, inStockCatalog, serverResults]);

  // Server query fallback for robust matching
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setServerResults([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsServerSearching(true);
      try {
        const results = await lookupPosItemsFn({ data: { query: q } });
        if (isMounted) setServerResults(results || []);
      } catch (err) {
        console.error('[LookupPosItemsError]', err);
      } finally {
        if (isMounted) setIsServerSearching(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Cart item lookup helper
  const getCartItem = (productId: string): CartItem | undefined => {
    return cart.find((i) => i.productId === productId);
  };

  // Add Item to Cart
  const addToCart = (product: any) => {
    const existingIndex = cart.findIndex((i) => i.productId === product.id);
    const available = parseCleanQuantity(product.stockQuantity);

    if (existingIndex > -1) {
      const existing = cart[existingIndex];
      const newQty = existing.quantity + 1;
      if (newQty > available) {
        toast.warning(`Cannot add more. Only ${formatQuantity(available)} ${product.unit} in stock.`);
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
        toast.error(`Product is out of stock (${formatQuantity(available)} ${product.unit}).`);
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
  };

  // Update Cart Item Quantity (for Desktop)
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
      toast.warning(`Cannot set quantity to ${formatQuantity(qty)}. Only ${formatQuantity(item.availableStock)} ${item.unit} available in stock.`);
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

  // Mobile quantity decrement helper
  const decrementCartItem = (productId: string) => {
    const existingIndex = cart.findIndex((i) => i.productId === productId);
    if (existingIndex === -1) return;

    const existing = cart[existingIndex];
    if (existing.quantity <= 1) {
      setCart(cart.filter((i) => i.productId !== productId));
    } else {
      const updated = [...cart];
      const newQty = existing.quantity - 1;
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        lineTotal: Math.round(newQty * existing.unitPrice) - existing.lineDiscount,
      };
      setCart(updated);
    }
  };

  // Set direct quantity for product
  const setDirectQuantity = (productId: string, qty: number) => {
    const productInCatalog = posCatalog.find((p) => p.id === productId);
    const existingIndex = cart.findIndex((i) => i.productId === productId);
    const available = productInCatalog ? parseCleanQuantity(productInCatalog.stockQuantity) : 9999;

    if (qty <= 0) {
      if (existingIndex > -1) {
        setCart(cart.filter((i) => i.productId !== productId));
      }
      return;
    }

    if (qty > available) {
      toast.warning(`Cannot set quantity to ${formatQuantity(qty)}. Only ${formatQuantity(available)} in stock.`);
      qty = available;
    }

    if (existingIndex > -1) {
      const existing = cart[existingIndex];
      const updated = [...cart];
      updated[existingIndex] = {
        ...existing,
        quantity: qty,
        lineTotal: Math.round(qty * existing.unitPrice) - existing.lineDiscount,
      };
      setCart(updated);
    } else if (productInCatalog) {
      const unitPrice = Number(productInCatalog.sellingPrice);
      setCart([
        ...cart,
        {
          productId: productInCatalog.id,
          name: productInCatalog.name,
          sku: productInCatalog.sku,
          unit: productInCatalog.unit,
          imageUrl: productInCatalog.imageUrl || undefined,
          unitPrice,
          quantity: qty,
          lineDiscount: 0,
          lineTotal: Math.round(qty * unitPrice),
          availableStock: available,
        },
      ]);
    }
  };

  // Open direct quantity editor popup (Mobile)
  const openQuantityPopup = (product: { id: string; name: string; unit: string; stockQuantity: any }) => {
    const cartItem = getCartItem(product.id);
    const currentQty = cartItem ? cartItem.quantity : 1;
    const available = parseCleanQuantity(product.stockQuantity);
    setQtyEditModalItem({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      availableStock: available,
      currentQty,
    });
    setTempQtyInput(String(currentQty));
  };

  const handleSaveQuantityPopup = () => {
    if (!qtyEditModalItem) return;
    const cleanQty = parseInt(tempQtyInput.replace(/[^0-9]/g, ''), 10) || 0;
    setDirectQuantity(qtyEditModalItem.productId, cleanQty);
    setQtyEditModalItem(null);
  };

  // Add Charge
  const handleAddCharge = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
  const totalCartUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  const billDiscount = inrToPaise(billDiscountINR);
  const grandTotal = Math.max(0, itemsSubtotal + chargesTotal - billDiscount);

  // Desktop Open Checkout / Payment Modal
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

  // Desktop Add Split Payment
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

  // Mobile Step 4 received calculation: Not pre-filled! Calculated when user enters amount.
  const mobileReceivedPaise = inrToPaise(mobileAmountReceivedINR);
  const mobileChangeDue = Math.max(0, mobileReceivedPaise - grandTotal);
  const mobileUnpaidBalance = Math.max(0, grandTotal - mobileReceivedPaise);

  // Submit Final Sale (shared by both Desktop and Mobile Step 4)
  const submitSale = async (appliedPayments: PaymentEntry[]) => {
    if (isSubmitting) return;
    setCheckoutError('');

    if (cart.length === 0) {
      setCheckoutError('Please add items to cart before completing sale.');
      return;
    }

    const totalPaidAmount = appliedPayments.reduce((s, p) => s + p.amount, 0);
    const remainingDue = grandTotal - totalPaidAmount;

    if (remainingDue > 0 && !selectedCustomer) {
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
          payments: appliedPayments.map((p) => ({
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
        payments: [...appliedPayments],
        charges: [...charges],
      });

      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['pos-customers'] });

      // Reset cart and states
      setCart([]);
      setCharges([]);
      setBillDiscountINR('0');
      setSelectedCustomer(null);
      setPayments([]);
      setMobileAmountReceivedINR('');
      setMobileRefNote('');
      setIsPaymentModalOpen(false);
      setMobileStep(1);
      setIdempotencyKey(generateClientUuid());
    } catch (err: any) {
      setCheckoutError(err?.message || 'Checkout failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit sale from Desktop Modal
  const handleFinalizeBillDesktop = () => {
    submitSale(payments);
  };

  // Submit sale from Mobile Step 4
  const handleFinalizeBillMobile = () => {
    let finalAmount = mobileReceivedPaise;

    if (mobilePaymentMethod !== 'CASH' && finalAmount === 0 && !mobileAmountReceivedINR) {
      finalAmount = grandTotal;
    }

    const paymentAmount = Math.min(finalAmount, grandTotal);

    const mobilePayments: PaymentEntry[] = paymentAmount > 0 ? [
      {
        method: mobilePaymentMethod,
        amount: paymentAmount,
        referenceNote: mobileRefNote.trim() || undefined,
      },
    ] : [];

    submitSale(mobilePayments);
  };

  // Customer Creation with Pre-flight Field Validation
  const handleCreateCustomerSubmit = async (e: React.FormEvent, source: 'mobile' | 'desktop') => {
    e.preventDefault();
    setNameTouched(true);
    setPhoneTouched(true);

    const validation = validateCustomerInput(newCustName, newCustPhone);
    if (!validation.isValid) {
      setCreateCustomerError(validation.nameError || validation.phoneError || 'Please fix the errors above.');
      return;
    }

    setIsCreatingCustomer(true);
    setCreateCustomerError('');

    try {
      const cleanPhoneDigits = newCustPhone.trim().replace(/[\s-]/g, '').replace(/^\+91|^0/, '');
      const formattedPhone = cleanPhoneDigits ? cleanPhoneDigits : undefined;

      const res = await createCustomerFn({
        data: {
          name: newCustName.trim(),
          phone: formattedPhone,
        },
      });

      const newCust = {
        id: res.id,
        name: newCustName.trim(),
        phone: formattedPhone || null,
        receivableBalance: 0,
      };

      setSelectedCustomer(newCust);
      setIsCustomerModalOpen(false);
      setIsCustomerCreating(false);
      setNewCustName('');
      setNewCustPhone('');
      setCustomerSearch('');
      setNameTouched(false);
      setPhoneTouched(false);

      queryClient.invalidateQueries({ queryKey: ['pos-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });

      if (source === 'mobile') {
        setMobileStep(2);
      }
    } catch (err: any) {
      setCreateCustomerError(err?.message || 'Failed to create customer on server.');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  // Trigger Create Customer flow with prefilled phone number from search
  const triggerCreateCustomerWithPhone = (prefill: string) => {
    const isDigits = /^\+?[0-9\s-]+$/.test(prefill.trim());
    if (isDigits) {
      const cleanDigits = prefill.replace(/[^0-9]/g, '').slice(-10);
      setNewCustPhone(cleanDigits);
      setNewCustName('');
    } else {
      setNewCustName(prefill.trim());
      setNewCustPhone('');
    }
    setNameTouched(false);
    setPhoneTouched(false);
    setCreateCustomerError('');
    setIsCustomerCreating(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 max-w-full">
      {/* ========================================================================= */}
      {/* MOBILE 4-STEP PROGRESS BAR (Only on mobile < md)                          */}
      {/* ========================================================================= */}
      <div className="md:hidden bg-white border-b border-slate-200 px-2 py-2 shadow-xs mb-3 -mx-3 -mt-3 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-1 text-[11px]">
          {/* Step 1: Customer */}
          <button
            type="button"
            onClick={() => setMobileStep(1)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-semibold transition-all ${
              mobileStep === 1
                ? 'bg-brand-600 text-white shadow-xs'
                : selectedCustomer || mobileStep > 1
                ? 'bg-slate-100 text-slate-700'
                : 'text-slate-400'
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
              mobileStep === 1 ? 'bg-white text-brand-700 font-bold' : selectedCustomer || mobileStep > 1 ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600'
            }`}>
              {selectedCustomer || mobileStep > 1 ? '✓' : '1'}
            </span>
            <span className="truncate max-w-[55px]">{selectedCustomer ? selectedCustomer.name : 'Customer'}</span>
          </button>

          <span className="text-slate-300 text-[10px]">›</span>

          {/* Step 2: Items */}
          <button
            type="button"
            onClick={() => setMobileStep(2)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-semibold transition-all ${
              mobileStep === 2
                ? 'bg-brand-600 text-white shadow-xs'
                : cart.length > 0
                ? 'bg-slate-100 text-slate-700'
                : 'text-slate-400'
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
              mobileStep === 2 ? 'bg-white text-brand-700 font-bold' : cart.length > 0 && mobileStep > 2 ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600'
            }`}>
              {cart.length > 0 && mobileStep > 2 ? '✓' : '2'}
            </span>
            <span>Items {cart.length > 0 ? `(${cart.length})` : ''}</span>
          </button>

          <span className="text-slate-300 text-[10px]">›</span>

          {/* Step 3: Bill Review */}
          <button
            type="button"
            onClick={() => { if (cart.length > 0) setMobileStep(3); }}
            disabled={cart.length === 0}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-semibold transition-all ${
              mobileStep === 3
                ? 'bg-brand-600 text-white shadow-xs'
                : cart.length > 0 && mobileStep > 3
                ? 'bg-slate-100 text-slate-700'
                : 'text-slate-300 opacity-60'
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
              mobileStep === 3 ? 'bg-white text-brand-700 font-bold' : mobileStep > 3 ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600'
            }`}>
              {mobileStep > 3 ? '✓' : '3'}
            </span>
            <span>Bill</span>
          </button>

          <span className="text-slate-300 text-[10px]">›</span>

          {/* Step 4: Pay */}
          <button
            type="button"
            onClick={() => { if (cart.length > 0) setMobileStep(4); }}
            disabled={cart.length === 0}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-semibold transition-all ${
              mobileStep === 4
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-300 opacity-60'
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
              mobileStep === 4 ? 'bg-white text-brand-700 font-bold' : 'bg-slate-300 text-slate-600'
            }`}>
              4
            </span>
            <span>Pay</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE STEP 1: SMART PHONE-FIRST CUSTOMER LOOKUP & CREATE                 */}
      {/* ========================================================================= */}
      <div className={`md:hidden flex-1 flex-col space-y-4 pb-16 pt-2 ${mobileStep === 1 ? 'flex' : 'hidden'}`}>
        {selectedCustomer && (
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                ✓
              </div>
              <div>
                <div className="text-[11px] text-emerald-800 font-medium">Selected Customer:</div>
                <div className="text-sm font-bold text-slate-900">{selectedCustomer.name}</div>
                {selectedCustomer.phone && <div className="text-xs text-slate-500">{selectedCustomer.phone}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs h-8 bg-white" onClick={() => setSelectedCustomer(null)}>
                Change
              </Button>
              <Button size="sm" className="text-xs h-8 font-bold" onClick={() => setMobileStep(2)}>
                Next ➔
              </Button>
            </div>
          </div>
        )}

        {/* Walk-in Guest Card */}
        <div className="relative pt-0.5">
          <button
            type="button"
            onClick={() => {
              setSelectedCustomer(null);
              setMobileStep(2);
            }}
            className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer shadow-xs ${
              !selectedCustomer
                ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-400'
                : 'border-slate-200 bg-white hover:border-brand-300'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span>Walk-in Customer (Guest)</span>
                  {!selectedCustomer && (
                    <span className="text-[10px] bg-brand-600 text-white px-2 py-0.5 rounded-full font-bold">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fast 1-tap checkout without customer records (Cash, UPI, Card)
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-brand-600 shrink-0 ml-2" />
          </button>
        </div>

        {/* Smart Phone-First Lookup & Inline Creation */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-brand-600" /> Customer Phone Search
            </span>
            <span className="text-[11px] text-slate-400">Type phone number</span>
          </div>

          {!isCustomerCreating ? (
            <>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter 10-digit phone number or name..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50 focus:bg-white"
                />
                {customerSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Matching Customers or Instant Create Button */}
              <div className="space-y-2">
                {isCustomerListLoading ? (
                  <div className="p-4 text-center text-xs text-slate-400">Searching customers...</div>
                ) : filteredCustomerList.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {filteredCustomerList.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone, receivableBalance: c.receivableBalance });
                          setMobileStep(2);
                        }}
                        className="w-full p-2.5 text-left text-xs hover:bg-brand-50 flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-900 group-hover:text-brand-700 truncate">{c.name}</div>
                          {c.phone && <div className="text-[11px] text-slate-400 font-mono">{c.phone}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-slate-400">Balance</div>
                          <div className={`font-bold text-xs ${c.receivableBalance > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                            {formatINR(c.receivableBalance || 0)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : customerSearch.trim() ? (
                  <div className="p-3.5 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 text-center space-y-2">
                    <p className="text-xs text-slate-600">
                      No customer found with <strong className="text-slate-900 font-bold">"{customerSearch.trim()}"</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => triggerCreateCustomerWithPhone(customerSearch)}
                      className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>
                        + Register Customer {/^[0-9\s-]+$/.test(customerSearch.trim()) ? `(${customerSearch.trim()})` : ''}
                      </span>
                    </button>
                  </div>
                ) : null}

                {/* Direct Register button if not searching or wants to add someone else */}
                {!customerSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustPhone('');
                      setNewCustName('');
                      setIsCustomerCreating(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-brand-300 text-brand-600 bg-brand-50/30 hover:bg-brand-50 flex items-center justify-center gap-2 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Register New Customer</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Creation Form with Prefilled Phone */
            <form onSubmit={(e) => handleCreateCustomerSubmit(e, 'mobile')} className="space-y-3 pt-1">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-brand-600" /> New Customer Registration
                </span>
                <button
                  type="button"
                  onClick={() => setIsCustomerCreating(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  Back
                </button>
              </div>

              {createCustomerError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{createCustomerError}</span>
                </div>
              )}

              {/* Phone Field (Prefilled from search!) */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                  Mobile Number (10 digits)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    value={newCustPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9+]/g, '');
                      setNewCustPhone(val);
                      setPhoneTouched(true);
                    }}
                    onBlur={() => setPhoneTouched(true)}
                    className={`w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 ${
                      phoneTouched && customerValidation.phoneError
                        ? 'border-rose-300 bg-rose-50/30 focus:ring-rose-400'
                        : newCustPhone.trim() && !customerValidation.phoneError
                        ? 'border-emerald-300 bg-emerald-50/20 focus:ring-emerald-400'
                        : 'border-slate-300 focus:ring-brand-500'
                    }`}
                  />
                  {newCustPhone.trim() && !customerValidation.phoneError && (
                    <Check className="w-4 h-4 text-emerald-600 absolute right-2.5 top-2.5 pointer-events-none" />
                  )}
                </div>
                {phoneTouched && customerValidation.phoneError && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{customerValidation.phoneError}</span>
                  </p>
                )}
              </div>

              {/* Name Field with Auto-Focus */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                  Customer Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  onBlur={() => setNameTouched(true)}
                  required
                  autoFocus
                  className={`w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 ${
                    nameTouched && customerValidation.nameError
                      ? 'border-rose-300 bg-rose-50/30 focus:ring-rose-400'
                      : 'border-slate-300 focus:ring-brand-500'
                  }`}
                />
                {nameTouched && customerValidation.nameError && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{customerValidation.nameError}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setIsCustomerCreating(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isCreatingCustomer}
                  disabled={!customerValidation.isValid}
                  className="flex-1 text-xs font-bold"
                >
                  Save & Continue ➔
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE STEP 2: SELECT ITEMS FROM INVENTORY (With In-Card Steppers)        */}
      {/* ========================================================================= */}
      <div className={`md:hidden flex-1 flex-col pb-28 ${mobileStep === 2 ? 'flex' : 'hidden'}`}>
        <div className="flex items-center justify-between bg-slate-100/80 px-3 py-2 rounded-xl mb-3 border border-slate-200/60">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-4 h-4 text-brand-600 shrink-0" />
            <div className="text-xs truncate">
              <span className="text-slate-500">Billing: </span>
              <strong className="text-slate-900 font-bold">
                {selectedCustomer ? selectedCustomer.name : 'Walk-in Guest'}
              </strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileStep(1)}
            className="text-[11px] font-bold text-brand-600 hover:text-brand-800 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs shrink-0"
          >
            Change
          </button>
        </div>

        <div className="space-y-2 mb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-14 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-500 font-medium">
              {displayedCatalog.length} products available
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>In-stock only</span>
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isCatalogLoading && posCatalog.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading catalog...</div>
          ) : displayedCatalog.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 p-4 border border-dashed border-slate-200 rounded-xl bg-white">
              No products found matching filters.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {(searchQuery.trim() ? searchResults : displayedCatalog).map((product) => {
                const stock = parseCleanQuantity(product.stockQuantity);
                const isOut = stock <= 0;
                const cartItem = getCartItem(product.id);
                const inCart = !!cartItem;

                return (
                  <div
                    key={product.id}
                    className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden bg-white shadow-2xs ${
                      inCart ? 'border-brand-500 ring-2 ring-brand-400/40 bg-brand-50/15' : 'border-slate-200'
                    }`}
                  >
                    <div className="p-2.5 pb-2">
                      <div className="flex items-start gap-2 mb-1.5">
                        {product.imageUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: product.imageUrl,
                                title: product.name,
                                subtitle: `${product.sku} • Stock: ${formatQuantity(stock)} ${product.unit}`,
                              })
                            }
                            className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0"
                          >
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 line-clamp-2 leading-tight">
                            {product.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{product.sku}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="font-extrabold text-sm text-brand-700">
                          {formatINR(product.sellingPrice)}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isOut ? 'text-rose-700 bg-rose-50' : 'text-slate-500 bg-slate-100'}`}>
                          {isOut ? 'Out of stock' : `${formatQuantity(stock)} left`}
                        </span>
                      </div>
                    </div>

                    <div className="p-1.5 bg-slate-50/80 border-t border-slate-100">
                      {isOut ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-1.5 text-center text-[11px] font-medium text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed"
                        >
                          Out of stock
                        </button>
                      ) : !inCart ? (
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 active:scale-98 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Bill</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-1 bg-white p-0.5 rounded-lg border border-brand-300 shadow-inner">
                          <button
                            type="button"
                            onClick={() => decrementCartItem(product.id)}
                            className="w-8 h-7 rounded-md bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700 font-bold transition-all cursor-pointer"
                            title="Decrease"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openQuantityPopup(product)}
                            className="flex-1 h-7 text-center font-extrabold text-xs text-brand-700 hover:bg-brand-50 rounded flex items-center justify-center cursor-pointer transition-colors"
                            title="Tap to type exact quantity"
                          >
                            <span>{cartItem.quantity} {product.unit}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            className="w-8 h-7 rounded-md bg-brand-600 hover:bg-brand-700 active:scale-95 flex items-center justify-center text-white font-bold transition-all cursor-pointer"
                            title="Increase"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* STICKY BOTTOM BAR ON MOBILE STEP 2 */}
        <div className="fixed bottom-16 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl z-30 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsCartDrawerOpen(true)}
            className="flex items-center gap-2 text-left cursor-pointer flex-1 min-w-0"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0 font-bold text-xs relative">
              <ShoppingBag className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500 font-medium">
                {cart.length === 0 ? 'Cart is empty' : `${totalCartUnits} units • Tap to review`}
              </div>
              <div className="text-sm font-extrabold text-slate-900 truncate">
                {formatINR(itemsSubtotal)}
              </div>
            </div>
          </button>

          <Button
            size="lg"
            onClick={() => setMobileStep(3)}
            disabled={cart.length === 0}
            className="font-bold text-sm px-5 h-11 shadow-md bg-brand-600 hover:bg-brand-700 shrink-0"
          >
            <span>Next: Bill ➔</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE STEP 3: BILL SUMMARY & CHARGES                                     */}
      {/* ========================================================================= */}
      <div className={`md:hidden flex-1 flex-col space-y-4 pb-24 ${mobileStep === 3 ? 'flex' : 'hidden'}`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileStep(2)}
            className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Items
          </button>
          <span className="text-xs font-bold text-slate-700">Step 3 of 4: Bill Summary</span>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-brand-600" />
            <div>
              <span className="text-slate-400">Bill For: </span>
              <strong className="text-slate-900">{selectedCustomer ? selectedCustomer.name : 'Walk-in Guest'}</strong>
              {selectedCustomer?.phone && <span className="text-slate-400 ml-1">({selectedCustomer.phone})</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileStep(1)}
            className="text-[11px] font-bold text-brand-600 hover:underline"
          >
            Change
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-brand-600" /> Items in Bill ({cart.length})
            </span>
            <span className="text-slate-900 font-extrabold">{formatINR(itemsSubtotal)}</span>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center justify-between py-2 px-1 text-xs">
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {item.quantity} {item.unit} × {formatINR(item.unitPrice)}
                  </div>
                </div>
                <div className="font-bold text-slate-900 shrink-0">{formatINR(item.lineTotal)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Other Charges & Discount */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-brand-600" /> Additional Charges
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsChargeModalOpen(true)}
              className="text-xs h-7"
            >
              <Plus className="w-3 h-3" /> Add Charge
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setNewChargeType('labour');
                setNewChargeDesc('Labour / Service');
                setNewChargeAmountINR('100');
                setIsChargeModalOpen(true);
              }}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 transition-colors"
            >
              + Labour
            </button>
            <button
              type="button"
              onClick={() => {
                setNewChargeType('delivery');
                setNewChargeDesc('Delivery Charge');
                setNewChargeAmountINR('50');
                setIsChargeModalOpen(true);
              }}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 transition-colors"
            >
              + Delivery
            </button>
            <button
              type="button"
              onClick={() => {
                setNewChargeType('service');
                setNewChargeDesc('Installation / Fitting');
                setNewChargeAmountINR('150');
                setIsChargeModalOpen(true);
              }}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 transition-colors"
            >
              + Installation
            </button>
          </div>

          {charges.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {charges.map((charge, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg border border-teal-100 bg-teal-50/50 text-xs"
                >
                  <span className="text-teal-900 font-semibold">{charge.description}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-teal-900">{formatINR(charge.amount)}</span>
                    <button
                      type="button"
                      onClick={() => removeCharge(idx)}
                      className="text-teal-500 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" /> Bill Discount (₹):
            </span>
            <input
              type="number"
              value={billDiscountINR}
              onChange={(e) => setBillDiscountINR(e.target.value)}
              placeholder="0"
              className="w-24 text-right px-2 py-1 rounded border border-slate-300 font-bold text-xs"
            />
          </div>
        </div>

        {/* Clean Distinct Final Bill Total Card */}
        <div className="rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-brand-50/60 to-white p-4 space-y-2 shadow-sm">
          <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wider">
            Bill Total Summary
          </div>
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Items Total:</span>
              <span>{formatINR(itemsSubtotal)}</span>
            </div>
            {chargesTotal > 0 && (
              <div className="flex justify-between">
                <span>Charges:</span>
                <span>+{formatINR(chargesTotal)}</span>
              </div>
            )}
            {billDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Discount:</span>
                <span>-{formatINR(billDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-brand-200">
              <span className="text-sm font-extrabold text-slate-900">Total Bill to Collect:</span>
              <span className="text-xl font-black text-brand-700">{formatINR(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="fixed bottom-16 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl z-30">
          <Button
            size="lg"
            onClick={() => {
              setCheckoutError('');
              setMobileStep(4);
            }}
            disabled={cart.length === 0}
            className="w-full h-12 text-base font-bold shadow-md bg-brand-600 hover:bg-brand-700"
          >
            <span>Proceed to Payment ({formatINR(grandTotal)}) ➔</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE STEP 4: CUSTOMER PAYMENT & AMOUNT RECEIVED ENTRY                   */}
      {/* ========================================================================= */}
      <div className={`md:hidden flex-1 flex-col space-y-4 pb-20 ${mobileStep === 4 ? 'flex' : 'hidden'}`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileStep(3)}
            className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Bill
          </button>
          <span className="text-xs font-bold text-slate-700">Step 4 of 4: Collect Payment</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-semibold uppercase block">Bill Amount to Collect</span>
            <span className="text-xl font-black text-slate-900">{formatINR(grandTotal)}</span>
          </div>
          <div className="text-right text-xs">
            <span className="text-slate-400 block">Customer:</span>
            <strong className="text-slate-800">{selectedCustomer ? selectedCustomer.name : 'Walk-in Guest'}</strong>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-xs">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Payment Mode
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['CASH', 'UPI', 'CARD', 'OTHER'] as PaymentMethod[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setMobilePaymentMethod(mode);
                  setCheckoutError('');
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mobilePaymentMethod === mode
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-brand-600" />
              {mobilePaymentMethod === 'CASH' ? 'Cash Received from Customer (₹)' : 'Amount Paid by Customer (₹)'}
            </label>
          </div>

          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Enter amount (or tap shortcut below)"
              value={mobileAmountReceivedINR}
              onChange={(e) => setMobileAmountReceivedINR(e.target.value)}
              autoFocus
              className="w-full text-center text-2xl font-black py-2.5 rounded-xl border-2 border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50 text-slate-900"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setMobileAmountReceivedINR(paiseToINR(grandTotal).toString())}
              className="flex-1 py-1.5 rounded-lg border border-brand-300 bg-brand-50 text-brand-700 text-xs font-bold hover:bg-brand-100 transition-colors"
            >
              Exact ({formatINR(grandTotal)})
            </button>
            {[100, 200, 500, 1000, 2000].filter(n => n >= paiseToINR(grandTotal) || n === 500).slice(0, 3).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setMobileAmountReceivedINR(String(val))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                ₹{val}
              </button>
            ))}
          </div>

          {mobileAmountReceivedINR.trim() !== '' && (
            <div className="pt-2">
              {mobileReceivedPaise >= grandTotal ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="flex justify-between items-center text-sm font-bold text-emerald-800">
                    <span>Change Due to Return:</span>
                    <span className="text-xl font-black text-emerald-950">
                      {formatINR(mobileChangeDue)}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Return {formatINR(mobileChangeDue)} change to customer.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex justify-between items-center text-sm font-bold text-amber-800">
                    <span>Remaining Unpaid (Credit / Khata):</span>
                    <span className="text-lg font-black text-amber-950">
                      {formatINR(mobileUnpaidBalance)}
                    </span>
                  </div>
                  {!selectedCustomer && (
                    <p className="text-[11px] text-rose-600 font-semibold">
                      ⚠️ Walk-in guests cannot have unpaid balance. Please select a customer.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {mobilePaymentMethod !== 'CASH' && (
            <div>
              <input
                type="text"
                placeholder="UPI Ref ID / Card Auth Code (Optional)"
                value={mobileRefNote}
                onChange={(e) => setMobileRefNote(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          )}
        </div>

        {checkoutError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{checkoutError}</span>
          </div>
        )}

        <Button
          onClick={handleFinalizeBillMobile}
          isLoading={isSubmitting}
          className="w-full h-12 text-base font-extrabold shadow-md bg-brand-600 hover:bg-brand-700"
        >
          ⚡ Complete Sale & Generate Slip
        </Button>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP SPLIT VIEW (Compact Grid - No vertical stretch with 1 item!)       */}
      {/* ========================================================================= */}
      <div className="hidden md:flex flex-1 flex-row gap-4 h-full min-w-0">
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

          {searchQuery.trim() && searchResults.length === 0 && !isServerSearching && (
            <div className="mb-4 p-4 rounded-lg border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
              No active products found matching "{searchQuery}".
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="block mx-auto mt-2 text-brand-600 font-semibold hover:underline"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Search Results Dropdown / List */}
          {searchQuery.trim() && searchResults.length > 0 && (
            <div className="mb-3 max-h-80 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white shadow-md z-20">
              {searchResults.map((product) => {
                const stock = Math.round(parseFloat(product.stockQuantity) || 0);
                const isOut = stock <= 0;

                return (
                  <div
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => addToCart(product)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        addToCart(product);
                      }
                    }}
                    className="w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-brand-50 transition-colors cursor-pointer"
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
                          <span className={isOut ? 'text-rose-600 font-semibold' : ''}>
                            • Stock: {formatQuantity(product.stockQuantity)} {product.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-brand-700 shrink-0">
                      {formatINR(product.sellingPrice)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Product Catalog Grid: Fixed auto-rows-max & content-start to prevent vertical stretching */}
          {!searchQuery.trim() && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">
                  Quick Catalog ({inStockCatalog.length} items in stock)
                </span>
                <span className="text-[11px] text-slate-400">Click item to add to bill</span>
              </div>

              {isCatalogLoading && inStockCatalog.length === 0 ? (
                <div className="flex-1 items-center justify-center text-xs text-slate-400 py-12 flex">
                  Loading store catalog...
                </div>
              ) : inStockCatalog.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg text-slate-400">
                  <Barcode className="w-8 h-8 mb-2 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No in-stock products</p>
                  <p className="text-xs text-slate-400 mt-0.5">Replenish stock in Inventory or Purchases to start billing</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pr-1 auto-rows-max items-start content-start max-h-[calc(100vh-270px)]">
                  {inStockCatalog.map((product) => {
                    const stock = Math.round(parseFloat(product.stockQuantity) || 0);
                    const isOut = stock <= 0;

                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addToCart(product)}
                        className="p-2.5 rounded-xl border border-slate-200 hover:border-brand-500 hover:shadow-xs transition-all bg-white text-left flex flex-col justify-between group cursor-pointer h-auto min-h-[105px]"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          {product.imageUrl ? (
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-slate-900 truncate leading-tight group-hover:text-brand-700 transition-colors">
                              {product.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{product.sku}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
                          <span className="font-extrabold text-slate-900 text-xs">
                            {formatINR(product.sellingPrice)}
                          </span>
                          <span className={`text-[10px] font-semibold ${isOut ? 'text-rose-600' : 'text-slate-500'}`}>
                            {isOut ? 'Out of stock' : `${formatQuantity(product.stockQuantity)} left`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANE: Cart & Checkout Summary */}
        <div className="w-full md:w-[420px] lg:w-[460px] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Customer Header with Direct Popup trigger */}
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
              type="button"
              onClick={() => {
                setCustomerSearch('');
                setIsCustomerCreating(false);
                setNewCustName('');
                setNewCustPhone('');
                setNameTouched(false);
                setPhoneTouched(false);
                setCreateCustomerError('');
                setIsCustomerModalOpen(true);
              }}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
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
                      type="button"
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
                      type="button"
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
                    type="button"
                    onClick={() => removeFromCart(index)}
                    className="ml-2 p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
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
                    type="button"
                    onClick={() => removeCharge(idx)}
                    className="text-teal-400 hover:text-rose-600 p-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
              className="w-full mt-3 h-12 text-base font-bold shadow-md cursor-pointer"
            >
              Checkout {formatINR(grandTotal)}
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE SLIDE-UP CART DRAWER (Step 2 Sheet)                                */}
      {/* ========================================================================= */}
      {isCartDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-brand-600" />
                <h3 className="font-extrabold text-slate-900 text-base">Your Cart Items</h3>
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold">
                  {cart.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs text-slate-900 truncate">{item.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {formatINR(item.unitPrice)} × {item.quantity} {item.unit}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => decrementCartItem(item.productId)}
                        className="w-7 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => addToCart({ id: item.productId, stockQuantity: item.availableStock, unit: item.unit })}
                        className="w-7 h-6 flex items-center justify-center text-brand-600 hover:bg-brand-50 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="font-bold text-xs text-slate-900 w-16 text-right">
                      {formatINR(item.lineTotal)}
                    </div>

                    <button
                      type="button"
                      onClick={() => setDirectQuantity(item.productId, 0)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
              <div className="flex justify-between items-center text-sm font-bold text-slate-900">
                <span>Subtotal:</span>
                <span className="text-base text-brand-700">{formatINR(itemsSubtotal)}</span>
              </div>
              <Button
                onClick={() => {
                  setIsCartDrawerOpen(false);
                  setMobileStep(3);
                }}
                className="w-full h-11 text-sm font-bold shadow-md"
              >
                Proceed to Bill {formatINR(itemsSubtotal)} ➔
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL: DIRECT QUANTITY EDIT KEYPAD (Mobile)                         */}
      {/* ========================================================================= */}
      {qtyEditModalItem && (
        <Modal
          isOpen={true}
          onClose={() => setQtyEditModalItem(null)}
          title={`Set Quantity: ${qtyEditModalItem.name}`}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="text-xs text-slate-500 flex justify-between">
              <span>Available in Stock:</span>
              <strong className="text-slate-900">
                {formatQuantity(qtyEditModalItem.availableStock)} {qtyEditModalItem.unit}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={tempQtyInput}
                onChange={(e) => setTempQtyInput(e.target.value.replace(/[^0-9]/g, ''))}
                autoFocus
                className="w-full text-center text-2xl font-black py-2.5 rounded-xl border border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
              />
              <span className="text-xs font-semibold text-slate-500 shrink-0">
                {qtyEditModalItem.unit}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[1, 5, 10, qtyEditModalItem.availableStock].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTempQtyInput(String(Math.min(q, qtyEditModalItem.availableStock)))}
                  className="py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold hover:bg-brand-50 hover:text-brand-700"
                >
                  {idx === 3 ? `Max (${q})` : `+${q}`}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={() => {
                  setDirectQuantity(qtyEditModalItem.productId, 0);
                  setQtyEditModalItem(null);
                }}
              >
                Remove Item
              </Button>
              <Button
                className="flex-1 font-bold"
                onClick={handleSaveQuantityPopup}
              >
                Apply Quantity
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD CHARGES                                                      */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* MODAL 2: SMART PHONE-FIRST CUSTOMER POPUP (Desktop & Shared Modal)        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => {
          setIsCustomerModalOpen(false);
          setIsCustomerCreating(false);
        }}
        title={isCustomerCreating ? 'Create New Customer' : 'Associate Customer'}
        description={
          isCustomerCreating
            ? 'Fill in customer details to register and link to this sale.'
            : 'Enter customer phone number to search or quickly register a new customer.'
        }
      >
        <div className="space-y-4">
          {!isCustomerCreating ? (
            /* PHONE-FIRST SMART SEARCH VIEW */
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
                  Customer Phone Number or Name
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Type 10-digit mobile number or customer name..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs bg-slate-50 focus:bg-white"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Walk-in Guest quick selector */}
              {!customerSearch.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setIsCustomerModalOpen(false);
                  }}
                  className="w-full p-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    Walk-in Guest (No Customer Record)
                  </span>
                  {!selectedCustomer && <Badge variant="neutral">Active</Badge>}
                </button>
              )}

              {/* SEARCH RESULTS or CREATE BUTTON */}
              {isCustomerListLoading ? (
                <div className="p-4 text-center text-xs text-slate-400">Searching customers...</div>
              ) : filteredCustomerList.length > 0 ? (
                <div className="space-y-2">
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {filteredCustomerList.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone, receivableBalance: c.receivableBalance });
                          setIsCustomerModalOpen(false);
                        }}
                        className="w-full p-2.5 text-left text-xs hover:bg-brand-50 flex items-center justify-between cursor-pointer group"
                      >
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-brand-700">{c.name}</div>
                          {c.phone && <div className="text-[11px] text-slate-500 font-mono">{c.phone}</div>}
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">Due Balance</div>
                          <div className={`font-semibold text-xs ${c.receivableBalance > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                            {formatINR(c.receivableBalance || 0)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Option to create new anyway */}
                  {customerSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => triggerCreateCustomerWithPhone(customerSearch)}
                      className="w-full py-2 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg border border-dashed border-brand-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create new customer with this number instead</span>
                    </button>
                  )}
                </div>
              ) : customerSearch.trim() ? (
                /* NO CUSTOMER FOUND -> PROMINENT CREATE BUTTON WITH PREFILLED PHONE NO */
                <div className="p-4 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 text-center space-y-2.5">
                  <p className="text-xs text-slate-600">
                    No registered customer found with <strong className="text-slate-900 font-bold">"{customerSearch.trim()}"</strong>
                  </p>
                  <Button
                    type="button"
                    onClick={() => triggerCreateCustomerWithPhone(customerSearch)}
                    className="w-full font-bold text-xs py-2 shadow-xs bg-brand-600 hover:bg-brand-700"
                  >
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    <span>
                      + Create Customer {/^[0-9\s-]+$/.test(customerSearch.trim()) ? `with Phone "${customerSearch.trim()}"` : ''}
                    </span>
                  </Button>
                </div>
              ) : (
                /* Empty state with direct create option */
                <button
                  type="button"
                  onClick={() => {
                    setNewCustPhone('');
                    setNewCustName('');
                    setIsCustomerCreating(true);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-brand-300 text-brand-600 bg-brand-50/30 hover:bg-brand-50 flex items-center justify-center gap-2 text-xs font-bold transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Create New Customer from Scratch</span>
                </button>
              )}
            </div>
          ) : (
            /* CREATE CUSTOMER FORM (PREFILLED PHONE NO) */
            <form onSubmit={(e) => handleCreateCustomerSubmit(e, 'desktop')} className="space-y-3.5">
              {createCustomerError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{createCustomerError}</span>
                </div>
              )}

              {/* Phone Field (Prefilled from search!) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Mobile Number (10 digits)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile (e.g. 9876543210)"
                    value={newCustPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9+]/g, '');
                      setNewCustPhone(val);
                      setPhoneTouched(true);
                    }}
                    onBlur={() => setPhoneTouched(true)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 ${
                      phoneTouched && customerValidation.phoneError
                        ? 'border-rose-300 bg-rose-50/20 focus:ring-rose-400'
                        : newCustPhone.trim() && !customerValidation.phoneError
                        ? 'border-emerald-300 bg-emerald-50/20 focus:ring-emerald-400'
                        : 'border-slate-300 focus:ring-brand-500'
                    }`}
                  />
                  {newCustPhone.trim() && !customerValidation.phoneError && (
                    <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-2.5 pointer-events-none" />
                  )}
                </div>
                {phoneTouched && customerValidation.phoneError && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{customerValidation.phoneError}</span>
                  </p>
                )}
              </div>

              {/* Name Field (Autofocused for immediate entry) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Customer Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Patel"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  onBlur={() => setNameTouched(true)}
                  required
                  autoFocus
                  className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 ${
                    nameTouched && customerValidation.nameError
                      ? 'border-rose-300 bg-rose-50/20 focus:ring-rose-400'
                      : 'border-slate-300 focus:ring-brand-500'
                  }`}
                />
                {nameTouched && customerValidation.nameError && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{customerValidation.nameError}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCustomerCreating(false)}
                >
                  Back to Search
                </Button>
                <Button
                  type="submit"
                  isLoading={isCreatingCustomer}
                  disabled={!customerValidation.isValid}
                  className="flex-1 font-bold"
                >
                  Save & Select Customer
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: CHECKOUT & PAYMENT MODAL (Desktop Checkout)                      */}
      {/* ========================================================================= */}
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
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="underline font-bold text-amber-900 cursor-pointer"
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
                    <button
                      type="button"
                      onClick={() => removePaymentEntry(idx)}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
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
              onClick={handleFinalizeBillDesktop}
              isLoading={isSubmitting}
              className="w-full h-12 text-base font-bold shadow-md cursor-pointer"
            >
              Complete Sale & Record Bill
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: THERMAL RECEIPT SLIP MODAL                                       */}
      {/* ========================================================================= */}
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
