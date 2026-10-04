import React, { useState, useEffect } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Calculator, Package, Receipt, Users, MoreHorizontal, Loader2 } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
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

  const items = [
    { to: '/pos', label: 'Billing', icon: Calculator },
    { to: '/inventory', label: 'Items', icon: Package },
    { to: '/billing', label: 'Bills', icon: Receipt },
    { to: '/customers', label: 'Khata', icon: Users },
    { to: '/reports', label: 'More', icon: MoreHorizontal },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-40 shadow-lg">
      {items.map((item) => {
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
            className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all relative ${
              isItemLoading
                ? 'text-brand-600 font-bold scale-105'
                : isActive
                ? 'text-brand-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {isItemLoading ? (
              <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
            ) : (
              <Icon className={`w-5 h-5 ${isActive ? 'text-brand-600 stroke-[2.5]' : 'text-slate-400'}`} />
            )}
            <span className="text-[11px] mt-1 flex items-center justify-center gap-1">
              {item.label}
              {isItemLoading && <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-ping inline-block" />}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
