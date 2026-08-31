import type { TableHTMLAttributes } from 'react';

export function ErpDataTable({ className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={`erp-data-table ${className}`.trim()} {...props} />;
}
