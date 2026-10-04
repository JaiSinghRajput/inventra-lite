import React from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';

const routeLabels: Record<string, string> = {
  '/pos': 'POS Billing',
  '/inventory': 'Inventory Items',
  '/billing': 'Bills & Invoices',
  '/purchases': 'Stock-In / Purchases',
  '/customers': 'Customers & Khata',
  '/reports': 'Sales Reports',
  '/settings/store': 'Store Settings',
  '/settings/users': 'Staff & Roles',
  '/login': 'Login',
  '/register': 'Register',
};

export const RouteLoadingPill: React.FC = () => {
  const routerState = useRouterState();
  const isLoading = routerState.status === 'pending';
  const pendingPath = (routerState as any)?.pendingLocation?.pathname || '';

  if (!isLoading) return null;

  const matchedKey = Object.keys(routeLabels).find((key) => pendingPath === key || pendingPath.startsWith(key + '/'));
  const destination = matchedKey ? routeLabels[matchedKey] : 'Page';

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="bg-slate-900/90 text-white backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-lg border border-slate-700/50 flex items-center gap-2 text-xs font-semibold">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
        <span>Opening {destination}...</span>
      </div>
    </div>
  );
};
