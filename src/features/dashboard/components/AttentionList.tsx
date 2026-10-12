import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, type LucideIcon } from 'lucide-react';
import { Section, Skeleton } from '../../../components/erp';

export interface AttentionItem {
  id: string;
  label: string;
  /** Plain-language line under the label, e.g. "Waiting for your decision". */
  hint: string;
  count: number;
  /** Deep link into the filtered list. */
  link: string;
  icon: LucideIcon;
  tone: 'warning' | 'danger' | 'info';
  /** Optional formatted value shown instead of the count (e.g. ₹ amount). */
  display?: string;
}

const TONE_CLASS: Record<AttentionItem['tone'], string> = {
  warning: 'bg-[var(--erp-warning-bg)] text-[var(--erp-warning-text)]',
  danger: 'bg-[var(--erp-danger-bg)] text-[var(--erp-danger-text)]',
  info: 'bg-[var(--erp-info-bg)] text-[var(--erp-info-text)]',
};

/**
 * "Needs your attention" — one clickable card per queue. Queues with nothing waiting are
 * shown muted so the layout stays stable and the user can see they are clear.
 */
export function AttentionList({
  items, isLoading, title = 'Needs your attention', description,
}: {
  items: AttentionItem[];
  isLoading?: boolean;
  title?: string;
  description?: string;
}) {
  const open = items.filter((i) => i.count > 0);
  const clear = items.filter((i) => i.count <= 0);
  const summary = isLoading
    ? 'Checking your queues…'
    : open.length === 0
      ? 'You are all caught up.'
      : `${open.length} ${open.length === 1 ? 'queue needs' : 'queues need'} action.`;

  if (!isLoading && items.length === 0) return null;

  return (
    <Section title={title} description={description ?? summary}>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-[var(--erp-border)] p-3">
              <Skeleton width="40%" />
              <Skeleton className="mt-2" width="70%" height={20} />
            </div>
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...open, ...clear].map((item) => {
            const Icon = item.icon;
            const done = item.count <= 0;
            return (
              <li key={item.id} className={done ? 'hidden min-w-0 sm:block' : 'min-w-0'}>
                <Link
                  to={item.link}
                  className={`group flex h-full items-center gap-3 rounded-lg border px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-accent)] ${
                    done
                      ? 'border-[var(--erp-border)] bg-[var(--erp-surface)] hover:bg-[var(--erp-surface-muted)]'
                      : 'border-[var(--erp-border-strong)] bg-[var(--erp-surface)] hover:border-[var(--erp-accent)] hover:bg-[var(--erp-surface-muted)]'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                      done ? 'bg-[var(--erp-surface-muted)] text-erp-text-muted' : TONE_CLASS[item.tone]
                    }`}
                    aria-hidden="true"
                  >
                    {done ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-erp-text-primary">{item.label}</span>
                    <span className="block truncate text-xs text-erp-text-muted">
                      {done ? 'Nothing waiting' : item.hint}
                    </span>
                  </span>
                  <span
                    className={`erp-tabular shrink-0 text-xl font-semibold ${done ? 'text-erp-text-muted' : 'text-erp-text-primary'}`}
                  >
                    {item.display ?? item.count.toLocaleString()}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-erp-text-muted group-hover:text-[var(--erp-accent)]" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {!isLoading && clear.length > 0 && open.length > 0 && (
        <p className="mt-3 text-xs text-erp-text-muted sm:hidden">
          Nothing waiting in: {clear.map((c) => c.label.toLowerCase()).join(', ')}.
        </p>
      )}
      {!isLoading && open.length === 0 && (
        <p className="text-[13px] text-erp-text-muted sm:hidden">Nothing is waiting on you right now.</p>
      )}
    </Section>
  );
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
