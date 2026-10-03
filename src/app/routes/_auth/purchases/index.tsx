import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Truck, Plus, PackageCheck, RefreshCw, List, LayoutGrid } from 'lucide-react';
import { listPurchasesFn } from '../../../../features/purchases/server';
import { formatINR } from '../../../../lib/currency';
import { Button } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/feedback/empty-state';
import { SkeletonTable } from '../../../../components/feedback/skeleton-table';

export const Route = createFileRoute('/_auth/purchases/')({
  component: PurchasesListComponent,
});

function PurchasesListComponent() {
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'card' : 'list'
  );

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Stock-In / Purchases</h2>
          <p className="text-xs text-slate-500">Record supplier deliveries and restock inventory</p>
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

          <Link to="/purchases/new">
            <Button size="md" className="shadow-sm">
              <Plus className="w-4 h-4 mr-1" /> Record Delivery
            </Button>
          </Link>
        </div>
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
        <>
          {/* Card View */}
          <div className={`${viewMode === 'list' ? 'hidden' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'}`}>
            {purchases.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-sm text-slate-900 block">
                        {p.referenceInvoice || 'Direct Delivery'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(p.createdAt).toLocaleDateString()} • {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total</span>
                    <span className="font-extrabold text-brand-700 text-base">
                      {formatINR(p.totalAmount)}
                    </span>
                  </div>
                </div>

                {p.notes && (
                  <div className="bg-slate-50 rounded-lg p-2.5 text-xs text-slate-600 border border-slate-100">
                    <span className="font-medium text-slate-400 block text-[10px] uppercase">Notes</span>
                    <p className="mt-0.5">{p.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Table / List View */}
          <div className={`${viewMode === 'card' ? 'hidden' : 'block'} bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs`}>
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
        </>
      )}
    </div>
  );
}
