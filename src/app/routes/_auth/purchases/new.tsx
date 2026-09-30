import React, { useState, useEffect } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { ArrowLeft, Plus, Trash2, Truck } from 'lucide-react';
import { listProductsFn } from '../../../../features/inventory/server';
import { recordStockInFn } from '../../../../features/purchases/server';
import { inrToPaise, formatINR } from '../../../../lib/currency';
import { formatQuantity } from '../../../../lib/quantity';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Card } from '../../../../components/ui/card';

export const Route = createFileRoute('/_auth/purchases/new')({
  component: NewPurchaseComponent,
});

interface StockInLine {
  productId: string;
  name: string;
  quantity: string;
  unitCostINR: string;
}

function NewPurchaseComponent() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<any[]>([]);
  const [referenceInvoice, setReferenceInvoice] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<StockInLine[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listProductsFn().then((data) => {
      setProducts(data);
      if (data.length > 0) setSelectedProductId(data[0].id);
    });
  }, []);

  const addLine = () => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    setLines([
      ...lines,
      {
        productId: prod.id,
        name: prod.name,
        quantity: '1',
        unitCostINR: (prod.purchasePrice / 100).toString(),
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
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
    if (lines.length === 0) {
      setError('Please add at least one product item to restock');
      return;
    }

    for (const l of lines) {
      const qty = parseFloat(l.quantity);
      if (isNaN(qty) || qty <= 0) {
        setError(`Please enter a valid positive quantity for ${l.name}`);
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

      navigate({ to: '/purchases' });
    } catch (err: any) {
      setError(err?.message || 'Failed to record stock-in delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/purchases" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Record Stock-In Delivery</h2>
          <p className="text-xs text-slate-500">Restock products and update vendor delivery costs</p>
        </div>
      </div>

      <Card>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
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

          {/* Add Item Line Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">Select Product to Restock</label>
            <div className="flex gap-2">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:ring-brand-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — Current Stock: {formatQuantity(p.stockQuantity)} {p.unit}
                  </option>
                ))}
              </select>

              <Button type="button" size="sm" onClick={addLine}>
                <Plus className="w-4 h-4" /> Add Item
              </Button>
            </div>
          </div>

          {/* Line Items Table */}
          {lines.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 w-28">Quantity</th>
                    <th className="py-2.5 px-3 w-32">Unit Cost (₹)</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{line.name}</td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white font-semibold"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.01"
                          value={line.unitCostINR}
                          onChange={(e) => updateLine(idx, 'unitCostINR', e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white font-semibold"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatINR(Math.round((parseFloat(line.quantity) || 0) * inrToPaise(line.unitCostINR)))}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <button type="button" onClick={() => removeLine(idx)} className="text-slate-400 hover:text-rose-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                <span>Total Delivery Value:</span>
                <span className="text-brand-700 text-base">{formatINR(totalPaise)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Received in good condition, batch #882"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Link to="/purchases">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" isLoading={isSubmitting} disabled={lines.length === 0}>
              <Truck className="w-4 h-4" /> Finalize Stock-In
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
