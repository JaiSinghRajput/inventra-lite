import React from 'react';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getViewerFn } from '../../features/auth/server';
import { AppHeader } from '../../components/layout/app-header';
import { DesktopNav } from '../../components/layout/desktop-nav';
import { MobileBottomNav } from '../../components/layout/mobile-bottom-nav';

export const Route = createFileRoute('/_auth')({
  loader: async () => {
    try {
      const viewer = await getViewerFn();
      if (!viewer?.user) {
        throw redirect({ to: '/login' });
      }
      return viewer;
    } catch (err: any) {
      if (err?.to || err?.status === 302 || err?.status === 307) {
        throw err;
      }
      console.warn('[AuthRoute] Failed to load viewer session:', err);
      throw redirect({ to: '/login' });
    }
  },
  errorComponent: ({ error, reset }) => {
    console.error('[AuthLayoutError]', error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Session Error</h2>
        <p className="text-sm text-slate-500 mb-4 max-w-sm">
          {(error as any)?.message || 'Unable to verify your store session. Please try reconnecting or log in again.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 cursor-pointer"
          >
            Retry
          </button>
          <a
            href="/login"
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
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
