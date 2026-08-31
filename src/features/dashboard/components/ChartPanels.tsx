import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowRight } from 'lucide-react';
import { ErpCard } from '../../../components/erp';

const COLORS = ['var(--erp-accent)', '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

const tooltipStyle = {
  background: 'var(--erp-glass-elevated)',
  border: '1px solid var(--erp-border)',
  borderRadius: 8,
  fontSize: 11,
  color: 'var(--erp-text-primary)',
};

export function AreaTrendChart({
  title, subtitle, data, dataKey = 'value', link, linkLabel,
}: {
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  dataKey?: string;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <ErpCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {subtitle && <p className="text-[10px] text-erp-text-muted">{subtitle}</p>}
        </div>
        {link && (
          <Link to={link} className="flex items-center gap-1 text-[10px] text-[var(--erp-accent)] hover:underline">
            {linkLabel || 'Details'} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {data.length === 0 ? (
        <p className="py-8 text-center text-xs text-erp-text-muted">No data for this period</p>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--erp-accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--erp-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey={dataKey} stroke="var(--erp-accent)" strokeWidth={2} fill="url(#dashAreaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ErpCard>
  );
}

export function BarStatusChart({
  title, data, link, horizontal,
}: {
  title: string;
  data: { name: string; value: number }[];
  link?: string;
  horizontal?: boolean;
}) {
  return (
    <ErpCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        {link && <Link to={link} className="text-[10px] text-[var(--erp-accent)] hover:underline">View →</Link>}
      </div>
      {data.length === 0 ? (
        <p className="py-8 text-center text-xs text-erp-text-muted">No data</p>
      ) : (
        <div className={horizontal ? 'h-48' : 'h-40'}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout={horizontal ? 'vertical' : 'horizontal'}
              margin={{ top: 4, right: 4, left: horizontal ? 0 : -16, bottom: 0 }}
            >
              {horizontal ? (
                <>
                  <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 9, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                </>
              )}
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="var(--erp-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ErpCard>
  );
}

export function DonutChart({
  title, data, link, centerLabel,
}: {
  title: string;
  data: { name: string; value: number }[];
  link?: string;
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ErpCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        {link && <Link to={link} className="text-[10px] text-[var(--erp-accent)] hover:underline">View →</Link>}
      </div>
      {data.length === 0 ? (
        <p className="py-8 text-center text-xs text-erp-text-muted">No data</p>
      ) : (
        <div className="relative h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          {centerLabel && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold">{centerLabel}</span>
            </div>
          )}
        </div>
      )}
      <ul className="mt-2 space-y-1">
        {data.slice(0, 4).map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-[10px]">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="flex-1 truncate text-erp-text-muted">{d.name}</span>
            <span className="font-medium">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </ErpCard>
  );
}

export function FulfillmentGauge({
  pct, link, label = 'Production orders on track', title = 'Fulfillment rate',
}: {
  pct: number;
  link?: string;
  label?: string;
  title?: string;
}) {
  const content = (
    <ErpCard className="flex h-full flex-col p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <div className="relative h-28 w-28">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--erp-border)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="var(--erp-accent)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${pct * 2.64} 264`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{pct}%</span>
        </div>
        <p className="mt-2 text-center text-[10px] text-erp-text-muted">{label}</p>
      </div>
    </ErpCard>
  );
  return link ? <Link to={link} className="block h-full hover:opacity-95">{content}</Link> : content;
}
