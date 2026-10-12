import { Fragment, type ReactNode } from 'react';
import { Check, Inbox, type LucideIcon } from 'lucide-react';

/* ─────────────────────────────── EmptyState ─────────────────────────────── */

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Usually a primary/secondary Button ("New design", "Clear filters"). */
  action?: ReactNode;
  className?: string;
  /** Tighter padding for use inside small cards. */
  compact?: boolean;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className = '', compact }: EmptyStateProps) {
  return (
    <div className={`erp-empty${compact ? ' !py-6' : ''} ${className}`.trim()}>
      <span className="erp-empty-icon" aria-hidden="true"><Icon size={20} /></span>
      <p className="erp-empty-title">{title}</p>
      {description && <p className="erp-empty-description">{description}</p>}
      {action && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────── Skeletons ──────────────────────────────── */

export function Skeleton({ className = '', width, height = 12 }: { className?: string; width?: number | string; height?: number | string }) {
  return <span className={`erp-skeleton ${className}`.trim()} style={{ width: width ?? '100%', height }} aria-hidden="true" />;
}

const WIDTHS = ['72%', '48%', '60%', '36%', '54%', '42%', '66%', '30%'];

/**
 * Placeholder rows while a table loads. Use either standalone (renders its own table)
 * or `asRows` inside an existing <tbody>.
 */
export function TableSkeleton({
  rows = 6, columns = 5, asRows = false, showHeader = true,
}: { rows?: number; columns?: number; asRows?: boolean; showHeader?: boolean }) {
  const body = Array.from({ length: rows }).map((_, r) => (
    <tr key={r} aria-hidden="true">
      {Array.from({ length: columns }).map((__, c) => (
        <td key={c}>
          <Skeleton width={c === 0 ? '80%' : WIDTHS[(r + c) % WIDTHS.length]} />
        </td>
      ))}
    </tr>
  ));
  if (asRows) return <>{body}</>;
  return (
    <div role="status" aria-label="Loading" className="erp-table-wrap">
      <table className="erp-data-table">
        {showHeader && (
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, c) => (
                <th key={c}><Skeleton width={c === 0 ? 90 : 60} height={10} /></th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>{body}</tbody>
      </table>
      <span className="erp-sr-only">Loading…</span>
    </div>
  );
}

/* ──────────────────────────── DescriptionList ───────────────────────────── */

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
  /** Span full row. */
  full?: boolean;
  hidden?: boolean;
}

/**
 * Key/value grid for detail views (drawer bodies, record headers).
 *   <DescriptionList columns={2} items={[{ label: 'Vendor', value: po.vendorName }, …]} />
 */
export function DescriptionList({
  items, columns = 2, className = '', emptyValue = '—',
}: { items: DescriptionItem[]; columns?: 1 | 2 | 3; className?: string; emptyValue?: ReactNode }) {
  return (
    <dl className={`erp-dl ${className}`.trim()} data-cols={columns}>
      {items.filter((i) => !i.hidden).map((item, idx) => (
        <div key={idx} className={item.full ? 'col-span-full' : undefined}>
          <dt>{item.label}</dt>
          <dd>{item.value === null || item.value === undefined || item.value === '' ? emptyValue : item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ─────────────────────────────── StepFlow ───────────────────────────────── */

export type StepState = 'done' | 'current' | 'upcoming' | 'blocked';

export interface Step {
  id: string;
  label: ReactNode;
  /** Small line under the label: date, owner, count. */
  description?: ReactNode;
  state?: StepState;
  onClick?: () => void;
}

/**
 * Horizontal (or vertical) workflow progress — e.g. Design → Pattern → Sample → SKU/BOM → Production.
 * Pass `current` (step id) to derive states, or set `state` on each step explicitly.
 */
export function StepFlow({
  steps, current, orientation = 'horizontal', className = '', size = 'md',
}: {
  steps: Step[];
  current?: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  size?: 'sm' | 'md';
}) {
  const curIdx = current ? steps.findIndex((s) => s.id === current) : -1;
  const stateOf = (s: Step, i: number): StepState => {
    if (s.state) return s.state;
    if (curIdx < 0) return 'upcoming';
    if (i < curIdx) return 'done';
    if (i === curIdx) return 'current';
    return 'upcoming';
  };
  const dot = size === 'sm' ? 'h-5 w-5 text-[13px]' : 'h-6 w-6 text-xs';
  const vertical = orientation === 'vertical';

  return (
    <ol
      // min-w-0/max-w-full: inside a flex parent the list must shrink and scroll itself
      // rather than stretch the page (a 5-step flow overflowed 375px phones).
      className={`${vertical ? 'flex flex-col' : 'flex w-full min-w-0 max-w-full items-start overflow-x-auto erp-hide-scrollbar'} ${className}`.trim()}
      aria-label="Progress"
    >
      {steps.map((s, i) => {
        const st = stateOf(s, i);
        const last = i === steps.length - 1;
        const circle = st === 'done'
          ? 'bg-[var(--erp-accent)] text-white border-[var(--erp-accent)]'
          : st === 'current'
            ? 'bg-white text-[var(--erp-accent)] border-[var(--erp-accent)] ring-4 ring-[var(--erp-accent-muted)]'
            : st === 'blocked'
              ? 'bg-[var(--erp-danger-bg)] text-[var(--erp-danger-text)] border-[var(--erp-danger-border)]'
              : 'bg-white text-erp-text-muted border-[var(--erp-border-strong)]';
        const labelCls = st === 'upcoming' ? 'text-erp-text-muted' : 'text-erp-text-primary';
        const Wrapper = s.onClick ? 'button' : 'div';
        const content = (
          <Wrapper
            {...(s.onClick ? { type: 'button' as const, onClick: s.onClick } : {})}
            className={`flex min-w-0 ${vertical ? 'items-start gap-3' : 'flex-col items-center gap-1.5 text-center'} ${s.onClick ? 'cursor-pointer rounded-md hover:opacity-80' : ''}`}
            aria-current={st === 'current' ? 'step' : undefined}
          >
            <span className={`flex shrink-0 items-center justify-center rounded-full border font-semibold ${dot} ${circle}`}>
              {st === 'done' ? <Check size={size === 'sm' ? 12 : 14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`min-w-0 ${vertical ? 'pb-4' : 'px-1'}`}>
              <span className={`block text-[13px] font-medium leading-tight ${labelCls}`}>{s.label}</span>
              {s.description && <span className="mt-0.5 block text-xs text-erp-text-muted">{s.description}</span>}
              <span className="erp-sr-only">
                {st === 'done' ? ' (completed)' : st === 'current' ? ' (current step)' : st === 'blocked' ? ' (blocked)' : ''}
              </span>
            </span>
          </Wrapper>
        );
        if (vertical) {
          return (
            <li key={s.id} className="relative">
              {!last && (
                <span
                  className={`absolute left-3 top-7 h-[calc(100%-1.75rem)] w-px ${st === 'done' ? 'bg-[var(--erp-accent)]' : 'bg-[var(--erp-border-strong)]'}`}
                  style={{ left: size === 'sm' ? 9.5 : 11.5 }}
                  aria-hidden="true"
                />
              )}
              {content}
            </li>
          );
        }
        return (
          <Fragment key={s.id}>
            <li className="flex min-w-[64px] flex-1 justify-center sm:min-w-[88px]">{content}</li>
            {!last && (
              <li aria-hidden="true" className="mt-3 min-w-[8px] flex-1">
                <span className={`block h-px w-full ${st === 'done' ? 'bg-[var(--erp-accent)]' : 'bg-[var(--erp-border-strong)]'}`} />
              </li>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

/* ──────────────────────────────── KpiGrid ───────────────────────────────── */

/**
 * Responsive grid for StatTiles: 2 cols on phones, then 3/4/6 as requested.
 *   <KpiGrid cols={4}>{tiles}</KpiGrid>
 */
export function KpiGrid({ cols = 4, children, className = '' }: { cols?: 2 | 3 | 4 | 6; children: ReactNode; className?: string }) {
  return (
    <div className={`erp-kpi-grid ${className}`.trim()} data-cols={cols}>
      {children}
    </div>
  );
}
