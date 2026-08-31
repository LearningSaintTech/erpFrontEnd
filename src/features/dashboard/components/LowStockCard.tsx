import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { ErpCard } from '../../../components/erp';
import type { LowStockItem } from '../useDashboardData';

export function LowStockCard({ items, alertCount }: { items: LowStockItem[]; alertCount: number }) {
  return (
    <ErpCard className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[var(--erp-warning-text,#f59e0b)]" />
        <p className="text-sm font-semibold">Low stock</p>
        <span className="ml-auto rounded-full bg-[var(--erp-danger-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--erp-danger-text)]">
          {alertCount}
        </span>
        <Link to="/inventory" className="text-[10px] text-[var(--erp-accent)] hover:underline">View all</Link>
      </div>
      <ul className="space-y-2">
        {items.length === 0 && <li className="text-xs text-erp-text-muted">No low-stock materials</li>}
        {items.map((p) => (
          <li key={p.sku} className="flex items-center justify-between rounded-lg bg-[var(--erp-row-hover)] px-2.5 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{p.name}</p>
              <p className="text-[10px] text-erp-text-muted">{p.sku}</p>
            </div>
            <span className="text-xs font-semibold text-[var(--erp-danger-text)]">
              {p.stock}{p.reorderLevel != null ? ` / ${p.reorderLevel}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </ErpCard>
  );
}
