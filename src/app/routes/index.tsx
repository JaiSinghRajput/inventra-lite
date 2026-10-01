import React, { useEffect, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { getViewerFn } from '../../features/auth/server';
import { authClient } from '../../features/auth/auth-client';
import { Loader2 } from 'lucide-react';

export const Route = createFileRoute('/')({
  loader: async () => {
    try {
      const data = await getViewerFn();
      if (data?.user) {
        throw redirect({ to: '/pos' });
      }
    } catch (err: any) {
      // Re-throw TanStack redirect so it takes effect
      if (err?.to || err?.status === 302 || err?.status === 307) {
        throw err;
      }
      // Otherwise allow client to attempt session restoration
    }
    return { verified: false };
  },
  component: IndexComponent,
});

function IndexComponent() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        // Attempt to detect and restore existing session via better-auth client
        const sessionRes = await authClient.getSession();
        if (sessionRes?.data?.user && isMounted) {
          navigate({ to: '/pos', replace: true });
          return;
        }

        // Secondary check via server function
        const viewer = await getViewerFn();
        if (viewer?.user && isMounted) {
          navigate({ to: '/pos', replace: true });
          return;
        }

        // Genuinely no session found
        if (isMounted) {
          navigate({ to: '/login', replace: true });
        }
      } catch (err) {
        console.warn('[SessionRestoration] Error checking session:', err);
        if (isMounted) {
          navigate({ to: '/login', replace: true });
        }
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white mb-4 shadow-sm animate-pulse">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
      <p className="text-sm font-medium text-slate-600">Restoring session...</p>
    </div>
  );
}
