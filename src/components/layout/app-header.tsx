import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Wifi, WifiOff, ChevronDown, Check, Plus, Store, Shield, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '../../features/auth/auth-client';
import { listUserStoresFn, createNewStoreFn, deleteStoreFn } from '../../features/settings/server';
import { Modal } from '../ui/modal';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface AppHeaderProps {
  storeName?: string;
  userName?: string;
  role?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  storeName = 'Inventra Lite',
  userName = 'User',
  role = 'STAFF',
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<any | null>(null);
  const [isDeletingStore, setIsDeletingStore] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenDropdown = async () => {
    setIsDropdownOpen((prev) => !prev);
    if (!isDropdownOpen) {
      try {
        const list = await listUserStoresFn();
        setStores(list);
      } catch (err) {
        console.error('Failed to load stores', err);
      }
    }
  };

  const handleSwitchStore = (tenantId: string) => {
    document.cookie = `inventra_active_tenant=${encodeURIComponent(tenantId)}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  };

  const handleCreateNewStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;
    setIsCreating(true);
    try {
      const res = await createNewStoreFn({ data: { name: newStoreName.trim() } });
      document.cookie = `inventra_active_tenant=${encodeURIComponent(res.tenantId)}; path=/; max-age=31536000; SameSite=Lax`;
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create store');
      setIsCreating(false);
    }
  };

  const handleDeleteStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeToDelete) return;
    if (deleteConfirmationInput.trim() !== storeToDelete.name.trim()) {
      toast.error('Store name does not match confirmation.');
      return;
    }
    setIsDeletingStore(true);
    try {
      const res = await deleteStoreFn({ data: { tenantId: storeToDelete.tenantId } });
      toast.success(`Store "${storeToDelete.name}" deleted successfully.`);
      if (res.nextTenantId) {
        document.cookie = `inventra_active_tenant=${encodeURIComponent(res.nextTenantId)}; path=/; max-age=31536000; SameSite=Lax`;
      } else {
        document.cookie = 'inventra_active_tenant=; path=/; max-age=0; SameSite=Lax';
      }
      setStoreToDelete(null);
      setIsDropdownOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete store');
      setIsDeletingStore(false);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    window.location.href = '/login';
  };

  const getRoleBadgeClass = (r: string) => {
    switch (r) {
      case 'OWNER':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MANAGER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-teal-50 text-teal-700 border-teal-200';
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-50 shadow-xs">
      <div className="flex items-center gap-2 sm:gap-3 relative" ref={dropdownRef}>
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-xs flex-shrink-0">
          {storeName.slice(0, 1).toUpperCase()}
        </div>

        {/* Store Selector Button */}
        <button
          type="button"
          onClick={handleOpenDropdown}
          className="flex items-center gap-1.5 text-left group p-1 -ml-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div>
            <div className="flex items-center gap-1">
              <h1 className="text-sm font-bold text-slate-900 leading-tight truncate max-w-[150px] sm:max-w-xs group-hover:text-brand-700">
                {storeName}
              </h1>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              {isOnline ? (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <Wifi className="w-3 h-3" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              )}
              <span>•</span>
              <span className={`px-1.5 py-0.2 rounded border text-[10px] font-semibold ${getRoleBadgeClass(role)}`}>
                {role}
              </span>
            </div>
          </div>
        </button>

        {/* Store Switcher Dropdown */}
        {isDropdownOpen && (
          <div className="absolute left-0 top-12 mt-1 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your Stores</span>
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsNewStoreModalOpen(true);
                }}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> New Store
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto py-1">
              {stores.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400 text-center">Loading stores...</div>
              ) : (
                stores.map((s) => {
                  const isCurrent = s.name === storeName;
                  return (
                    <div
                      key={s.tenantId}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50 transition-colors group ${
                        isCurrent ? 'bg-brand-50/50 font-semibold' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchStore(s.tenantId)}
                        className="flex items-center gap-2 truncate flex-1 cursor-pointer text-left"
                      >
                        <Store className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="truncate">
                          <p className="text-slate-900 font-medium truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400">SKU: {s.skuPrefix}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getRoleBadgeClass(s.role)}`}>
                          {s.role}
                        </span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-brand-600" />}
                        {s.role === 'OWNER' && (
                          <button
                            type="button"
                            title="Delete Store"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStoreToDelete(s);
                              setDeleteConfirmationInput('');
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-100 pt-1 mt-1 px-2">
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsNewStoreModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Store</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-semibold text-slate-800">{userName}</p>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* CREATE NEW STORE MODAL */}
      <Modal
        isOpen={isNewStoreModalOpen}
        onClose={() => setIsNewStoreModalOpen(false)}
        title="Create New Store"
        description="Add another store or branch to your account. You will be set as Owner."
      >
        <form onSubmit={handleCreateNewStore} className="space-y-4">
          <Input
            label="Store / Business Name *"
            placeholder="e.g. Metro Electronics - Branch 2"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            required
            autoFocus
          />

          <Button type="submit" isLoading={isCreating} className="w-full">
            Create Store & Switch
          </Button>
        </form>
      </Modal>

      {/* DELETE STORE MODAL */}
      <Modal
        isOpen={!!storeToDelete}
        onClose={() => {
          if (!isDeletingStore) {
            setStoreToDelete(null);
            setDeleteConfirmationInput('');
          }
        }}
        title="Delete Store"
        description="Permanently erase this store and all of its associated data."
      >
        <form onSubmit={handleDeleteStore} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 space-y-1">
              <p className="font-semibold">Warning: This action is permanent and irreversible.</p>
              <p>
                Deleting <strong>{storeToDelete?.name}</strong> will erase all its products, inventory movements, bills, customer ledgers, and transactions.
              </p>
              {storeToDelete?.name === storeName && (
                <p className="font-medium text-rose-900">
                  You are currently in this store. If you delete it, you will be switched to another store.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Type <span className="font-mono font-bold text-rose-600">{storeToDelete?.name}</span> to confirm:
            </label>
            <Input
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value)}
              placeholder={storeToDelete?.name}
              required
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStoreToDelete(null);
                setDeleteConfirmationInput('');
              }}
              disabled={isDeletingStore}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isDeletingStore}
              disabled={deleteConfirmationInput.trim() !== storeToDelete?.name?.trim()}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete Store
            </Button>
          </div>
        </form>
      </Modal>
    </header>
  );
};

