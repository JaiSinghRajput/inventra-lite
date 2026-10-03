import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Calculator,
  Package,
  Receipt,
  Truck,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { getDailySalesSummaryFn, getLowStockAlertsFn } from '../../../features/reports/server';
import { listBillsFn } from '../../../features/billing/server';
import { formatINR } from '../../../lib/currency';
import { formatQuantity } from '../../../lib/quantity';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';

export const Route = createFileRoute('/_auth/dashboard')({
  component: DashboardComponent,
});

function DashboardComponent() {
  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['reports', 'daily'],
    queryFn: () => getDailySalesSummaryFn(),
    staleTime: 30000,
  });

  const {
    data: lowStockRaw,
    isLoading: isLowStockLoading,
    refetch: refetchLowStock,
  } = useQuery({
    queryKey: ['reports', 'low-stock'],
    queryFn: () => getLowStockAlertsFn(),
    staleTime: 30000,
  });

  const {
    data: billsRaw,
    isLoading: isBillsLoading,
    refetch: refetchBills,
  } = useQuery({
    queryKey: ['billing'],
    queryFn: () => listBillsFn(),
    staleTime: 30000,
  });

  const lowStock = (lowStockRaw || []).slice(0, 5);
  const recentBills = (billsRaw || []).slice(0, 5);

  const handleRetryAll = () => {
    refetchSummary();
    refetchLowStock();
    refetchBills();
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto w-full">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-800 text-white rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Counter Register Ready</h2>
          <p className="text-xs sm:text-sm text-brand-100 mt-1">
            Fast keyboard billing, inventory audit tracking, and customer khata management
          </p>
        </div>
        <Link to="/pos">
          <Button size="lg" className="bg-white text-brand-800 hover:bg-brand-50 border-0 font-bold shadow-md">
            <Calculator className="w-5 h-5" /> Open POS Billing (F2)
          </Button>
        </Link>
      </div>

      {isSummaryError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700">
          <span>Failed to load fresh dashboard metrics. Cached data may be shown.</span>
          <Button size="sm" variant="outline" onClick={handleRetryAll} className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100">
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/pos" className="block">
          <Card className="hover:border-brand-300 hover:shadow-md transition-all p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">New Sale</p>
              <p className="text-[10px] text-slate-500">Counter POS</p>
            </div>
          </Card>
        </Link>

        <Link to="/inventory/new" className="block">
          <Card className="hover:border-brand-300 hover:shadow-md transition-all p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Add Item</p>
              <p className="text-[10px] text-slate-500">Auto SKU</p>
            </div>
          </Card>
        </Link>

        <Link to="/purchases/new" className="block">
          <Card className="hover:border-brand-300 hover:shadow-md transition-all p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Stock-In</p>
              <p className="text-[10px] text-slate-500">Record delivery</p>
            </div>
          </Card>
        </Link>

        <Link to="/customers" className="block">
          <Card className="hover:border-brand-300 hover:shadow-md transition-all p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Khata</p>
              <p className="text-[10px] text-slate-500">Customer dues</p>
            </div>
          </Card>
        </Link>
      </div>

      {/* Today's Sales Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Today's Sales</span>
          <p className="text-xl font-extrabold text-brand-700 mt-1">{formatINR(summary?.totalSales || 0)}</p>
          <span className="text-[10px] text-slate-400">{summary?.billsCount || 0} Bills</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Collections</span>
          <p className="text-xl font-extrabold text-emerald-600 mt-1">{formatINR(summary?.totalCollected || 0)}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Cash/Digital</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Due Balance</span>
          <p className={`text-xl font-extrabold mt-1 ${(summary?.totalDue || 0) > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {formatINR(summary?.totalDue || 0)}
          </p>
          <span className="text-[10px] text-rose-500">Credit sales today</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Low Stock</span>
          <p className="text-xl font-extrabold text-amber-600 mt-1">{lowStock.length}</p>
          <span className="text-[10px] text-slate-400">Items below threshold</span>
        </Card>
      </div>

      {/* Split Section: Recent Invoices & Low Stock Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <Card className="p-0 overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-slate-800">Recent Invoices</h3>
            </div>
            <Link to="/billing" className="text-xs font-semibold text-brand-600 hover:underline">
              View all →
            </Link>
          </div>
          {recentBills.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No invoices yet today.</div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {recentBills.map((b) => (
                <Link
                  key={b.id}
                  to="/billing/$id"
                  params={{ id: b.id }}
                  className="p-3 items-center justify-between hover:bg-slate-50 transition-colors block"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900">{b.billNumber}</span>
                    <div className="text-[11px] text-slate-400">
                      {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900">{formatINR(b.grandTotal)}</span>
                    <div>
                      <Badge
                        variant={b.paymentStatus === 'paid' ? 'success' : b.paymentStatus === 'partial' ? 'warning' : 'danger'}
                        className="text-[10px]"
                      >
                        {b.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Low Stock Watchlist */}
        <Card className="p-0 overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-800">Low Stock Watchlist</h3>
            </div>
            <Link to="/reports" className="text-xs font-semibold text-brand-600 hover:underline">
              View all alerts →
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="p-6 text-center text-xs text-emerald-600">All stock levels are healthy!</div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {lowStock.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between">
                  <div>
                    <Link to="/inventory/$id" params={{ id: item.id }} className="font-bold text-slate-900 hover:underline">
                      {item.name}
                    </Link>
                    <div className="text-[11px] text-slate-400 font-mono">{item.sku}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-rose-600">{formatQuantity(item.stockQuantity)} {item.unit}</span>
                    <div className="text-[10px] text-slate-400">
                      {item.lowStockThreshold ? `Threshold: ${formatQuantity(item.lowStockThreshold)}` : 'Out of stock'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
