import type { SelectHTMLAttributes } from 'react';

export function ErpSelect({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`erp-select min-w-0 cursor-pointer appearance-auto ${className}`.trim()}
      {...props}
    >
      {children}
    </select>
  );
}
