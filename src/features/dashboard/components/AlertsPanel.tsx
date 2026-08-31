import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { ErpCard } from '../../../components/erp';
import type { AlertItem } from '../useDashboardData';

const SEVERITY_STYLES = {
  info: { bg: 'var(--erp-accent-muted)', text: 'var(--erp-accent)' },
  warning: { bg: 'var(--erp-warning-bg, rgba(245,158,11,0.15))', text: 'var(--erp-warning-text, #f59e0b)' },
  danger: { bg: 'var(--erp-danger-bg)', text: 'var(--erp-danger-text)' },
};

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <ErpCard className="p-4">
        <p className="text-sm font-semibold">Action required</p>
        <p className="mt-4 text-center text-xs text-erp-text-muted">No urgent items — operations look healthy</p>
      </ErpCard>
    );
  }

  return (
    <ErpCard className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[var(--erp-warning-text,#f59e0b)]" />
        <p className="text-sm font-semibold">Action required</p>
        <span className="ml-auto rounded-full bg-[var(--erp-danger-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--erp-danger-text)]">
          {alerts.length}
        </span>
      </div>
      <ul className="space-y-2">
        {alerts.map((a) => {
          const style = SEVERITY_STYLES[a.severity];
          return (
            <li key={a.id}>
              <Link
                to={a.link}
                className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-[var(--erp-row-hover)]"
                style={{ border: `1px solid ${style.text}22` }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: style.bg, color: style.text }}>
                    {a.count}
                  </span>
                  <span className="text-xs font-medium">{a.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-erp-text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </ErpCard>
  );
}
