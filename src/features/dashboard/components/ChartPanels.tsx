import { createContext, useContext, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowRight, BarChart3, type LucideIcon } from 'lucide-react';
import { EmptyState, Section, Skeleton } from '../../../components/erp';

/** True while the dashboard's first load is in flight — charts show a placeholder, not "No data". */
export const ChartsLoadingContext = createContext(false);

/** Accent first, then distinct hues that stay readable on white. */
export const CHART_COLORS = ['var(--erp-accent)', '#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#a855f7', '#64748b'];

export const chartTooltipStyle = {
  background: 'var(--erp-surface)',
  border: '1px solid var(--erp-border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--erp-text-primary)',
  boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
};

const tick = { fontSize: 12, fill: 'var(--erp-text-muted)' };

type Datum = { name: string; value: number };

function ViewLink({ to, label = 'View' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--erp-accent)] hover:underline">
      {label} <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

/** Card wrapper for a chart with a consistent header and an empty state. */
export function ChartCard({
  title, description, link, linkLabel, isEmpty, emptyTitle = 'No data for this period',
  emptyDescription, emptyIcon = BarChart3, children, className = '',
}: {
  title: string;
  description?: string;
  link?: string;
  linkLabel?: string;
  isEmpty: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyIcon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  const loading = useContext(ChartsLoadingContext);
  return (
    <Section
      title={title}
      description={description}
      actions={link ? <ViewLink to={link} label={linkLabel} /> : undefined}
      className={`flex h-full flex-col ${className}`}
      bodyClassName="flex-1"
    >
      {loading ? (
        <Skeleton height={180} />
      ) : isEmpty ? (
        <EmptyState compact icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      ) : children}
    </Section>
  );
}

export function BarStatusChart({
  title, description, data, link, horizontal, emptyTitle, emptyDescription, valueFormatter,
}: {
  title: string;
  description?: string;
  data: Datum[];
  link?: string;
  horizontal?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  valueFormatter?: (v: number) => string;
}) {
  const height = horizontal ? Math.max(160, data.length * 32 + 24) : 192;
  return (
    <ChartCard
      title={title}
      description={description}
      link={link}
      isEmpty={data.length === 0}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 4, right: 8, left: horizontal ? 4 : -12, bottom: 0 }}
          >
            {horizontal ? (
              <>
                <XAxis type="number" tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={tick} axisLine={false} tickLine={false} />
              </>
            ) : (
              <>
                <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
              </>
            )}
            <Tooltip
              contentStyle={chartTooltipStyle}
              cursor={{ fill: 'var(--erp-surface-muted)' }}
              formatter={valueFormatter ? ((v: unknown) => valueFormatter(Number(v))) as never : undefined}
            />
            <Bar dataKey="value" name="Count" fill="var(--erp-accent)" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function DonutChart({
  title, description, data, link, centerLabel, centerCaption, emptyTitle, emptyDescription,
}: {
  title: string;
  description?: string;
  data: Datum[];
  link?: string;
  centerLabel?: string;
  centerCaption?: string;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard
      title={title}
      description={description}
      link={link}
      isEmpty={data.length === 0 || total === 0}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative h-40 w-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={1} stroke="none">
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="erp-tabular text-xl font-semibold text-erp-text-primary">{centerLabel ?? total.toLocaleString()}</span>
            <span className="text-xs text-erp-text-muted">{centerCaption ?? 'Total'}</span>
          </div>
        </div>
        <ul className="w-full min-w-0 space-y-1.5">
          {data.slice(0, 6).map((d, i) => (
            <li key={d.name} className="flex items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-erp-text-secondary">{d.name}</span>
              <span className="erp-tabular font-medium text-erp-text-primary">{d.value.toLocaleString()}</span>
              <span className="erp-tabular w-10 text-right text-xs text-erp-text-muted">
                {total > 0 ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

/** Ring gauge for a percentage. Shows an empty state when there is nothing to measure. */
export function FulfillmentGauge({
  pct, link, label = 'Orders passed final QC vs planned', title = 'Fulfillment rate',
  isEmpty = false, emptyTitle = 'No production orders yet', emptyDescription,
}: {
  pct: number;
  link?: string;
  label?: string;
  title?: string;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
}) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <ChartCard title={title} link={link} isEmpty={isEmpty} emptyTitle={emptyTitle} emptyDescription={emptyDescription}>
      <div className="flex flex-col items-center justify-center py-2">
        <div className="relative h-32 w-32">
          <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--erp-surface-muted)" strokeWidth="9" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="var(--erp-accent)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={`${safe * 2.64} 264`}
            />
          </svg>
          <span className="erp-tabular absolute inset-0 flex items-center justify-center text-2xl font-semibold text-erp-text-primary">
            {safe}%
          </span>
        </div>
        <p className="mt-3 text-center text-[13px] text-erp-text-muted">{label}</p>
      </div>
    </ChartCard>
  );
}
