import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Search, Filter, Eye, RefreshCw, List, LayoutGrid } from 'lucide-react';
import { listBillsFn } from '../../../../features/billing/server';
import { formatINR } from '../../../../lib/currency';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/feedback/empty-state';
import { SkeletonTable } from '../../../../components/feedback/skeleton-table';

export const Route = createFileRoute('/_auth/billing/')({
  loader: async () => {
    try {
      return await listBillsFn({ data: {} });
    } catch {
      return [];
    }
  },
  component: BillingListComponent,
});

function BillingListComponent() {
  const initialBills = Route.useLoaderData();
  const [statusFilter, setStatusFilter] = useState<'completed' | 'cancelled' | undefined>();
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'unpaid' | 'partial' | 'paid' | undefined>();
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'card' : 'list'
  );

  const {
    data: bills = initialBills,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['billing', { status: statusFilter, paymentStatus: paymentStatusFilter }],
    queryFn: () =>
      listBillsFn({
        data: {
          status: statusFilter,
          paymentStatus: paymentStatusFilter,
        },
      }),
    initialData: !statusFilter && !paymentStatusFilter ? initialBills : undefined,
    staleTime: 30000,
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Invoices & Bills</h2>
          <p className="text-xs text-slate-500">View sales ledger, settlements, and receipt printouts</p>
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

          <Link to="/pos">
            <Badge variant="brand" className="cursor-pointer py-1.5 px-3 text-xs">
              + New Sale
            </Badge>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-xs">
        <span className="text-slate-500 font-semibold flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Filters:
        </span>

        <button
          onClick={() => {
            setStatusFilter(undefined);
            setPaymentStatusFilter(undefined);
          }}
          className={`px-2.5 py-1 rounded-md border font-medium ${
            !statusFilter && !paymentStatusFilter
              ? 'bg-slate-800 border-slate-800 text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All
        </button>

        <button
          onClick={() => setPaymentStatusFilter(paymentStatusFilter === 'paid' ? undefined : 'paid')}
          className={`px-2.5 py-1 rounded-md border font-medium ${
            paymentStatusFilter === 'paid'
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Paid
        </button>

        <button
          onClick={() => setPaymentStatusFilter(paymentStatusFilter === 'partial' ? undefined : 'partial')}
          className={`px-2.5 py-1 rounded-md border font-medium ${
            paymentStatusFilter === 'partial'
              ? 'bg-amber-600 border-amber-600 text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Partial Due
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'cancelled' ? undefined : 'cancelled')}
          className={`px-2.5 py-1 rounded-md border font-medium ${
            statusFilter === 'cancelled'
              ? 'bg-rose-600 border-rose-600 text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Cancelled
        </button>
      </div>

      {isError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700">
          <span>Failed to load invoices.</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100">
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Bills Content */}
      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : bills.length === 0 ? (
        <EmptyState
          title="No bills found"
          description="Invoices created at the POS counter will appear here."
          actionLabel="Go to POS"
          onAction={() => (window.location.href = '/pos')}
        />
      ) : (
        <>
          {/* Card View */}
          <div className={`${viewMode === 'list' ? 'hidden' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'}`}>
            {bills.map((bill) => (
              <div
                key={bill.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      to="/billing/$id"
                      params={{ id: bill.id }}
                      className="font-mono font-bold text-base text-slate-900 hover:underline hover:text-brand-600 block"
                    >
                      {bill.billNumber}
                    </Link>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(bill.createdAt).toLocaleDateString()} • {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div>
                    {bill.status === 'cancelled' ? (
                      <Badge variant="danger">Cancelled</Badge>
                    ) : (
                      <Badge
                        variant={
                          bill.paymentStatus === 'paid'
                            ? 'success'
                            : bill.paymentStatus === 'partial'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {bill.paymentStatus}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total</span>
                    <span className="font-extrabold text-sm text-slate-900">{formatINR(bill.grandTotal)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Paid / Due</span>
                    <span className="text-emerald-600 font-bold">{formatINR(bill.paidAmount)}</span>
                    {bill.dueAmount > 0 && (
                      <span className="text-rose-600 font-bold ml-1">/ {formatINR(bill.dueAmount)} Due</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1 border-t border-slate-100">
                  <Link to="/billing/$id" params={{ id: bill.id }} className="w-full">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      <Eye className="w-3.5 h-3.5 mr-1" /> View Invoice
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Table / List View */}
          <div className={`${viewMode === 'card' ? 'hidden' : 'block'} bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Grand Total</th>
                    <th className="py-3 px-4">Paid / Due</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <Link to="/billing/$id" params={{ id: bill.id }} className="hover:underline">
                          {bill.billNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {new Date(bill.createdAt).toLocaleDateString()} {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {formatINR(bill.grandTotal)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs">
                          <span className="text-emerald-600 font-semibold">{formatINR(bill.paidAmount)}</span>
                          {bill.dueAmount > 0 && (
                            <span className="text-rose-600 font-bold ml-1.5">(Due: {formatINR(bill.dueAmount)})</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {bill.status === 'cancelled' ? (
                          <Badge variant="danger">Cancelled</Badge>
                        ) : (
                          <Badge
                            variant={
                              bill.paymentStatus === 'paid'
                                ? 'success'
                                : bill.paymentStatus === 'partial'
                                ? 'warning'
                                : 'danger'
                            }
                          >
                            {bill.paymentStatus}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link to="/billing/$id" params={{ id: bill.id }}>
                          <button className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer">
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
