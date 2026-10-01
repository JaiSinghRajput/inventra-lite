import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Truck, Plus, PackageCheck, RefreshCw } from 'lucide-react';
import { listPurchasesFn } from '../../../../features/purchases/server';
import { formatINR } from '../../../../lib/currency';
import { Button } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/feedback/empty-state';
import { SkeletonTable } from '../../../../components/feedback/skeleton-table';

export const Route = createFileRoute('/_auth/purchases/')({
  component: PurchasesListComponent,
});

function PurchasesListComponent() {
  const {
    data: purchases = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => listPurchasesFn(),
    staleTime: 30000,
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Stock-In / Purchases</h2>
          <p className="text-xs text-slate-500">Record supplier deliveries and restock inventory</p>
        </div>
        <Link to="/purchases/new">
          <Button size="md" className="shadow-sm">
            <Plus className="w-4 h-4" /> Record Delivery
          </Button>
        </Link>
      </div>

      {isError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700">
          <span>Failed to load purchase records.</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100">
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : purchases.length === 0 ? (
        <EmptyState
          title="No stock-in records"
          description="Record deliveries when you receive stock from vendors to increment inventory balances."
          actionLabel="Record Stock-In"
          onAction={() => (window.location.href = '/purchases/new')}
          icon={Truck}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Invoice / Ref #</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 text-slate-600">
                    {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {p.referenceInvoice || 'Direct Delivery'}
                  </td>
                  <td className="py-3 px-4 font-extrabold text-brand-700">
                    {formatINR(p.totalAmount)}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs">
                    {p.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
