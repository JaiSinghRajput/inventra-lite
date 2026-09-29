import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className = '', children, ...props }) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
};
