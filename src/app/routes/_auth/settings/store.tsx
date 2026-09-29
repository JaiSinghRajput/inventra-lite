import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Store, Save, Percent, FileText } from 'lucide-react';
import { getStoreSettingsFn, updateStoreSettingsFn } from '../../../../features/settings/server';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Card } from '../../../../components/ui/card';

export const Route = createFileRoute('/_auth/settings/store')({
  component: StoreSettingsComponent,
});

function StoreSettingsComponent() {
  const [store, setStore] = useState<any>(null);
  const [name, setName] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [defaultTaxRate, setDefaultTaxRate] = useState('0.00');

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getStoreSettingsFn().then((data) => {
      if (data) {
        setStore(data);
        setName(data.name);
        setTaxEnabled(data.taxEnabled);
        setDefaultTaxRate(data.defaultTaxRate);
      }
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsSaving(true);

    try {
      await updateStoreSettingsFn({
        data: {
          name: name.trim(),
          taxEnabled,
          defaultTaxRate: parseFloat(defaultTaxRate) || 0,
        },
      });
      setMessage('Store settings updated successfully!');
    } catch (err: any) {
      setError(err?.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Store Settings</h2>
        <p className="text-xs text-slate-500">Configure business profile, flat tax rates, and numbering</p>
      </div>

      <Card>
        {message && (
          <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Store / Business Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* Sequential Settings Display */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="text-xs font-semibold text-slate-700 block">Automated Sequences</span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500">SKU Prefix:</span>
                <p className="font-mono font-bold text-slate-900">{store?.skuPrefix || '—'}</p>
                <span className="text-[10px] text-slate-400">Next: {store?.skuPrefix}-{String(store?.nextSkuSeq || 1).padStart(6, '0')}</span>
              </div>
              <div>
                <span className="text-slate-500">Invoice Prefix:</span>
                <p className="font-mono font-bold text-slate-900">{store?.invoicePrefix || 'INV-'}</p>
                <span className="text-[10px] text-slate-400">Next: {store?.invoicePrefix}{String(store?.nextInvoiceSeq || 1).padStart(6, '0')}</span>
              </div>
            </div>
          </div>

          {/* Tax Configuration */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-800">Flat Store Tax (GST/VAT)</span>
                <p className="text-[11px] text-slate-500">Enable automatic calculation of flat tax at checkout</p>
              </div>
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded cursor-pointer"
              />
            </div>

            {taxEnabled && (
              <Input
                label="Default Tax Rate (%)"
                type="number"
                step="0.01"
                placeholder="e.g. 5.00 or 18.00"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(e.target.value)}
                required
              />
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" isLoading={isSaving}>
              <Save className="w-4 h-4" /> Save Settings
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
