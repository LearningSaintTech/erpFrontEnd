import type { ReactNode } from 'react';

/**
 * Floating action bar pinned to the bottom of long forms / workspaces.
 * Left: status (unsaved changes, completeness, what happens next). Right: actions — one primary.
 */
export function StickyActionBar({
  status,
  children,
  className = '',
}: {
  status?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`sticky bottom-3 z-20 mt-4 rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] py-2.5 pl-3 pr-16 shadow-erp-md sm:pl-4 sm:pr-20 ${className}`.trim()}
      role="region"
      aria-label="Actions"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 text-[13px] text-erp-text-secondary">{status}</div>
        {children && <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>}
      </div>
    </div>
  );
}

/** Small "Unsaved changes" / "All changes saved" indicator for the action bar. */
export function SaveState({ dirty, saving, savedLabel = 'All changes saved' }: { dirty: boolean; saving?: boolean; savedLabel?: string }) {
  if (saving) {
    return <span className="inline-flex items-center gap-1.5 text-erp-text-muted">Saving…</span>;
  }
  return dirty ? (
    <span className="inline-flex items-center gap-1.5 font-medium text-[var(--erp-warning-text)]">
      <span className="h-2 w-2 rounded-full bg-[var(--erp-warning-solid)]" aria-hidden />
      Unsaved changes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-erp-text-muted">
      <span className="h-2 w-2 rounded-full bg-[var(--erp-success-solid)]" aria-hidden />
      {savedLabel}
    </span>
  );
}

/** Thin completeness meter: "3 of 5 sections complete". */
export function Completeness({ done, total, label = 'sections complete' }: { done: number; total: number; label?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--erp-surface-muted)]" aria-hidden>
        <span className="block h-full rounded-full bg-[var(--erp-accent)] transition-all" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-erp-text-muted">{done} of {total} {label}</span>
    </span>
  );
}
