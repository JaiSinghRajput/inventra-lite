import React from 'react';

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-pulse">
      <div className="h-6 bg-slate-100 rounded-md w-1/4 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center py-2 border-b border-slate-50 last:border-0">
          <div className="h-4 bg-slate-100 rounded w-1/6" />
          <div className="h-4 bg-slate-100 rounded w-2/5" />
          <div className="h-4 bg-slate-100 rounded w-1/6" />
          <div className="h-4 bg-slate-100 rounded w-1/6 ml-auto" />
        </div>
      ))}
    </div>
  );
};
