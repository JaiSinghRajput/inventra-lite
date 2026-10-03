import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Truck,
  Search,
  X,
  Package,
  Barcode,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { listProductsFn, createProductFn } from '../../../../features/inventory/server';
import { recordStockInFn } from '../../../../features/purchases/server';
import { inrToPaise, formatINR, paiseToINR } from '../../../../lib/currency';
import { formatQuantity } from '../../../../lib/quantity';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Card } from '../../../../components/ui/card';
import { Modal } from '../../../../components/ui/modal';

export const Route = createFileRoute('/_auth/purchases/new')({
  component: NewPurchaseComponent,
});

interface StockInLine {
  productId: string;
  name: string;
  sku?: string;
  unit?: string;
  quantity: string;
  unitCostINR: string;
}

function NewPurchaseComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [referenceInvoice, setReferenceInvoice] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<StockInLine[]>([]);

  // Searchable Product Dropdown State
  const [productSearch, setProductSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quick Add New Product Modal State
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdSellingPrice, setNewProdSellingPrice] = useState('');
  const [newProdCostPrice, setNewProdCostPrice] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('unit');
  const [newProdQuantity, setNewProdQuantity] = useState('1');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['inventory', {}],
    queryFn: () => listProductsFn({ data: {} }),
    staleTime: 30000,
  });

  // Click outside listener for custom dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products for dropdown
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        return name.includes(q) || sku.includes(q) || barcode.includes(q);
      })
      .slice(0, 25);
  }, [products, productSearch]);

  const handleSelectProduct = (prod: any) => {
    const existingIdx = lines.findIndex((l) => l.productId === prod.id);
    if (existingIdx > -1) {
      const updated = [...lines];
      const currQty = parseFloat(updated[existingIdx].quantity) || 0;
      updated[existingIdx].quantity = (currQty + 1).toString();
      setLines(updated);
      toast.success(`Incremented quantity for "${prod.name}"`);
    } else {
      setLines([
        ...lines,
        {
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          quantity: '1',
          unitCostINR: ((prod.purchasePrice || 0) / 100).toString(),
        },
      ]);
      toast.success(`Added "${prod.name}" to delivery`);
    }
    setProductSearch('');
    setIsDropdownOpen(false);
  };

  const handleOpenQuickAdd = (prefillName?: string) => {
    setNewProdName(prefillName || productSearch.trim());
    setNewProdSellingPrice('');
    setNewProdCostPrice('');
    setNewProdUnit('unit');
    setNewProdQuantity('1');
    setNewProdCategory('');
    setNewProdBarcode('');
    setQuickAddError('');
    setIsDropdownOpen(false);
    setIsQuickAddModalOpen(true);
  };

  const handleQuickCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingProduct) return;

    const name = newProdName.trim();
    if (!name) {
      setQuickAddError('Product name is required');
      return;
    }

    const sellingPricePaise = inrToPaise(newProdSellingPrice);
    if (!sellingPricePaise || sellingPricePaise <= 0) {
      setQuickAddError('Valid selling price greater than ₹0 is required');
      return;
    }

    const costPaise = inrToPaise(newProdCostPrice) || 0;
    const qty = parseFloat(newProdQuantity);
    if (isNaN(qty) || qty <= 0) {
      setQuickAddError('Please enter a valid stock-in quantity (at least 1)');
      return;
    }

    setQuickAddError('');
    setIsCreatingProduct(true);

    try {
      const res = await createProductFn({
        data: {
          name,
          sellingPrice: sellingPricePaise,
          purchasePrice: costPaise,
          unit: newProdUnit.trim() || 'unit',
          initialStock: 0,
          category: newProdCategory.trim() || undefined,
          barcode: newProdBarcode.trim() || undefined,
        },
      });

      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });

      setLines((prev) => [
        ...prev,
        {
          productId: res.id,
          name,
          sku: res.sku,
          unit: newProdUnit.trim() || 'unit',
          quantity: newProdQuantity,
          unitCostINR: newProdCostPrice || '0',
        },
      ]);

      setIsQuickAddModalOpen(false);
      setProductSearch('');
      toast.success(`Created "${name}" (${res.sku}) and added to delivery`);
    } catch (err: any) {
      setQuickAddError(err?.message || 'Failed to create product');
      toast.error(err?.message || 'Failed to create product');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const removeLine = (index: number) => {
    const item = lines[index];
    setLines(lines.filter((_, i) => i !== index));
    if (item) {
      toast.info(`Removed "${item.name}"`);
    }
  };

  const updateLine = (index: number, field: keyof StockInLine, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const totalPaise = lines.reduce((sum, line) => {
    const qty = parseFloat(line.quantity) || 0;
    const cost = inrToPaise(line.unitCostINR);
    return sum + Math.round(qty * cost);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (lines.length === 0) {
      setError('Please add at least one product item to restock');
      toast.error('Please add at least one product item to restock');
      return;
    }

    for (const l of lines) {
      const qty = parseFloat(l.quantity);
      if (isNaN(qty) || qty <= 0) {
        setError(`Please enter a valid positive quantity for ${l.name}`);
        toast.error(`Please enter a valid positive quantity for ${l.name}`);
        return;
      }
    }

    setError('');
    setIsSubmitting(true);

    try {
      await recordStockInFn({
        data: {
          supplierName: supplierName.trim() || undefined,
          referenceInvoice: referenceInvoice.trim() || undefined,
          notes: notes.trim() || undefined,
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: parseFloat(l.quantity),
            unitCost: inrToPaise(l.unitCostINR),
          })),
        },
      });

      await queryClient.invalidateQueries({ queryKey: ['purchases'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });

      toast.success('Stock-in delivery recorded successfully!');
      navigate({ to: '/purchases' });
    } catch (err: any) {
      const msg = err?.message || 'Failed to record stock-in delivery';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/purchases" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Record Stock-In Delivery</h2>
          <p className="text-xs text-slate-500">Restock products, add new inventory, and record supplier invoices</p>
        </div>
      </div>

      <Card>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Supplier / Vendor Name (Optional)"
              placeholder="e.g. ABC Electrical Distributors"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />

            <Input
              label="Vendor Invoice / Challan # (Optional)"
              placeholder="e.g. SUP-2026-904"
              value={referenceInvoice}
              onChange={(e) => setReferenceInvoice(e.target.value)}
            />
          </div>

          {/* Searchable Product Dropdown Section */}
          <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5 relative" ref={dropdownRef}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-brand-600" />
                <span>Search & Add Product to Restock</span>
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenQuickAdd()}
                className="text-xs h-7 border-brand-200 text-brand-700 hover:bg-brand-50 bg-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> New Product
              </Button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 select-none pointer-events-none" />
              <input
                type="text"
                placeholder="Type product name, SKU, or scan barcode..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white shadow-2xs font-medium"
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setProductSearch('');
                    setIsDropdownOpen(false);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Dropdown Popover List */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-30 max-h-72 flex flex-col animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500 px-3">
                    <span>
                      {filteredProducts.length > 0
                        ? `Available Products (${filteredProducts.length})`
                        : 'No matching products'}
                    </span>
                    <span className="text-[10px] text-slate-400">Click item to add to delivery</span>
                  </div>

                  <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
                    {filteredProducts.map((p) => {
                      const stock = Math.round(parseFloat(p.stockQuantity) || 0);
                      const inList = lines.some((l) => l.productId === p.id);

                      return (
                        <div
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectProduct(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectProduct(p);
                            }
                          }}
                          className={`p-3 text-left flex items-center justify-between hover:bg-brand-50/70 transition-colors cursor-pointer ${
                            inList ? 'bg-brand-50/30' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-xs sm:text-sm text-slate-900 truncate flex items-center gap-1.5">
                                <span>{p.name}</span>
                                {inList && (
                                  <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-1.5 py-0.2 rounded-full">
                                    In List
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-slate-500 font-semibold">{p.sku}</span>
                                {p.barcode && (
                                  <span className="flex items-center gap-0.5 text-slate-400 font-mono">
                                    <Barcode className="w-3 h-3" /> {p.barcode}
                                  </span>
                                )}
                                <span
                                  className={`font-semibold ${
                                    stock <= 0
                                      ? 'text-rose-600'
                                      : stock <= 5
                                      ? 'text-amber-600'
                                      : 'text-emerald-600'
                                  }`}
                                >
                                  • Stock: {formatQuantity(stock)} {p.unit}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-slate-400 block">Purchase Cost</span>
                            <span className="text-xs font-bold text-slate-900">
                              {formatINR(p.purchasePrice || 0)}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {filteredProducts.length === 0 && (
                      <div className="p-5 text-center space-y-2.5">
                        <Package className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs text-slate-500">
                          No product found matching <strong className="text-slate-800">"{productSearch}"</strong>
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOpenQuickAdd(productSearch.trim())}
                          className="text-xs font-bold shadow-xs mx-auto cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add "{productSearch.trim()}" as New Product
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          {lines.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Delivery Line Items ({lines.length})</span>
                <span className="text-[11px] text-slate-400 font-normal">Edit restock qty and cost</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Product / SKU</th>
                      <th className="py-2.5 px-3 w-32">Restock Qty</th>
                      <th className="py-2.5 px-3 w-36">Unit Cost (₹)</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => (
                      <tr key={line.productId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{line.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{line.sku || 'SKU'}</span>
                            <span>•</span>
                            <span>{line.unit || 'unit'}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={line.quantity}
                              onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                            <span className="text-[10px] text-slate-400 font-medium">{line.unit || 'unit'}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs font-semibold">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unitCostINR}
                              onChange={(e) => updateLine(idx, 'unitCostINR', e.target.value)}
                              className="w-full rounded-lg border border-slate-300 pl-6 pr-2.5 py-1.5 text-xs bg-white font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                          {formatINR(Math.round((parseFloat(line.quantity) || 0) * inrToPaise(line.unitCostINR)))}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                <span>Total Delivery Value:</span>
                <span className="text-brand-700 text-base font-black">{formatINR(totalPaise)}</span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
              <Truck className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">No items added to this delivery yet</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Use the search dropdown above to select existing products or click "New Product" to add a new item with stock.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Delivery Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Received in good condition, batch #882, truck driver contact..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Link to="/purchases">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" isLoading={isSubmitting} disabled={lines.length === 0} className="font-bold">
              <Truck className="w-4 h-4 mr-1" /> Finalize Stock-In
            </Button>
          </div>
        </form>
      </Card>

      {/* QUICK ADD NEW PRODUCT MODAL */}
      <Modal
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        title="Add New Product & Restock"
        description="Create a new inventory item and automatically add it to this stock-in delivery."
        maxWidth="md"
      >
        <form onSubmit={handleQuickCreateProduct} className="p-4 sm:p-5 space-y-3.5">
          {quickAddError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{quickAddError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Copper Wire 2.5mm"
              value={newProdName}
              onChange={(e) => setNewProdName(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Selling Price (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 150.00"
                value={newProdSellingPrice}
                onChange={(e) => setNewProdSellingPrice(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Purchase / Cost Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 110.00"
                value={newProdCostPrice}
                onChange={(e) => setNewProdCostPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Restock Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                placeholder="e.g. 10"
                value={newProdQuantity}
                onChange={(e) => setNewProdQuantity(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Unit of Measure
              </label>
              <select
                value={newProdUnit}
                onChange={(e) => setNewProdUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white font-medium"
              >
                <option value="unit">unit (Default)</option>
                <option value="pcs">pcs (Pieces)</option>
                <option value="kg">kg (Kilograms)</option>
                <option value="g">g (Grams)</option>
                <option value="ltr">ltr (Liters)</option>
                <option value="ml">ml (Milliliters)</option>
                <option value="mtr">mtr (Meters)</option>
                <option value="box">box (Boxes)</option>
                <option value="pack">pack (Packs)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Category (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Cables, Fasteners"
                value={newProdCategory}
                onChange={(e) => setNewProdCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Barcode / EAN (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 8901234567890"
                value={newProdBarcode}
                onChange={(e) => setNewProdBarcode(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQuickAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isCreatingProduct}
              className="font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Create & Add to Delivery
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
