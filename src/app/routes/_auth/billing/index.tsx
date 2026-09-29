import React, { useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Receipt, Search, Filter, Eye } from 'lucide-react';
import { listBillsFn } from '../../../../features/billing/server';
import { formatINR } from '../../../../lib/currency';
import { Badge } from '../../../../components/ui/badge';
import { EmptyState } from '../../../../components/feedback/empty-state';
import { SkeletonTable } from '../../../../components/feedback/skeleton-table';

export const Route = createFileRoute('/_auth/billing/')({
  component: BillingListComponent,
});

function BillingListComponent() {
  const [bills, setBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'completed' | 'cancelled' | undefined>();
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'unpaid' | 'partial' | 'paid' | undefined>();

  const loadBills = async () => {
    setIsLoading(true);
    try {
      const data = await listBillsFn({
        data: {
          status: statusFilter,
          paymentStatus: paymentStatusFilter,
        },
      });
      setBills(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, [statusFilter, paymentStatusFilter]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Invoices & Bills</h2>
          <p className="text-xs text-slate-500">View sales ledger, settlements, and receipt printouts</p>
        </div>
        <Link to="/pos">
          <Badge variant="brand" className="cursor-pointer py-1 px-3 text-xs">
            + New Sale
          </Badge>
        </Link>
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

      {/* Bills Table */}
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
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
                        <button className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
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
      )}
    </div>
  );
}
