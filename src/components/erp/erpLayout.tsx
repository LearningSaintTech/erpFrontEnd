import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Info, X, type LucideIcon,
} from 'lucide-react';
import { ErpButton } from './ErpButton';
import { EmptyState } from './DataDisplay';

/** Form label class for raw <label>/<span> (12px, medium, secondary). Prefer <Field>. */
export const fieldLabel = 'mb-1 block text-xs font-medium text-erp-text-secondary';
/** Small (32px) button override for legacy ErpButton usages. Prefer `size="sm"`. */
export const btnSm = '!min-h-8 !px-2.5 !text-[13px] !gap-1';

/* ─────────────────────────────── StatTile ───────────────────────────────── */

export interface StatTileProps {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  /** Secondary line under the value, e.g. "12 overdue". */
  hint?: ReactNode;
  /** Makes the tile a button (e.g. filter the list below). */
  onClick?: () => void;
  /** Legacy emphasis. 'accent' = selected/primary, 'warn' = needs attention. */
  highlight?: 'accent' | 'warn';
  /** Pressed state when the tile acts as a filter. */
  active?: boolean;
  /** Change indicator, e.g. { value: '+12%', direction: 'up' }. */
  delta?: { value: ReactNode; direction: 'up' | 'down' | 'flat'; /** default true */ upIsGood?: boolean };
  className?: string;
}

/**
 * KPI tile: label · big value · optional hint/delta · optional icon.
 * Put several in a <KpiGrid> (they become individual cards there). Inside legacy
 * "strip" grids (bg-border, no gap) they render flush as before.
 */
export function StatTile({
  icon: Icon, label, value, hint, onClick, highlight, active, delta, className = '',
}: StatTileProps) {
  const warn = highlight === 'warn';
  const selected = active || highlight === 'accent';
  const cls = [
    'erp-stat-tile group relative flex min-w-0 items-start justify-between gap-3 bg-[var(--erp-surface)] px-4 py-3.5 text-left',
    onClick ? 'cursor-pointer transition-colors hover:bg-[var(--erp-surface-muted)] focus-visible:z-[1]' : '',
    selected ? 'erp-stat-tile-selected' : '',
    className,
  ].filter(Boolean).join(' ');

  const deltaGood = delta
    ? delta.direction === 'flat' ? null : (delta.direction === 'up') === (delta.upIsGood ?? true)
    : null;

  const inner = (
    <>
      <div className="min-w-0">
        <p className="erp-kpi-label line-clamp-2" title={typeof label === 'string' ? label : undefined}>{label}</p>
        <p className={`erp-kpi-value mt-1 truncate text-2xl font-semibold leading-8 tracking-tight ${warn ? '!text-[var(--erp-warning-text)]' : ''}`}>
          {value}
        </p>
        {(hint || delta) && (
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-erp-text-muted">
            {delta && (
              <span
                className={`inline-flex shrink-0 items-center gap-0.5 font-medium ${
                  deltaGood == null ? 'text-erp-text-muted' : deltaGood ? 'text-[var(--erp-success-text)]' : 'text-[var(--erp-danger-text)]'
                }`}
              >
                {delta.direction === 'up' && <ArrowUpRight size={12} aria-hidden="true" />}
                {delta.direction === 'down' && <ArrowDownRight size={12} aria-hidden="true" />}
                {delta.value}
              </span>
            )}
            {hint && <span className="line-clamp-2" title={typeof hint === 'string' ? hint : undefined}>{hint}</span>}
          </p>
        )}
      </div>
      {Icon && (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
            warn
              ? 'bg-[var(--erp-warning-bg)] text-[var(--erp-warning-text)]'
              : 'bg-[var(--erp-accent-subtle)] text-[var(--erp-accent)]'
          }`}
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>
      )}
    </>
  );
  const title = typeof hint === 'string' ? hint : undefined;
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} title={title} aria-pressed={active ?? undefined}>
        {inner}
      </button>
    );
  }
  return <div className={cls} title={title}>{inner}</div>;
}

/* ─────────────────────────────── Section ────────────────────────────────── */

/**
 * Card with a header (title, description, actions) and body.
 *   <Section title="Line items" description="…" actions={<Button size="sm">Add</Button>}>…</Section>
 */
export function Section({
  title, description, actions, children, flush = false, className = '', bodyClassName = '', id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** No body padding (tables). */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`erp-card overflow-hidden ${className}`.trim()}>
      {(title || actions) && (
        <header className="erp-section-header">
          <div className="min-w-0">
            {title && <h3 className="erp-section-title">{title}</h3>}
            {description && <p className="erp-section-description">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children != null && (
        <div className={`${flush ? 'erp-table-wrap' : 'p-4'} ${bodyClassName}`.trim()}>{children}</div>
      )}
    </section>
  );
}

/* ─────────────────────────────── FilterBar ──────────────────────────────── */

/**
 * Toolbar above a list: search + filters on the left, "Clear filters", actions on the right.
 *   <FilterBar
 *     search={<SearchInput value={q} onChange={setQ} placeholder="Search POs…" />}
 *     filters={<ErpSelect …/>}
 *     onClear={hasFilters ? clear : undefined}
 *     actions={<Button variant="secondary" icon={<Download size={16} />}>Export</Button>} />
 */
export function FilterBar({
  search, filters, actions, onClear, clearLabel = 'Clear filters', className = '', bordered = true,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  /** Shown only when provided — pass undefined when no filter is active. */
  onClear?: () => void;
  clearLabel?: string;
  className?: string;
  /** Bottom hairline (when used as a card header). */
  bordered?: boolean;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Filters"
      className={`flex flex-wrap items-center gap-2 px-4 py-3 ${bordered ? 'border-b border-[var(--erp-border)]' : ''} ${className}`.trim()}
    >
      {search && <div className="w-full min-w-0 sm:w-72">{search}</div>}
      {filters && <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div>}
      {onClear && (
        <ErpButton variant="ghost" size="sm" onClick={onClear} icon={<X size={14} />}>
          {clearLabel}
        </ErpButton>
      )}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─────────────────────────────── TabShell ───────────────────────────────── */

export function TabShell({ tabs, children }: { tabs?: ReactNode; children: ReactNode }) {
  return (
    <div className="erp-card min-w-0 overflow-hidden">
      {tabs ? (
        <div className="px-3 [&_.erp-tabs]:mb-0 [&_.erp-tabs]:border-[var(--erp-border)]">
          {tabs}
        </div>
      ) : null}
      <div className="erp-tabshell-body min-w-0">{children}</div>
    </div>
  );
}

export function TabToolbar({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--erp-border)] px-4 py-3">
      <div className="min-w-0 max-w-xl">
        <h3 className="text-base font-semibold text-erp-text-primary">{title}</h3>
        {hint && <p className="mt-0.5 text-[13px] leading-snug text-erp-text-muted">{hint}</p>}
      </div>
      {children ? <div className="flex flex-wrap items-end gap-2">{children}</div> : null}
    </div>
  );
}

/* ─────────────────────────────── TablePager ─────────────────────────────── */

/**
 * Pagination bar: "21–40 of 135" (when pageSize is given) or "Page 2 of 7 · 135 results", with prev/next.
 */
export function TablePager({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
  pageSize,
  itemLabel = 'results',
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  pageSize?: number;
  itemLabel?: string;
}) {
  if (!totalPages) return null;
  const fmt = (n: number) => n.toLocaleString();
  const summary = pageSize
    ? (
      <>
        <span className="font-medium text-erp-text-primary">
          {fmt(total === 0 ? 0 : (page - 1) * pageSize + 1)}–{fmt(Math.min(page * pageSize, total))}
        </span>{' '}
        of {fmt(total)} {itemLabel}
      </>
    )
    : (
      <>
        Page <span className="font-medium text-erp-text-primary">{page}</span> of {fmt(totalPages)}
        {' · '}{fmt(total)} {itemLabel}
      </>
    );
  return (
    <nav className="erp-pager sm:pr-20" aria-label="Pagination">
      <p className="erp-tabular" aria-live="polite">{summary}</p>
      <div className="flex items-center gap-1.5">
        <ErpButton
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={onPrev}
          icon={<ChevronLeft size={16} />}
          aria-label="Previous page"
        >
          <span className="hidden sm:inline">Previous</span>
        </ErpButton>
        <ErpButton
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={onNext}
          iconRight={<ChevronRight size={16} />}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
        </ErpButton>
      </div>
    </nav>
  );
}

/* ─────────────────────────────── misc helpers ───────────────────────────── */

export function ActionStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-end gap-1">{children}</div>;
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="whitespace-nowrap text-[13px] font-medium text-[var(--erp-accent)] hover:underline">
      {children}
    </Link>
  );
}

const BANNER_TONE = {
  muted: 'border-[var(--erp-border)] bg-[var(--erp-surface-muted)] text-erp-text-secondary',
  accent: 'border-[var(--erp-info-border)] bg-[var(--erp-info-bg)] text-erp-text-primary',
  info: 'border-[var(--erp-info-border)] bg-[var(--erp-info-bg)] text-erp-text-primary',
  warn: 'border-[var(--erp-warning-border)] bg-[var(--erp-warning-bg)] text-[#78350f]',
  success: 'border-[var(--erp-success-border)] bg-[var(--erp-success-bg)] text-[#065f46]',
  danger: 'border-[var(--erp-danger-border)] bg-[var(--erp-danger-bg)] text-[var(--erp-danger-text)]',
} as const;

/**
 * Inline note / "How it works" banner.
 * `dismissKey` makes it dismissible and remembers the dismissal in localStorage.
 * `inset={false}` removes the legacy mx-4 mt-3 margins (use inside page flow).
 */
export function InfoBanner({
  tone = 'muted',
  icon,
  title,
  children,
  dismissKey,
  inset = true,
  action,
  className = '',
}: {
  tone?: keyof typeof BANNER_TONE;
  icon?: ReactNode;
  title?: ReactNode;
  children: ReactNode;
  dismissKey?: string;
  inset?: boolean;
  action?: ReactNode;
  className?: string;
}) {
  const storageKey = dismissKey ? `erp-banner-dismissed:${dismissKey}` : '';
  const [hidden, setHidden] = useState(() => {
    if (!storageKey) return false;
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (!storageKey) return;
    try { setHidden(localStorage.getItem(storageKey) === '1'); } catch { /* ignore */ }
  }, [storageKey]);
  if (hidden) return null;

  const defaultIcon = tone === 'warn' || tone === 'danger'
    ? <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
    : title ? <Info size={16} className="mt-0.5 shrink-0 text-[var(--erp-info-solid)]" aria-hidden="true" /> : null;

  return (
    <div
      className={`${inset ? 'mx-4 mt-3' : ''} flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-snug ${BANNER_TONE[tone]} ${className}`.trim()}
      role={tone === 'warn' || tone === 'danger' ? 'alert' : undefined}
    >
      {icon ?? defaultIcon}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        {title && <p className="w-full font-semibold text-erp-text-primary">{title}</p>}
        {children}
      </div>
      {action}
      {dismissKey && (
        <button
          type="button"
          className="erp-icon-btn erp-btn-sm -my-1 -mr-1.5 !min-h-7 !min-w-7"
          aria-label="Dismiss"
          onClick={() => {
            setHidden(true);
            try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Table row spanning all columns that shows an EmptyState. */
export function EmptyRow({
  colSpan, children, title, icon, action,
}: {
  colSpan: number;
  /** Legacy: plain message (becomes the title). */
  children?: ReactNode;
  title?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <tr className="hover:!bg-transparent">
      <td colSpan={colSpan} className="!h-auto !p-0">
        {title ? (
          <EmptyState icon={icon} title={title} description={children} action={action} />
        ) : (
          <EmptyState icon={icon} title={children ?? 'Nothing here yet'} action={action} />
        )}
      </td>
    </tr>
  );
}

export function ComposeSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[var(--erp-border)] px-4 py-4">
      <h4 className="text-sm font-semibold text-erp-text-primary">{title}</h4>
      {hint && <p className="mt-0.5 mb-3 text-[13px] leading-relaxed text-erp-text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  );
}
