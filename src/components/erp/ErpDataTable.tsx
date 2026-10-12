import type { TableHTMLAttributes } from 'react';

/**
 * Styled table. Helpers: `erp-num` (right-aligned tabular numbers) on th/td,
 * `erp-row-clickable` / `erp-row-selected` on tr, `erp-cell-primary`, `erp-cell-actions` on td.
 * Wrap in a card or `.erp-table-wrap` so it scrolls horizontally inside its container.
 */
export function ErpDataTable({ className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={`erp-data-table ${className}`.trim()} {...props} />;
}
