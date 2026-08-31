import type { HTMLAttributes, ReactNode } from 'react';

interface ErpCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  size?: 'default' | 'sm';
  padding?: boolean;
}

export function ErpCard({ children, size = 'default', padding = true, className = '', ...props }: ErpCardProps) {
  const sizeClass = size === 'sm' ? 'erp-card-sm' : 'erp-card';
  return (
    <div className={`${sizeClass}${padding ? ' p-4' : ''} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
