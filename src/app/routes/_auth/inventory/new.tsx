import React, { useState } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { createProductFn } from '../../../../features/inventory/server';
import { inrToPaise } from '../../../../lib/currency';
import { formatQuantity, parseCleanQuantity } from '../../../../lib/quantity';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Card } from '../../../../components/ui/card';
import { ImageUpload } from '../../../../components/ui/image-upload';

export const Route = createFileRoute('/_auth/inventory/new')({
  component: NewProductComponent,
});

const COMMON_UNITS = ['pcs', 'kg', 'g', 'mtr', 'box', 'pkt', 'ltr', 'pair', 'set'];

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

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = 'Product name is required';
    } else if (name.trim().length > 191) {
      errs.name = 'Product name cannot exceed 191 characters';
    }

    const sellingPaise = inrToPaise(sellingPriceINR);
    if (!sellingPriceINR.trim() || isNaN(parseFloat(sellingPriceINR))) {
      errs.sellingPrice = 'Selling price is required';
    } else if (sellingPaise <= 0) {
      errs.sellingPrice = 'Selling price must be greater than ₹0.00';
    }

    if (purchasePriceINR.trim()) {
      const purchasePaise = inrToPaise(purchasePriceINR);
      if (purchasePaise < 0) {
        errs.purchasePrice = 'Purchase price cannot be negative';
      }
    }

    if (!unit.trim()) {
      errs.unit = 'Unit of measurement is required';
    }

    const parsedStock = parseCleanQuantity(initialStock, true);
    if (parsedStock < 0) {
      errs.initialStock = 'Initial stock quantity cannot be negative';
    }

    if (lowStockThreshold.trim()) {
      const parsedThreshold = parseCleanQuantity(lowStockThreshold, true);
      if (parsedThreshold < 0) {
        errs.lowStockThreshold = 'Low stock alert threshold cannot be negative';
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const sellingPrice = inrToPaise(sellingPriceINR);
    const purchasePrice = purchasePriceINR ? inrToPaise(purchasePriceINR) : 0;
    const stockQty = parseCleanQuantity(initialStock);
    const threshold = lowStockThreshold.trim() ? parseCleanQuantity(lowStockThreshold) : null;

    setError('');
    setLoading(true);

    try {
      await createProductFn({
        data: {
          name: name.trim(),
          sellingPrice,
          purchasePrice,
          unit: unit.trim().toLowerCase() || 'pcs',
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

  const isSellingBelowCost =
    sellingPriceINR &&
    purchasePriceINR &&
    inrToPaise(sellingPriceINR) > 0 &&
    inrToPaise(purchasePriceINR) > inrToPaise(sellingPriceINR);

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
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
            }}
            error={fieldErrors.name}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Selling Price (₹) *"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 450.00"
              value={sellingPriceINR}
              onChange={(e) => {
                setSellingPriceINR(e.target.value);
                if (fieldErrors.sellingPrice) setFieldErrors({ ...fieldErrors, sellingPrice: '' });
              }}
              error={fieldErrors.sellingPrice}
              helperText="Counter sales price per unit"
              required
            />

            <div>
              <Input
                label="Purchase / Cost Price (₹)"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 380.00"
                value={purchasePriceINR}
                onChange={(e) => {
                  setPurchasePriceINR(e.target.value);
                  if (fieldErrors.purchasePrice) setFieldErrors({ ...fieldErrors, purchasePrice: '' });
                }}
                error={fieldErrors.purchasePrice}
                helperText="Cost price for profit calculation"
              />
              {isSellingBelowCost && (
                <p className="text-[11px] text-amber-600 font-semibold mt-1">
                  ⚠️ Note: Selling price is lower than purchase price (negative margin).
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Input
                  label="Unit of Measurement *"
                  placeholder="e.g. pcs, kg, mtr"
                  value={unit}
                  onChange={(e) => {
                    setUnit(e.target.value);
                    if (fieldErrors.unit) setFieldErrors({ ...fieldErrors, unit: '' });
                  }}
                  error={fieldErrors.unit}
                  required
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMMON_UNITS.slice(0, 5).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        unit === u ? 'bg-brand-50 border-brand-300 text-brand-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Input
                  label="Initial Stock Quantity"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  placeholder="0"
                  value={initialStock}
                  onChange={(e) => {
                    setInitialStock(e.target.value);
                    if (fieldErrors.initialStock) setFieldErrors({ ...fieldErrors, initialStock: '' });
                  }}
                  onFocus={(e) => e.target.select()}
                  error={fieldErrors.initialStock}
                  helperText={`Saved as ${formatQuantity(parseCleanQuantity(initialStock))} ${unit || 'units'}`}
                />
              </div>

              <div>
                <Input
                  label="Low Stock Alert (Optional)"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  placeholder="Leave empty for none"
                  value={lowStockThreshold}
                  onChange={(e) => {
                    setLowStockThreshold(e.target.value);
                    if (fieldErrors.lowStockThreshold) setFieldErrors({ ...fieldErrors, lowStockThreshold: '' });
                  }}
                  onFocus={(e) => e.target.select()}
                  error={fieldErrors.lowStockThreshold}
                  helperText="Alert when stock falls to this"
                />
              </div>
            </div>
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
