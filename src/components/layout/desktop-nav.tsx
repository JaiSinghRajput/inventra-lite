import React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import {
  Calculator,
  Package,
  Receipt,
  Truck,
  Users,
  BarChart3,
  Settings,
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

export const DesktopNav: React.FC = () => {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside className="hidden md:flex flex-col w-60 bg-white border-r border-slate-200 h-[calc(100vh-3.5rem)] sticky top-14">
      <nav className="p-3 space-y-1 overflow-y-auto flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.to || currentPath.startsWith(item.to + '/');

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
