import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixText?: string;
  suffixText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, helperText, prefixText, suffixText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixText && (
            <span className="absolute left-3 text-slate-400 text-sm font-medium select-none pointer-events-none">
              {prefixText}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-500 shadow-sm ${
              error ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-300'
            } ${prefixText ? 'pl-8' : ''} ${suffixText ? 'pr-8' : ''} ${className}`}
            {...props}
          />
          {suffixText && (
            <span className="absolute right-3 text-slate-400 text-sm font-medium select-none pointer-events-none">
              {suffixText}
            </span>
          )}
        </div>
        {error && <span className="text-xs text-rose-600 font-medium">{error}</span>}
        {helperText && !error && <span className="text-xs text-slate-500">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
