import React, { useState } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { createProductFn } from '../../../../features/inventory/server';
import { inrToPaise } from '../../../../lib/currency';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Card } from '../../../../components/ui/card';
import { ImageUpload } from '../../../../components/ui/image-upload';

export const Route = createFileRoute('/_auth/inventory/new')({
  component: NewProductComponent,
});

function NewProductComponent() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [sellingPriceINR, setSellingPriceINR] = useState('');
  const [purchasePriceINR, setPurchasePriceINR] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [initialStock, setInitialStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [category, setCategory] = useState('');
  const [barcode, setBarcode] = useState('');
  const [features, setFeatures] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sellingPrice = inrToPaise(sellingPriceINR);
    if (sellingPrice <= 0) {
      setError('Selling price is required and must be greater than 0');
      return;
    }

    const purchasePrice = purchasePriceINR ? inrToPaise(purchasePriceINR) : 0;
    const stockQty = parseFloat(initialStock) || 0;
    const threshold = lowStockThreshold.trim() ? parseFloat(lowStockThreshold) : null;

    setError('');
    setLoading(true);

    try {
      await createProductFn({
        data: {
          name: name.trim(),
          sellingPrice,
          purchasePrice,
          unit: unit.trim() || 'unit',
          initialStock: stockQty,
          lowStockThreshold: threshold,
          category: category.trim() || undefined,
          barcode: barcode.trim() || undefined,
          features: features.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        },
      });

      navigate({ to: '/inventory' });
    } catch (err: any) {
      setError(err?.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/inventory" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Add New Product</h2>
          <p className="text-xs text-slate-500">
            SKU will be generated automatically and sequentially (e.g. RAJ-000001)
          </p>
        </div>
      </div>

      <Card>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Product / Item Name *"
            placeholder="e.g. Havells 1.5 sq mm Copper Wire"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Selling Price (₹) *"
              type="number"
              step="0.01"
              placeholder="e.g. 450.00"
              value={sellingPriceINR}
              onChange={(e) => setSellingPriceINR(e.target.value)}
              helperText="Counter sales price"
              required
            />

            <Input
              label="Purchase / Cost Price (₹)"
              type="number"
              step="0.01"
              placeholder="e.g. 380.00"
              value={purchasePriceINR}
              onChange={(e) => setPurchasePriceINR(e.target.value)}
              helperText="Cost price for profit calculation"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Unit of Measurement"
              placeholder="e.g. pcs, kg, mtr, box"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
            />

            <Input
              label="Initial Stock Quantity"
              type="number"
              step="0.001"
              placeholder="0"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
            />

            <Input
              label="Low Stock Alert (Optional)"
              type="number"
              step="0.001"
              placeholder="Leave empty for none"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              helperText="Alert when stock falls to this"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Category (Optional)"
              placeholder="e.g. Wires, Plumbing, Batteries"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />

            <Input
              label="Barcode / EAN (Optional)"
              placeholder="Scan or enter barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
            />
          </div>

          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            label="Product Photo"
          />

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Features & Specifications (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 90 meters length, Red color, FR grade"
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Link to="/inventory">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" isLoading={loading}>
              <PackagePlus className="w-4 h-4" /> Save Product & Assign SKU
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
