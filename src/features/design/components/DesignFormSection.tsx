import type { ReactNode } from 'react';

export function DesignFormSection({
  title,
  hint,
  children,
  columns = 2,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <section className="rounded-lg border border-[var(--erp-border)] p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">{title}</h3>
      {hint && <p className="mt-0.5 text-[10px] text-erp-text-muted">{hint}</p>}
      <div className={columns === 2 ? 'mt-2 grid gap-3 sm:grid-cols-2' : 'mt-2 space-y-3'}>
        {children}
      </div>
    </section>
  );
}
