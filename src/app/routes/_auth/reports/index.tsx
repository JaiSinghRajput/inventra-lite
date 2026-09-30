import React, { useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { BarChart3, AlertTriangle, Calendar, ArrowRight, DollarSign } from 'lucide-react';
import { getDailySalesSummaryFn, getLowStockAlertsFn } from '../../../../features/reports/server';
import { formatINR } from '../../../../lib/currency';
import { formatQuantity } from '../../../../lib/quantity';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';

export const Route = createFileRoute('/_auth/reports/')({
  component: ReportsComponent,
});

function ReportsComponent() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<any>(null);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      getDailySalesSummaryFn({ data: { date: selectedDate } }),
      getLowStockAlertsFn(),
    ]).then(([sum, low]) => {
      setSummary(sum);
      setLowStockProducts(low);
      setIsLoading(false);
    });
  }, [selectedDate]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sales Reports & Alerts</h2>
          <p className="text-xs text-slate-500">Daily financial summary and inventory replenishment alerts</p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Gross Sales</span>
          <p className="text-xl font-extrabold text-brand-700 mt-1">{formatINR(summary?.totalSales || 0)}</p>
          <span className="text-[10px] text-slate-400">{summary?.billsCount || 0} Bills Completed</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Net Collections</span>
          <p className="text-xl font-extrabold text-emerald-600 mt-1">{formatINR(summary?.totalCollected || 0)}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Cash/Digital Payments</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Outstanding Dues</span>
          <p className={`text-xl font-extrabold mt-1 ${(summary?.totalDue || 0) > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {formatINR(summary?.totalDue || 0)}
          </p>
          <span className="text-[10px] text-rose-500">Credit extended today</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Tax Collected</span>
          <p className="text-xl font-extrabold text-slate-700 mt-1">{formatINR(summary?.totalTax || 0)}</p>
          <span className="text-[10px] text-slate-400">Store flat tax</span>
        </Card>
      </div>

      {/* Low Stock Alerts Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">Low Stock Reorder Alerts</h3>
          </div>
          <span className="text-xs text-slate-400">{lowStockProducts.length} items need restock</span>
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            All inventory levels are healthy. No items below threshold.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Item & SKU</th>
                  <th className="py-2.5 px-4">Current Stock</th>
                  <th className="py-2.5 px-4">Reorder Threshold</th>
                  <th className="py-2.5 px-4 text-right">Restock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4">
                      <Link to="/inventory/$id" params={{ id: p.id }} className="font-bold text-slate-900 hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-[11px] text-slate-400 font-mono">{p.sku}</div>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-rose-600 font-mono">
                      {formatQuantity(p.stockQuantity)} {p.unit}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono">
                      {formatQuantity(p.lowStockThreshold)} {p.unit}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Link to="/purchases/new">
                        <Button size="sm" variant="outline" className="text-xs">
                          Stock-In <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
