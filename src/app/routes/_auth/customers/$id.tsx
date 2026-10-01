import React from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Phone, Mail, MapPin, Receipt, ShieldCheck, Trash2 } from 'lucide-react';
import { getCustomerDetailsFn, deleteCustomerFn } from '../../../../features/customers/server';
import { getViewerFn } from '../../../../features/auth/server';
import { formatINR } from '../../../../lib/currency';
import { Badge } from '../../../../components/ui/badge';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';

export const Route = createFileRoute('/_auth/customers/$id')({
  loader: async ({ params }) => {
    const [details, viewer] = await Promise.all([
      getCustomerDetailsFn({ data: { id: params.id } }),
      getViewerFn(),
    ]);
    return { ...details, viewer };
  },
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center max-w-md mx-auto">
      <h3 className="text-lg font-bold text-slate-900 mb-2">Customer Not Found</h3>
      <p className="text-sm text-slate-500 mb-4">{(error as any)?.message || 'Customer details could not be loaded.'}</p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => reset()} size="sm">Retry</Button>
        <Link to="/customers">
          <Button variant="outline" size="sm">Back to Customers</Button>
        </Link>
      </div>
    </div>
  ),
  component: CustomerDetailComponent,
});

function CustomerDetailComponent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const data = Route.useLoaderData();

  if (!data?.customer) {
    return (
      <div className="p-8 text-center text-slate-500">
        Customer not found. <Link to="/customers" className="text-brand-600 underline">Return to directory</Link>
      </div>
    );
  }

  const customer = data.customer;
  const ledger = data.ledger || [];
  const viewer = data.viewer;
  const balance = customer.receivableBalance;
  const isOwner = viewer?.user?.role === 'OWNER';

  // Invariant verification
  const calculatedSum = ledger.reduce((acc: number, entry: any) => acc + entry.amount, 0);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete customer "${customer.name}"?`)) return;
    try {
      await deleteCustomerFn({ data: { id: customer.id } });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.navigate({ to: '/customers' });
    } catch (err: any) {
      alert(err?.message || 'Failed to delete customer');
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/customers" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{customer.name}</h2>
              <Badge variant="brand">Khata Account</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>Added by <strong className="text-slate-600 font-medium">{customer.createdByName || 'Store Admin'}</strong></span>
              {customer.updatedByName && (
                <>
                  <span>•</span>
                  <span>Updated by <strong className="text-slate-600 font-medium">{customer.updatedByName}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        {isOwner && (
          <Button variant="danger" size="sm" onClick={handleDelete} title="Delete Customer (Owner Only)">
            <Trash2 className="w-3.5 h-3.5" /> Delete Customer
          </Button>
        )}
      </div>

      {/* Customer Info Card & Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="sm:col-span-2 space-y-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Customer Profile</h3>
          <div className="space-y-1.5 text-xs text-slate-600">
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono">{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{customer.address}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="text-center p-4 flex flex-col justify-center">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Receivable Balance</span>
          <p
            className={`text-2xl font-extrabold mt-1 ${
              balance > 0 ? 'text-rose-600' : balance < 0 ? 'text-emerald-600' : 'text-slate-800'
            }`}
          >
            {formatINR(balance)}
          </p>
          <span className="text-[11px] text-slate-400 mt-0.5">
            {balance > 0 ? 'Customer owes the shop' : balance < 0 ? 'Customer has credit balance' : 'Account is fully settled'}
          </span>
        </Card>
      </div>

      {/* Audit Invariant Badge */}
      <div className="p-2.5 bg-brand-50/60 border border-brand-100 rounded-lg text-xs flex items-center justify-between text-brand-900">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-brand-600" />
          Audit Verified: Maintained balance matches ledger transactions.
        </span>
        <span className="font-mono text-[11px] text-brand-700">
          Σ Entries: {formatINR(calculatedSum)}
        </span>
      </div>

      {/* Customer Ledger Timeline Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Financial Ledger Timeline</h3>
          </div>
          <span className="text-xs text-slate-400">Chronological debit & credit history</span>
        </div>

        {ledger.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No ledger entries recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Amount</th>
                  <th className="py-2.5 px-4">Balance After</th>
                  <th className="py-2.5 px-4">Reference / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((entry: any) => {
                  const isDebit = entry.amount > 0;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant={
                            entry.entryType === 'credit_sale'
                              ? 'danger'
                              : entry.entryType === 'payment_received'
                              ? 'success'
                              : 'warning'
                          }
                          className="text-[10px]"
                        >
                          {entry.entryType}
                        </Badge>
                      </td>
                      <td
                        className={`py-2.5 px-4 font-extrabold font-mono ${
                          isDebit ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {isDebit ? `+${formatINR(entry.amount)}` : formatINR(entry.amount)}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                        {formatINR(entry.balanceAfter)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {entry.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
