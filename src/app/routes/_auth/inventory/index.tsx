import React, { useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus, Search, Filter, AlertTriangle, ArrowUpDown, SlidersHorizontal, Package } from 'lucide-react';
import { listProductsFn, adjustStockFn } from '../../../../features/inventory/server';
import { formatINR, paiseToINR } from '../../../../lib/currency';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Modal } from '../../../../components/ui/modal';
import { EmptyState } from '../../../../components/feedback/empty-state';
import { SkeletonTable } from '../../../../components/feedback/skeleton-table';

export const Route = createFileRoute('/_auth/inventory/')({
  component: InventoryListComponent,
});

function InventoryListComponent() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Stock Adjustment Modal
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [adjustmentDelta, setAdjustmentDelta] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await listProductsFn({
        data: {
          search: search.trim() || undefined,
          lowStockOnly: lowStockOnly ? true : undefined,
        },
      });
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, lowStockOnly]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const delta = parseFloat(adjustmentDelta);
    if (isNaN(delta) || delta === 0) {
      setAdjustError('Please specify a non-zero adjustment quantity');
      return;
    }
    if (!adjustmentReason.trim()) {
      setAdjustError('Mandatory reason required for physical audit');
      return;
    }

    setAdjustError('');
    setIsAdjusting(true);

    try {
      await adjustStockFn({
        data: {
          productId: selectedProduct.id,
          delta,
          reason: adjustmentReason.trim(),
        },
      });
      setSelectedProduct(null);
      setAdjustmentDelta('');
      setAdjustmentReason('');
      loadProducts();
    } catch (err: any) {
      setAdjustError(err?.message || 'Adjustment failed');
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Inventory Items</h2>
          <p className="text-xs text-slate-500">Track stock levels, sequential SKUs, and reorder alerts</p>
        </div>
        <Link to="/inventory/new">
          <Button size="md" className="w-full sm:w-auto shadow-sm">
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </Link>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 select-none pointer-events-none" />
          <input
            type="text"
            placeholder="Search items by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>

        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
            lowStockOnly
              ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Low Stock Alerts
        </button>
      </div>

      {/* Product List Table */}
      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Create your first inventory product to begin billing and automatic SKU tracking."
          actionLabel="Add Product"
          onAction={() => (window.location.href = '/inventory/new')}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Item & SKU</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4">Stock Level</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const stock = parseFloat(p.stockQuantity);
                  const threshold = p.lowStockThreshold ? parseFloat(p.lowStockThreshold) : null;
                  const isLow = threshold !== null && stock <= threshold;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <Link to="/inventory/$id" params={{ id: p.id }} className="hover:underline font-bold text-slate-900 block">
                              {p.name}
                            </Link>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                              <span>{p.sku}</span>
                              {p.barcode && <span>• {p.barcode}</span>}
                              {p.category && <span>• {p.category}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatINR(p.sellingPrice)}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">/{p.unit}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-extrabold ${isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                            {p.stockQuantity} {p.unit}
                          </span>
                          {isLow && (
                            <Badge variant="warning" className="text-[10px]">
                              Low (≤{threshold})
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={p.status === 'active' ? 'success' : 'neutral'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedProduct(p)}
                        >
                          <SlidersHorizontal className="w-3 h-3" /> Adjust
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADJUST STOCK MODAL */}
      {selectedProduct && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedProduct(null)}
          title={`Adjust Stock: ${selectedProduct.name}`}
          description={`Current balance: ${selectedProduct.stockQuantity} ${selectedProduct.unit}. Enter physical count adjustment.`}
        >
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            {adjustError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {adjustError}
              </div>
            )}

            <div>
              <Input
                label={`Quantity Delta (+ to add, - to subtract)`}
                type="number"
                step="0.001"
                placeholder="e.g. +5 or -2"
                value={adjustmentDelta}
                onChange={(e) => setAdjustmentDelta(e.target.value)}
                required
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Enter +10 to add 10 units, or -5 to deduct 5 units for damaged/expired goods.
              </p>
            </div>

            <Input
              label="Mandatory Audit Reason"
              placeholder="e.g. Physical inventory count correction, Broken bottle"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              required
            />

            <Button type="submit" isLoading={isAdjusting} className="w-full">
              Confirm Stock Adjustment
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
