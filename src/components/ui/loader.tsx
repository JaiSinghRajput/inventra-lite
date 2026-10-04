import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
  centered?: boolean;
  fullscreen?: boolean;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  text,
  className = '',
  centered = false,
  fullscreen = false,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const content = (
    <div className={`flex flex-col items-center justify-center gap-2.5 ${className}`}>
      <div className="relative">
        <div className="absolute -inset-1.5 bg-brand-500/20 rounded-full blur-xs animate-pulse" />
        <Loader2 className={`${sizeClasses[size]} text-brand-600 animate-spin relative`} />
      </div>
      {text && (
        <p className="text-xs font-medium text-slate-600 animate-pulse tracking-wide select-none">
          {text}
        </p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-150">
        {content}
      </div>
    );
  }

  if (centered) {
    return (
      <div className="w-full h-full min-h-[160px] flex items-center justify-center p-6">
        {content}
      </div>
    );
  }

  return content;
};
