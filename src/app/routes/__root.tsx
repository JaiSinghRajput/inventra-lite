import React from 'react';
import { createRootRouteWithContext, Outlet, HeadContent, Scripts } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { OfflineBanner } from '../../components/feedback/offline-banner';
import { RouteLoadingBar } from '../../components/feedback/route-loading-bar';
import { NotFoundView } from '../../components/feedback/not-found-view';
import appCss from '../../styles/app.css?url';

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Inventra Lite - POS & Inventory' },
      { name: 'theme-color', content: '#0d9488' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'Inventra' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
    ],
  }),
  notFoundComponent: () => <NotFoundView />,
  errorComponent: ({ error, reset }) => {
    console.error('[AppError]', error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          {(error as any)?.message || 'An unexpected error occurred while loading this view. You can try refreshing or returning to the POS.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 cursor-pointer shadow-sm"
          >
            Try Again
          </button>
          <a
            href="/pos"
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            Return to POS
          </a>
        </div>
      </div>
    );
  },
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        <RouteLoadingBar />
        <QueryClientProvider client={queryClient}>
          <div className="min-h-screen flex flex-col">
            <OfflineBanner />
            <main className="flex-1 flex flex-col">
              <Outlet />
            </main>
          </div>
          <Toaster richColors position="top-right" closeButton />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
