import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';

export function createRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30,
      },
    },
  });

  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
    },
    defaultPreload: 'intent',
    scrollRestoration: true,
  });

  return router;
}

export const getRouter = createRouter;

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
