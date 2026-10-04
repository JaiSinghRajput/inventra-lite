import React from 'react';
import { Compass, Calculator, Receipt, ArrowLeft, Package, Users, BarChart3, Home } from 'lucide-react';
import { Button } from '../ui/button';

interface NotFoundViewProps {
  title?: string;
  message?: string;
  showBack?: boolean;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  title = 'Page Not Found',
  message = "The page you are looking for doesn't exist, has been removed, or the link may be broken.",
  showBack = true,
}) => {
  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/pos';
    }
  };

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Decorative Icon Glow */}
      <div className="relative mb-6">
        <div className="absolute -inset-3 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 rounded-full blur-xl" />
        <div className="relative w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-teal-600">
          <Compass className="w-10 h-10 stroke-[1.75] animate-pulse" />
        </div>
        <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono font-bold text-[11px] shadow-xs">
          404
        </div>
      </div>

      {/* Text Info */}
      <div className="max-w-md space-y-2 mb-8">
        <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
          Lost in Navigation
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          {message}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 max-w-sm w-full mb-8">
        <a href="/pos" className="w-full sm:w-auto flex-1">
          <Button className="w-full font-semibold shadow-sm">
            <Calculator className="w-4 h-4 mr-2" /> Go to POS Billing
          </Button>
        </a>

        <a href="/billing" className="w-full sm:w-auto flex-1">
          <Button variant="outline" className="w-full font-semibold">
            <Receipt className="w-4 h-4 mr-2" /> View Invoices
          </Button>
        </a>

        {showBack && (
          <Button
            variant="ghost"
            onClick={handleGoBack}
            className="w-full text-xs text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Return to Previous Page
          </Button>
        )}
      </div>

      {/* Quick Links Footer */}
      <div className="pt-6 border-t border-slate-200/80 max-w-md w-full">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Popular Destinations
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <a
            href="/inventory"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-300 transition-colors shadow-2xs"
          >
            <Package className="w-3.5 h-3.5 text-slate-400" />
            <span>Inventory Items</span>
          </a>
          <a
            href="/customers"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-300 transition-colors shadow-2xs"
          >
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Khata & Customers</span>
          </a>
          <a
            href="/reports"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-300 transition-colors shadow-2xs"
          >
            <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
            <span>Sales Reports</span>
          </a>
        </div>
      </div>
    </div>
  );
};
