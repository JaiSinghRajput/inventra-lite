import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, AlertTriangle, ArrowUpDown, SlidersHorizontal, Package, Eye, RefreshCw } from 'lucide-react';
import { listProductsFn, adjustStockFn } from '../../../../features/inventory/server';
import { formatINR, paiseToINR } from '../../../../lib/currency';
import { formatQuantity } from '../../../../lib/quantity';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { ImageModal } from '../../../../components/ui/image-modal';
import { StockAdjustmentModal } from '../../../../components/inventory/stock-adjustment-modal';
import { EmptyState } from '../../../../components/feedback/empty-state';
import { SkeletonTable } from '../../../../components/feedback/skeleton-table';

export const Route = createFileRoute('/_auth/inventory/')({
  loader: async () => {
    try {
      return await listProductsFn({ data: {} });
    } catch {
      return [];
    }
  },
  component: InventoryListComponent,
});

function InventoryListComponent() {
  const initialProducts = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Stock Adjustment Modal
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  const {
    data: products = initialProducts,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['inventory', { search: search.trim() || undefined, lowStockOnly: lowStockOnly || undefined }],
    queryFn: () =>
      listProductsFn({
        data: {
          search: search.trim() || undefined,
          lowStockOnly: lowStockOnly ? true : undefined,
        },
      }),
    initialData: !search.trim() && !lowStockOnly ? initialProducts : undefined,
    staleTime: 30000,
  });

  const handleAdjustConfirm = async (productId: string, delta: number, reason: string) => {
    if (isAdjusting) return;
    setIsAdjusting(true);
    try {
      await adjustStockFn({
        data: {
          productId,
          delta,
          reason,
        },
      });
      setSelectedProduct(null);
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
    } catch (err: any) {
      console.error('[AdjustStockError]', err);
      alert(err?.message || 'Failed to adjust stock. Please try again.');
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
          Low / Out of Stock
        </button>
      </div>

      {isError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700">
          <span>Failed to load inventory items.</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100">
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      )}

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
                  const stock = Math.round(parseFloat(p.stockQuantity) || 0);
                  const threshold = p.lowStockThreshold ? Math.round(parseFloat(p.lowStockThreshold)) : null;
                  const isOutOfStock = p.status === 'active' && stock <= 0;
                  const isLow = (threshold !== null && stock <= threshold) || isOutOfStock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage({ url: p.imageUrl!, title: p.name, subtitle: `${p.sku}${p.barcode ? ` • ${p.barcode}` : ''}` })}
                              className="group relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
                              title="Click to view full image"
                            >
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </button>
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
                          <span className={`font-extrabold ${stock <= 0 ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                            {formatQuantity(p.stockQuantity)} {p.unit}
                          </span>
                          {stock <= 0 ? (
                            <Badge variant="danger" className="text-[10px]">
                              Out of Stock
                            </Badge>
                          ) : isLow ? (
                            <Badge variant="warning" className="text-[10px]">
                              Low (≤{formatQuantity(threshold)})
                            </Badge>
                          ) : null}
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

      {/* STOCK ADJUSTMENT MODAL (DIRECT & DELTA SUPPORT) */}
      <StockAdjustmentModal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onConfirm={handleAdjustConfirm}
        isLoading={isAdjusting}
      />

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
