import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { NotFoundView } from '../../components/feedback/not-found-view';

export const Route = createFileRoute('/$')({
  component: NotFoundRouteComponent,
});

function NotFoundRouteComponent() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <NotFoundView />
    </div>
  );
}
