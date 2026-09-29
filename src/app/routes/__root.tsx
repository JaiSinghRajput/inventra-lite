import React from 'react';
import { createRootRouteWithContext, Outlet, HeadContent, Scripts } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { OfflineBanner } from '../../components/feedback/offline-banner';
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
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <h2 className="text-xl font-bold text-slate-800 mb-2">Page Not Found</h2>
      <p className="text-sm text-slate-500 mb-4">The requested page does not exist or has been moved.</p>
      <a href="/login" className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
        Go to Login
      </a>
    </div>
  ),
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
        <QueryClientProvider client={queryClient}>
          <div className="min-h-screen flex flex-col">
            <OfflineBanner />
            <main className="flex-1 flex flex-col">
              <Outlet />
            </main>
          </div>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
