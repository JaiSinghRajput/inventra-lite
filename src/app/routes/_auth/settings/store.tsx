import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Store, Save, Percent, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { getStoreSettingsFn, updateStoreSettingsFn, deleteStoreFn } from '../../../../features/settings/server';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Card } from '../../../../components/ui/card';
import { Modal } from '../../../../components/ui/modal';
import { toast } from 'sonner';

export const Route = createFileRoute('/_auth/settings/store')({
  component: StoreSettingsComponent,
});

function StoreSettingsComponent() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [defaultTaxRate, setDefaultTaxRate] = useState('0.00');

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: store, isLoading } = useQuery({
    queryKey: ['settings', 'store'],
    queryFn: () => getStoreSettingsFn(),
    staleTime: 30000,
  });

  useEffect(() => {
    if (store) {
      setName(store.name || '');
      setTaxEnabled(!!store.taxEnabled);
      setDefaultTaxRate(store.defaultTaxRate || '0.00');
    }
  }, [store]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
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
      await queryClient.invalidateQueries({ queryKey: ['settings', 'store'] });
      await queryClient.invalidateQueries({ queryKey: ['viewer'] });
    } catch (err: any) {
      setError(err?.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;
    if (deleteConfirmText.trim() !== store.name?.trim()) {
      toast.error('Store name does not match confirmation.');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteStoreFn({ data: { tenantId: store.id } });
      toast.success(`Store "${store.name}" deleted successfully.`);
      if (res.nextTenantId) {
        document.cookie = `inventra_active_tenant=${encodeURIComponent(res.nextTenantId)}; path=/; max-age=31536000; SameSite=Lax`;
      } else {
        document.cookie = 'inventra_active_tenant=; path=/; max-age=0; SameSite=Lax';
      }
      setIsDeleteModalOpen(false);
      window.location.href = '/pos';
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete store');
      setIsDeleting(false);
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

      {/* Danger Zone: Delete Store */}
      <Card className="border-rose-200 bg-rose-50/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">
                Danger Zone
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-1">Delete This Store</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Permanently delete <strong>{store?.name || 'this store'}</strong> and all of its associated products, inventory, bills, customers, and reports.
            </p>
          </div>

          <Button
            type="button"
            variant="danger"
            onClick={() => setIsDeleteModalOpen(true)}
            className="shrink-0"
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete Store
          </Button>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setDeleteConfirmText('');
          }
        }}
        title="Delete Store"
        description="Permanently erase this store and all of its associated data."
      >
        <form onSubmit={handleDeleteStore} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 space-y-1">
              <p className="font-semibold">Warning: This action cannot be undone.</p>
              <p>
                Deleting <strong>{store?.name}</strong> will permanently remove all stock entries, bills, customers, invoices, and accounting history for this tenant.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Type <span className="font-mono font-bold text-rose-600">{store?.name}</span> to confirm:
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={store?.name}
              required
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteConfirmText('');
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isDeleting}
              disabled={deleteConfirmText.trim() !== store?.name?.trim()}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete Store
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
