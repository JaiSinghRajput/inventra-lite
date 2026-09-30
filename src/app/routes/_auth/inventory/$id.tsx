import React, { useState } from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { ArrowLeft, Clock, History, Edit2, SlidersHorizontal, Trash2, Eye } from 'lucide-react';
import { getProductDetailsFn, updateProductFn, adjustStockFn, deleteProductFn } from '../../../../features/inventory/server';
import { getViewerFn } from '../../../../features/auth/server';
import { formatINR, inrToPaise, paiseToINR } from '../../../../lib/currency';
import { formatQuantity, parseCleanQuantity } from '../../../../lib/quantity';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Card } from '../../../../components/ui/card';
import { ImageModal } from '../../../../components/ui/image-modal';
import { StockAdjustmentModal } from '../../../../components/inventory/stock-adjustment-modal';
import { ImageUpload } from '../../../../components/ui/image-upload';

export const Route = createFileRoute('/_auth/inventory/$id')({
  loader: async ({ params }) => {
    const [details, viewer] = await Promise.all([
      getProductDetailsFn({ data: { id: params.id } }),
      getViewerFn(),
    ]);
    return { ...details, viewer };
  },
  component: ProductDetailComponent,
});

const COMMON_UNITS = ['pcs', 'kg', 'g', 'mtr', 'box', 'pkt', 'ltr', 'pair', 'set'];

function ProductDetailComponent() {
  const router = useRouter();
  const data = Route.useLoaderData();

  if (!data?.product) {
    return (
      <div className="p-8 text-center text-slate-500">
        Product not found. <Link to="/inventory" className="text-brand-600 underline">Return to inventory</Link>
      </div>
    );
  }

  const product = data.product;
  const movements = data.movements || [];

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [sellingPriceINR, setSellingPriceINR] = useState(paiseToINR(product.sellingPrice).toString());
  const [purchasePriceINR, setPurchasePriceINR] = useState(paiseToINR(product.purchasePrice).toString());
  const [unit, setUnit] = useState(product.unit);
  const [lowStockThreshold, setLowStockThreshold] = useState(product.lowStockThreshold ? formatQuantity(product.lowStockThreshold) : '');
  const [category, setCategory] = useState(product.category || '');
  const [barcode, setBarcode] = useState(product.barcode || '');
  const [features, setFeatures] = useState(product.features || '');
  const [imageUrl, setImageUrl] = useState(product.imageUrl || '');
  const [status, setStatus] = useState(product.status);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Stock Adjustment
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Full-screen Image Preview Modal
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setSaveError('Product name is required');
      return;
    }
    const sellingPrice = inrToPaise(sellingPriceINR);
    if (sellingPrice <= 0) {
      setSaveError('Selling price must be greater than ₹0.00');
      return;
    }

    if (lowStockThreshold.trim() && parseCleanQuantity(lowStockThreshold, true) < 0) {
      setSaveError('Low stock threshold cannot be negative');
      return;
    }

    setSaveError('');
    setIsSaving(true);

    try {
      await updateProductFn({
        data: {
          id: product.id,
          name: name.trim(),
          sellingPrice,
          purchasePrice: purchasePriceINR ? inrToPaise(purchasePriceINR) : 0,
          unit: unit.trim().toLowerCase() || 'pcs',
          lowStockThreshold: lowStockThreshold.trim() ? parseCleanQuantity(lowStockThreshold) : null,
          category: category.trim() || undefined,
          barcode: barcode.trim() || undefined,
          features: features.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          status,
        },
      });

      setIsEditing(false);
      router.invalidate();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to update product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdjustSubmit = async (productId: string, delta: number, reason: string) => {
    setIsAdjusting(true);
    try {
      await adjustStockFn({
        data: {
          productId,
          delta,
          reason,
        },
      });

      setIsAdjustModalOpen(false);
      router.invalidate();
    } finally {
      setIsAdjusting(false);
    }
  };

  const stock = parseCleanQuantity(product.stockQuantity);
  const threshold = product.lowStockThreshold ? parseCleanQuantity(product.lowStockThreshold) : null;
  const isLow = threshold !== null && stock <= threshold;
  const isOwner = data?.viewer?.user?.role === 'OWNER';

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) return;
    try {
      await deleteProductFn({ data: { id: product.id } });
      router.navigate({ to: '/inventory' });
    } catch (err: any) {
      alert(err?.message || 'Failed to delete product');
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-5">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/inventory" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          {product.imageUrl && (
            <button
              type="button"
              onClick={() => setIsImageModalOpen(true)}
              className="group relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
              title="Click to view full photo"
            >
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Eye className="w-3.5 h-3.5" />
              </div>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{product.name}</h2>
              <Badge variant="brand" className="font-mono text-xs">
                {product.sku}
              </Badge>
              <Badge variant={product.status === 'active' ? 'success' : 'neutral'}>
                {product.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>Added by <strong className="text-slate-600 font-medium">{product.createdByName || 'Store Admin'}</strong></span>
              {product.updatedByName && (
                <>
                  <span>•</span>
                  <span>Updated by <strong className="text-slate-600 font-medium">{product.updatedByName}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsAdjustModalOpen(true)}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust Stock
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
            <Edit2 className="w-3.5 h-3.5" /> {isEditing ? 'Cancel' : 'Edit Details'}
          </Button>
          {isOwner && (
            <Button variant="danger" size="sm" onClick={handleDelete} title="Delete Product (Owner Only)">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center p-3 sm:p-4">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">Physical Stock</span>
          <p className={`text-xl font-extrabold mt-1 ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>
            {formatQuantity(product.stockQuantity)} <span className="text-xs font-normal text-slate-500">{product.unit}</span>
          </p>
          {isLow && <span className="text-[10px] text-amber-600 font-bold">Low Stock Warning</span>}
        </Card>

        <Card className="text-center p-3 sm:p-4">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">Selling Price</span>
          <p className="text-xl font-extrabold text-brand-700 mt-1">{formatINR(product.sellingPrice)}</p>
        </Card>

        <Card className="text-center p-3 sm:p-4">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">Cost Price</span>
          <p className="text-xl font-extrabold text-slate-700 mt-1">{formatINR(product.purchasePrice)}</p>
        </Card>

        <Card className="text-center p-3 sm:p-4">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">Est. Gross Margin</span>
          <p className="text-xl font-extrabold text-emerald-600 mt-1">
            {formatINR(Math.max(0, product.sellingPrice - product.purchasePrice))}
          </p>
        </Card>
      </div>

      {/* EDIT FORM */}
      {isEditing && (
        <Card className="border-brand-200 bg-brand-50/20">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Edit Product Information</h3>

          {saveError && (
            <div className="mb-4 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {saveError}
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-4">
            <Input label="Product Name" value={name} onChange={(e) => setName(e.target.value)} required />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Selling Price (₹) *"
                type="number"
                step="0.01"
                value={sellingPriceINR}
                onChange={(e) => setSellingPriceINR(e.target.value)}
                required
              />
              <Input
                label="Purchase Price (₹)"
                type="number"
                step="0.01"
                value={purchasePriceINR}
                onChange={(e) => setPurchasePriceINR(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} required />
              <Input
                label="Low Stock Threshold"
                type="number"
                placeholder="None"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-brand-500"
                >
                  <option value="active">Active (Available on POS)</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <Input label="Barcode / EAN" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>

            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              label="Product Photo"
            />

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Features</label>
              <textarea
                rows={2}
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isSaving}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STOCK MOVEMENT HISTORY AUDIT TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Stock Movement Audit Ledger</h3>
          </div>
          <span className="text-xs text-slate-400">Append-only audit trail</span>
        </div>

        {movements.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No stock movements recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Delta</th>
                  <th className="py-2.5 px-4">Balance After</th>
                  <th className="py-2.5 px-4">Reason / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {movements.map((m) => {
                  const delta = parseFloat(m.quantityDelta);
                  const isPositive = delta > 0;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 text-slate-500 font-sans">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        <Badge
                          variant={
                            m.movementType === 'sale'
                              ? 'neutral'
                              : m.movementType === 'sale_reversal'
                              ? 'warning'
                              : m.movementType === 'purchase'
                              ? 'success'
                              : 'info'
                          }
                          className="text-[10px]"
                        >
                          {m.movementType}
                        </Badge>
                      </td>
                      <td className={`py-2.5 px-4 font-bold ${isPositive ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {isPositive ? `+${formatQuantity(m.quantityDelta)}` : formatQuantity(m.quantityDelta)} {product.unit}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {formatQuantity(m.balanceAfter)} {product.unit}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-sans text-xs">
                        {m.reason || m.referenceId || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* STOCK ADJUSTMENT MODAL (DIRECT & DELTA SUPPORT) */}
      <StockAdjustmentModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        product={product}
        onConfirm={handleAdjustSubmit}
        isLoading={isAdjusting}
      />

      {/* FULL-SCREEN IMAGE LIGHTBOX MODAL */}
      <ImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        imageUrl={product.imageUrl}
        title={product.name}
        subtitle={`${product.sku}${product.barcode ? ` • ${product.barcode}` : ''}`}
      />
    </div>
  );
}
