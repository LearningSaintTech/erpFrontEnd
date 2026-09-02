import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ErpButton } from './ErpButton';

export const fieldLabel = 'mb-0.5 block text-[11px] font-medium text-erp-text-muted';
export const btnSm = '!px-2.5 !py-1.5 text-[11px]';

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  onClick?: () => void;
  highlight?: 'accent' | 'warn';
}) {
  const cls = [
    'flex min-w-0 items-start gap-2.5 bg-[var(--erp-surface)] px-3 py-2.5 text-left',
    onClick ? 'cursor-pointer hover:bg-[var(--erp-row-hover)]' : '',
    highlight === 'accent' ? 'ring-1 ring-inset ring-[var(--erp-accent)]/35' : '',
    highlight === 'warn' ? 'ring-1 ring-inset ring-amber-500/35' : '',
  ].join(' ');
  const inner = (
    <>
      <Icon
        size={15}
        className={`mt-0.5 shrink-0 ${highlight === 'warn' ? 'text-amber-500' : 'text-[var(--erp-accent)]'}`}
      />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">{label}</p>
        <p className={`text-base font-semibold leading-tight ${highlight === 'warn' ? 'text-amber-700' : 'text-erp-text-primary'}`}>
          {value}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-erp-text-muted">{hint}</p>}
      </div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} title={hint}>
        {inner}
      </button>
    );
  }
  return <div className={cls} title={hint}>{inner}</div>;
}

export function TabShell({ tabs, children }: { tabs?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)]">
      {tabs ? (
        <div className="px-2 pt-1 [&_.erp-tabs]:mb-0 [&_.erp-tabs]:border-[var(--erp-border)]">
          {tabs}
        </div>
      ) : null}
      <div>{children}</div>
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
        <h3 className="text-sm font-semibold text-erp-text-primary">{title}</h3>
        {hint && <p className="mt-0.5 text-[12px] leading-snug text-erp-text-muted">{hint}</p>}
      </div>
      {children ? <div className="flex flex-wrap items-end gap-2">{children}</div> : null}
    </div>
  );
}

export function TablePager({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (!totalPages) return null;
  return (
    <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-4 py-2.5">
      <p className="text-[12px] text-erp-text-muted">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex gap-1">
        <ErpButton variant="secondary" className={btnSm} disabled={page <= 1} onClick={onPrev}>Prev</ErpButton>
        <ErpButton variant="secondary" className={btnSm} disabled={page >= totalPages} onClick={onNext}>Next</ErpButton>
      </div>
    </div>
  );
}

export function ActionStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-end gap-1">{children}</div>;
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="whitespace-nowrap text-[12px] font-medium text-[var(--erp-accent)] hover:underline">
      {children}
    </Link>
  );
}

export function InfoBanner({
  tone = 'muted',
  icon,
  children,
}: {
  tone?: 'muted' | 'accent' | 'warn';
  icon?: ReactNode;
  children: ReactNode;
}) {
  const cls =
    tone === 'warn'
      ? 'border-amber-500/35 bg-amber-500/10 text-amber-900'
      : tone === 'accent'
        ? 'border-[var(--erp-accent)]/30 bg-[var(--erp-accent-muted)] text-erp-text-primary'
        : 'border-[var(--erp-border)] bg-[var(--erp-surface-muted)] text-erp-text-muted';
  return (
    <div className={`mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-[12px] leading-snug ${cls}`}>
      {icon}
      {children}
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-[13px] text-erp-text-muted">
        {children}
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
      <h4 className="text-[13px] font-semibold text-erp-text-primary">{title}</h4>
      {hint && <p className="mt-0.5 mb-3 text-[12px] leading-relaxed text-erp-text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  );
}
