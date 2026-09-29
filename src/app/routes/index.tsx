import { createFileRoute, redirect } from '@tanstack/react-router';
import { getViewerFn } from '../../features/auth/server';

export const Route = createFileRoute('/')({
  loader: async () => {
    const data = await getViewerFn();
    if (data?.user) {
      throw redirect({ to: '/pos' });
    }
    throw redirect({ to: '/login' });
  },
  component: () => null,
});
