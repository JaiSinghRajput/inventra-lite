import React, { useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Users, Plus, Search, Phone, Mail, ArrowUpRight } from 'lucide-react';
import { listCustomersFn, createCustomerFn } from '../../../../features/customers/server';
import { formatINR } from '../../../../lib/currency';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Modal } from '../../../../components/ui/modal';
import { EmptyState } from '../../../../components/feedback/empty-state';
import { SkeletonTable } from '../../../../components/feedback/skeleton-table';

export const Route = createFileRoute('/_auth/customers/')({
  component: CustomersListComponent,
});

function CustomersListComponent() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // New Customer Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const data = await listCustomersFn({ data: { search: search.trim() || undefined } });
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
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
      loadCustomers();
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
        <Button size="md" onClick={() => setIsNewModalOpen(true)} className="shadow-sm">
          <Plus className="w-4 h-4" /> Add Customer
        </Button>
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

      {/* Customers List Table */}
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
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
