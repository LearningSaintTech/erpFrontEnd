import { Link } from 'react-router-dom';
import { ArrowRight, PackageCheck } from 'lucide-react';
import { Badge, EmptyState, Section } from '../../../components/erp';
import type { LowStockItem } from '../useDashboardData';

export function LowStockCard({ items, alertCount }: { items: LowStockItem[]; alertCount: number }) {
  return (
    <Section
      title="Low stock"
      description={alertCount > 0 ? `${alertCount.toLocaleString()} materials at or below reorder level` : undefined}
      actions={(
        <Link to="/inventory?tab=alerts" className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--erp-accent)] hover:underline">
          View all <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
      className="flex h-full flex-col"
      flush
      bodyClassName="flex-1"
    >
      {items.length === 0 ? (
        <EmptyState compact icon={PackageCheck} title="Stock levels look healthy" description="Materials appear here when they drop to their reorder level." />
      ) : (
        <ul className="divide-y divide-[var(--erp-border)]">
          {items.map((p) => {
            const out = p.stock <= 0;
            return (
              <li key={p.sku} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-erp-text-primary">{p.name}</p>
                  <p className="truncate font-mono text-xs text-erp-text-muted">{p.sku}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <span className="erp-tabular text-[13px] text-erp-text-secondary">
                    {p.stock.toLocaleString()}
                    {p.reorderLevel != null && <span className="text-erp-text-muted"> / {p.reorderLevel.toLocaleString()}</span>}
                    {p.unit && <span className="ml-1 text-xs text-erp-text-muted">{p.unit}</span>}
                  </span>
                  <Badge tone={out ? 'danger' : 'warning'}>{out ? 'Out' : 'Low'}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
