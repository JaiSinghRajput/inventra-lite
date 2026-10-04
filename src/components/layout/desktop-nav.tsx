import React, { useState, useEffect } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import {
  Calculator,
  Package,
  Receipt,
  Truck,
  Users,
  BarChart3,
  Settings,
  Loader2,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { to: '/pos', label: 'POS Billing', icon: Calculator },
  { to: '/inventory', label: 'Inventory Items', icon: Package },
  { to: '/billing', label: 'Bills & Invoices', icon: Receipt },
  { to: '/purchases', label: 'Stock-In / Purchases', icon: Truck },
  { to: '/customers', label: 'Customers & Ledger', icon: Users },
  { to: '/reports', label: 'Sales Reports', icon: BarChart3 },
  { to: '/settings/store', label: 'Store Settings', icon: Settings },
  { to: '/settings/users', label: 'Staff & Roles', icon: Users },
];

interface DesktopNavProps {
  role?: string;
}

export const DesktopNav: React.FC<DesktopNavProps> = ({ role }) => {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const isNavPending = routerState.status === 'pending';
  const pendingPath = (routerState as any)?.pendingLocation?.pathname || '';
  const [clickedTarget, setClickedTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!isNavPending) {
      setClickedTarget(null);
    }
  }, [isNavPending, currentPath]);

  const filteredNavItems = navItems.filter((item) => {
    if (role === 'CASHIER') {
      // Cashiers only access Billing, Inventory, Bills, Customers
      return !['/purchases', '/reports', '/settings/store', '/settings/users'].includes(item.to);
    }
    return true;
  });

  return (
    <aside className="hidden md:flex flex-col w-60 bg-white border-r border-slate-200 h-[calc(100vh-3.5rem)] sticky top-14">
      <nav className="p-3 space-y-1 overflow-y-auto flex-1">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.to || currentPath.startsWith(item.to + '/');
          const isItemLoading =
            (isNavPending && (pendingPath === item.to || pendingPath.startsWith(item.to + '/'))) ||
            clickedTarget === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              preload="intent"
              onClick={() => {
                if (!isActive) {
                  setClickedTarget(item.to);
                }
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isItemLoading
                  ? 'bg-brand-50 text-brand-700 font-semibold ring-1 ring-brand-200 shadow-2xs'
                  : isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {isItemLoading ? (
                <Loader2 className="w-4 h-4 text-brand-600 animate-spin shrink-0" />
              ) : (
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
              )}
              <span className="truncate">{item.label}</span>
              {isItemLoading && (
                <span className="text-[10px] bg-brand-100 text-brand-700 font-bold px-1.5 py-0.5 rounded ml-auto animate-pulse">
                  Loading
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
