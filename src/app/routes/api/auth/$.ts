import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { auth } = await import('../../../../features/auth/auth-server');
        return await auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        const { auth } = await import('../../../../features/auth/auth-server');
        return await auth.handler(request);
      },
    },
  },
} as any);

