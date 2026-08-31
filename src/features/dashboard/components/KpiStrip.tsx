import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Bell, Boxes, CheckCircle2, Factory, IndianRupee,
  Package, ShieldCheck, Trash2, TrendingUp,
} from 'lucide-react';
import type { DashboardKpis } from '../useDashboardData';
import { formatCurrency, formatNumber, formatPct } from '../dashboardUtils';

const KPI_CONFIG: {
  key: keyof DashboardKpis;
  label: string;
  format: (v: number) => string;
  link: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'fulfillmentPct', label: 'Fulfillment', format: formatPct, link: '/production', icon: TrendingUp },
  { key: 'stockValue', label: 'Stock value', format: formatCurrency, link: '/inventory', icon: Package },
  { key: 'openPoValue', label: 'Open PO value', format: formatCurrency, link: '/purchase', icon: IndianRupee },
  { key: 'firstPassYield', label: 'QC yield', format: formatPct, link: '/quality/inspections', icon: ShieldCheck },
  { key: 'batchesInProgress', label: 'Active batches', format: formatNumber, link: '/production', icon: Factory },
  { key: 'dispatchReady', label: 'Dispatch ready', format: formatNumber, link: '/warehouse/dispatch', icon: Boxes },
  { key: 'wasteCost', label: 'Waste cost', format: formatCurrency, link: '/waste', icon: Trash2 },
  { key: 'unreadNotifications', label: 'Unread alerts', format: formatNumber, link: '/notifications', icon: Bell },
];

export function KpiStrip({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      {KPI_CONFIG.map(({ key, label, format, link, icon: Icon }) => (
        <Link key={key} to={link} className="erp-card group block p-3 transition hover:border-[var(--erp-accent)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-erp-text-muted">{label}</span>
            <Icon className="h-3.5 w-3.5 text-erp-text-muted group-hover:text-[var(--erp-accent)]" />
          </div>
          <p className="mt-1 text-lg font-semibold">{format(kpis[key] as number)}</p>
        </Link>
      ))}
    </div>
  );
}

export function SecondaryKpis({ kpis }: { kpis: DashboardKpis }) {
  const items = [
    { label: 'Pending approvals', value: kpis.pendingApprovals, link: '/approvals', icon: AlertTriangle },
    { label: 'QC queue', value: kpis.qcQueue, link: '/quality/inspections', icon: CheckCircle2 },
    { label: 'Low stock', value: kpis.lowStock, link: '/inventory', icon: Package },
    { label: 'Overdue orders', value: kpis.overdueOrders, link: '/production', icon: Factory },
    { label: 'Open CAPA', value: kpis.openCapa, link: '/quality/capa', icon: ShieldCheck },
    { label: 'Period spend', value: formatCurrency(kpis.periodSpend), link: '/reports/financial', icon: IndianRupee, raw: true },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map(({ label, value, link, icon: Icon, raw }) => (
        <Link
          key={label}
          to={link}
          className="flex items-center justify-between rounded-lg border border-erp-border/60 bg-erp-surface/40 px-3 py-2 text-sm hover:border-[var(--erp-accent)]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-3.5 w-3.5 shrink-0 text-erp-text-muted" />
            <span className="truncate text-xs text-erp-text-muted">{label}</span>
          </div>
          <span className="ml-2 font-semibold text-xs">{raw ? value : formatNumber(value as number)}</span>
        </Link>
      ))}
    </div>
  );
}
