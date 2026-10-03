import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Phone, Mail, ArrowUpRight, RefreshCw, List, LayoutGrid } from 'lucide-react';
import { listCustomersFn, createCustomerFn } from '../../../../features/customers/server';
import { formatINR } from '../../../../lib/currency';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Modal } from '../../../../components/ui/modal';
import { EmptyState } from '../../../../components/feedback/empty-state';
import { SkeletonTable } from '../../../../components/feedback/skeleton-table';

export const Route = createFileRoute('/_auth/customers/')({
  loader: async () => {
    try {
      return await listCustomersFn({ data: {} });
    } catch {
      return [];
    }
  },
  component: CustomersListComponent,
});

function CustomersListComponent() {
  const initialCustomers = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'card' : 'list'
  );

  // New Customer Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  const {
    data: customers = initialCustomers,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['customers', { search: search.trim() || undefined }],
    queryFn: () => listCustomersFn({ data: { search: search.trim() || undefined } }),
    initialData: !search.trim() ? initialCustomers : undefined,
    staleTime: 30000,
  });

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newName.trim()) return;

    setCreateError('');
    setIsSubmitting(true);

    try {
      await createCustomerFn({
        data: {
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          address: newAddress.trim() || undefined,
        },
      });

      setIsNewModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewAddress('');
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to add customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Customers & Khata Ledger</h2>
          <p className="text-xs text-slate-500">Manage customer accounts, credit balances, and transaction history</p>
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

          <Button size="md" onClick={() => setIsNewModalOpen(true)} className="shadow-sm">
            <Plus className="w-4 h-4 mr-1" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 select-none pointer-events-none" />
          <input
            type="text"
            placeholder="Search customers by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>
      </div>

      {isError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700">
          <span>Failed to load customer list.</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100">
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Customers Content */}
      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : customers.length === 0 ? (
        <EmptyState
          title="No customers registered"
          description="Register customers to track credit sales, dues, and transaction histories."
          actionLabel="Add First Customer"
          onAction={() => setIsNewModalOpen(true)}
          icon={Users}
        />
      ) : (
        <>
          {/* Card View */}
          <div className={`${viewMode === 'list' ? 'hidden' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'}`}>
            {customers.map((c) => {
              const bal = c.receivableBalance;
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to="/customers/$id"
                        params={{ id: c.id }}
                        className="font-bold text-base text-slate-900 hover:underline hover:text-brand-600 block"
                      >
                        {c.name}
                      </Link>
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5 hover:text-brand-600"
                        >
                          <Phone className="w-3 h-3 text-slate-400" /> {c.phone}
                        </a>
                      )}
                      {c.address && (
                        <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">{c.address}</p>
                      )}
                    </div>
                    <div>
                      {bal > 0 ? (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          Owes Store
                        </span>
                      ) : bal < 0 ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Advance Credit
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          Settled
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2.5 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">Khata Balance:</span>
                    <span
                      className={`font-black text-sm ${
                        bal > 0 ? 'text-rose-600' : bal < 0 ? 'text-emerald-600' : 'text-slate-700'
                      }`}
                    >
                      {formatINR(bal)}
                    </span>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <Link to="/customers/$id" params={{ id: c.id }} className="w-full">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        View Ledger <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table / List View */}
          <div className={`${viewMode === 'card' ? 'hidden' : 'block'} bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Phone / Contact</th>
                    <th className="py-3 px-4">Receivable Balance</th>
                    <th className="py-3 px-4 text-right">Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => {
                    const bal = c.receivableBalance;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <Link to="/customers/$id" params={{ id: c.id }} className="font-bold text-slate-900 hover:underline">
                            {c.name}
                          </Link>
                          {c.address && <div className="text-[11px] text-slate-400 truncate max-w-xs">{c.address}</div>}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">
                          {c.phone ? (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" /> {c.phone}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-extrabold text-sm ${
                              bal > 0 ? 'text-rose-600' : bal < 0 ? 'text-emerald-600' : 'text-slate-600'
                            }`}
                          >
                            {formatINR(bal)}
                          </span>
                          {bal > 0 && <span className="text-[10px] text-rose-500 font-semibold ml-1.5">(Owes Store)</span>}
                          {bal < 0 && <span className="text-[10px] text-emerald-500 font-semibold ml-1.5">(Advance Credit)</span>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link to="/customers/$id" params={{ id: c.id }}>
                            <Button variant="outline" size="sm">
                              View Ledger <ArrowUpRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
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

      {/* ADD CUSTOMER MODAL */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Add New Customer"
        description="Create a customer account to track credit sales, ledger, and contact info."
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          {createError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {createError}
            </div>
          )}

          <Input
            label="Customer Name *"
            placeholder="e.g. Ramesh Patel"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Phone Number"
            type="tel"
            placeholder="e.g. 9876543210"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />

          <Input
            label="Email Address (Optional)"
            type="email"
            placeholder="e.g. ramesh@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />

          <Input
            label="Address / Shop (Optional)"
            placeholder="e.g. Shop #12, Main Market"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
          />

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Save Customer
          </Button>
        </form>
      </Modal>
    </div>
  );
}
