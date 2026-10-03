import React, { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  AlertTriangle,
  SlidersHorizontal,
  Package,
  Eye,
  RefreshCw,
  LayoutGrid,
  List,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { listProductsFn, adjustStockFn } from '../../../../features/inventory/server';
import { formatINR } from '../../../../lib/currency';
import { formatQuantity } from '../../../../lib/quantity';
import { Button } from '../../../../components/ui/button';
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

type StockFilterType = 'all' | 'low' | 'out' | 'in';

function InventoryListComponent() {
  const initialProducts = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('all');
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'card' : 'list'
  );

  // Stock Adjustment Modal
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  const {
    data: products = initialProducts,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => listProductsFn({ data: {} }),
    initialData: initialProducts && initialProducts.length > 0 ? initialProducts : undefined,
    staleTime: 20000,
  });

  // Calculate dynamic stock counts for filter tabs
  const counts = useMemo(() => {
    let low = 0;
    let out = 0;
    let inStock = 0;

    for (const p of products) {
      const stock = Math.round(parseFloat(p.stockQuantity) || 0);
      const threshold = p.lowStockThreshold ? Math.round(parseFloat(p.lowStockThreshold)) : null;
      const isOut = stock <= 0;
      const isLow = (threshold !== null && stock <= threshold) || isOut;

      if (isOut) out++;
      if (isLow) low++;
      if (!isOut) inStock++;
    }

    return { all: products.length, low, out, in: inStock };
  }, [products]);

  // Instant reactive client-side filter across search and stock tabs
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase().normalize('NFC');
    const tokens = q.split(/\s+/).filter(Boolean);

    return products.filter((p) => {
      const stock = Math.round(parseFloat(p.stockQuantity) || 0);
      const threshold = p.lowStockThreshold ? Math.round(parseFloat(p.lowStockThreshold)) : null;
      const isOut = stock <= 0;
      const isLow = (threshold !== null && stock <= threshold) || isOut;

      // 1. Stock Status Filter
      if (stockFilter === 'out' && !isOut) return false;
      if (stockFilter === 'low' && !isLow) return false;
      if (stockFilter === 'in' && isOut) return false;

      // 2. Multi-token text search
      if (tokens.length > 0) {
        const name = (p.name || '').toLowerCase().normalize('NFC');
        const sku = (p.sku || '').toLowerCase().normalize('NFC');
        const barcode = (p.barcode || '').toLowerCase().normalize('NFC');
        const category = (p.category || '').toLowerCase().normalize('NFC');

        const matches = tokens.every(
          (t) =>
            name.includes(t) ||
            sku.includes(t) ||
            barcode.includes(t) ||
            category.includes(t)
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [products, search, stockFilter]);

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
      await queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
      toast.success('Stock adjusted successfully');
    } catch (err: any) {
      console.error('[AdjustStockError]', err);
      toast.error(err?.message || 'Failed to adjust stock. Please try again.');
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
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          <Link to="/inventory/new">
            <Button size="md" className="w-full sm:w-auto shadow-sm">
              <Plus className="w-4 h-4 mr-1" /> Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Search & Stock Filter Tabs */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 select-none pointer-events-none" />
            <input
              type="text"
              placeholder="Search items by name, SKU, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Stock Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => setStockFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shrink-0 ${
              stockFilter === 'all'
                ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>All Items</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              stockFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStockFilter('low')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shrink-0 ${
              stockFilter === 'low'
                ? 'bg-amber-500 border-amber-600 text-white shadow-2xs'
                : 'bg-white border-slate-200 text-amber-700 hover:bg-amber-50/50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Low Stock</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              stockFilter === 'low' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {counts.low}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStockFilter('out')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shrink-0 ${
              stockFilter === 'out'
                ? 'bg-rose-600 border-rose-700 text-white shadow-2xs'
                : 'bg-white border-slate-200 text-rose-700 hover:bg-rose-50/50'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Out of Stock</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              stockFilter === 'out' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-800'
            }`}>
              {counts.out}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStockFilter('in')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shrink-0 ${
              stockFilter === 'in'
                ? 'bg-emerald-600 border-emerald-700 text-white shadow-2xs'
                : 'bg-white border-slate-200 text-emerald-700 hover:bg-emerald-50/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>In Stock</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              stockFilter === 'in' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {counts.in}
            </span>
          </button>
        </div>
      </div>

      {isError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700">
          <span>Failed to load inventory items.</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100">
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Product List Content */}
      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title={products.length === 0 ? 'No products found' : 'No matching products'}
          description={
            products.length === 0
              ? 'Create your first inventory product to begin billing and automatic SKU tracking.'
              : `No items matched "${search || stockFilter}". Try changing your filters.`
          }
          actionLabel={products.length === 0 ? 'Add Product' : 'Clear Filters'}
          onAction={() => {
            if (products.length === 0) {
              window.location.href = '/inventory/new';
            } else {
              setSearch('');
              setStockFilter('all');
            }
          }}
        />
      ) : (
        <>
          {/* CARD VIEW */}
          <div className={`${viewMode === 'list' ? 'hidden' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'}`}>
            {filteredProducts.map((p) => {
              const stock = Math.round(parseFloat(p.stockQuantity) || 0);
              const threshold = p.lowStockThreshold ? Math.round(parseFloat(p.lowStockThreshold)) : null;
              const isOutOfStock = stock <= 0;
              const isLow = (threshold !== null && stock <= threshold) || isOutOfStock;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
                >
                  {/* Top Item Summary */}
                  <div className="flex items-start gap-3">
                    {p.imageUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: p.imageUrl!,
                            title: p.name,
                            subtitle: `${p.sku}${p.barcode ? ` • ${p.barcode}` : ''}`,
                          })
                        }
                        className="group relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100 cursor-pointer"
                        title="Click to view image"
                      >
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                        <Package className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5">
                        <Link
                          to="/inventory/$id"
                          params={{ id: p.id }}
                          className="font-bold text-slate-900 text-sm truncate hover:underline"
                        >
                          {p.name}
                        </Link>
                        <Badge
                          variant={p.status === 'active' ? 'success' : 'neutral'}
                          className="text-[10px] shrink-0 font-medium"
                        >
                          {p.status}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                        <span>{p.sku}</span>
                        {p.barcode && <span>• {p.barcode}</span>}
                      </div>
                      {p.category && (
                        <span className="inline-block text-[10px] text-brand-700 bg-brand-50 px-1.5 py-0.2 rounded mt-1 font-medium">
                          {p.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price & Stock Strip */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Selling Price</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {formatINR(p.sellingPrice)}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">/{p.unit}</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Stock Level</span>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span
                          className={`font-extrabold ${
                            isOutOfStock ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800'
                          }`}
                        >
                          {formatQuantity(p.stockQuantity)} {p.unit}
                        </span>
                        {isOutOfStock ? (
                          <Badge variant="danger" className="text-[9px] py-0 px-1.5">
                            Out
                          </Badge>
                        ) : isLow ? (
                          <Badge variant="warning" className="text-[9px] py-0 px-1.5">
                            Low
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProduct(p)}
                      className="flex-1 text-xs h-8 font-medium cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3 h-3 mr-1" /> Adjust Stock
                    </Button>
                    <Link to="/inventory/$id" params={{ id: p.id }} className="flex-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs h-8 border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP / LIST VIEW */}
          <div className={`${viewMode === 'card' ? 'hidden' : 'block'} bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs`}>
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
                  {filteredProducts.map((p) => {
                    const stock = Math.round(parseFloat(p.stockQuantity) || 0);
                    const threshold = p.lowStockThreshold ? Math.round(parseFloat(p.lowStockThreshold)) : null;
                    const isOutOfStock = stock <= 0;
                    const isLow = (threshold !== null && stock <= threshold) || isOutOfStock;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    url: p.imageUrl!,
                                    title: p.name,
                                    subtitle: `${p.sku}${p.barcode ? ` • ${p.barcode}` : ''}`,
                                  })
                                }
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
                              <Link
                                to="/inventory/$id"
                                params={{ id: p.id }}
                                className="hover:underline font-bold text-slate-900 block"
                              >
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
                            <span
                              className={`font-extrabold ${
                                isOutOfStock ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800'
                              }`}
                            >
                              {formatQuantity(p.stockQuantity)} {p.unit}
                            </span>
                            {isOutOfStock ? (
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
                            className="cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3 h-3 mr-1" /> Adjust
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
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
