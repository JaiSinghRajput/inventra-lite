import React from 'react';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getViewerFn } from '../../features/auth/server';
import { AppHeader } from '../../components/layout/app-header';
import { DesktopNav } from '../../components/layout/desktop-nav';
import { MobileBottomNav } from '../../components/layout/mobile-bottom-nav';

export const Route = createFileRoute('/_auth')({
  loader: async () => {
    const viewer = await getViewerFn();
    if (!viewer?.user) {
      throw redirect({ to: '/login' });
    }
    return viewer;
  },
  component: AuthLayoutComponent,
});

function AuthLayoutComponent() {
  const viewer = Route.useLoaderData();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <AppHeader
        storeName={viewer.tenant?.name || 'Inventra Lite'}
        userName={viewer.user?.userName || 'User'}
        role={viewer.user?.role || 'STAFF'}
      />
      <div className="flex-1 flex w-full">
        <DesktopNav />
        <main className="flex-1 flex flex-col min-w-0 p-3 sm:p-5 pb-20 md:pb-5 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
