import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: ReactNode;
  to?: string;
}

export function Breadcrumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="erp-breadcrumbs">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={i}>
              <li className="min-w-0 truncate">
                {c.to && !last
                  ? <Link to={c.to}>{c.label}</Link>
                  : <span aria-current={last ? 'page' : undefined}>{c.label}</span>}
              </li>
              {!last && (
                <li aria-hidden="true" className="flex shrink-0 items-center">
                  <ChevronRight size={14} className="text-[var(--erp-gray-400)]" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

interface ErpPageHeaderProps {
  title: ReactNode;
  /** One short plain-language sentence. (Legacy name: `subtitle`.) */
  description?: ReactNode;
  /** @deprecated use `description` */
  subtitle?: ReactNode;
  /** Right-aligned actions. Put the primary button LAST (right-most). */
  actions?: ReactNode;
  /** Convenience slots — rendered as [secondaryActions][primaryAction]. */
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  /** Optional breadcrumbs above the title (the top bar already shows route breadcrumbs). */
  breadcrumbs?: Crumb[];
  /** Inline content next to the title, e.g. a StatusBadge. */
  meta?: ReactNode;
  /** Tabs rendered under the header (e.g. <ErpTabs …/>). */
  tabs?: ReactNode;
  className?: string;
}

/**
 * Page title block.
 *   <ErpPageHeader title="Purchase" description="Raise requisitions, track orders and receive goods."
 *     primaryAction={<Button icon={<Plus size={16} />} onClick={openNew}>New requisition</Button>} />
 */
export function ErpPageHeader({
  title, description, subtitle, actions, primaryAction, secondaryActions, breadcrumbs, meta, tabs, className = '',
}: ErpPageHeaderProps) {
  const desc = description ?? subtitle;
  const hasActions = actions || primaryAction || secondaryActions;
  return (
    <div className={tabs ? `mb-4 ${className}`.trim() : className || undefined}>
      <div className={`erp-page-header${tabs ? ' !mb-3' : ''}`}>
        <div className="erp-page-header-main">
          {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} className="mb-1" />}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="erp-page-title">{title}</h1>
            {meta}
          </div>
          {desc && <p className="erp-page-subtitle">{desc}</p>}
        </div>
        {hasActions && (
          <div className="erp-page-header-actions">
            {actions}
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>
      {tabs}
    </div>
  );
}

/** Alias for new code. */
export const PageHeader = ErpPageHeader;
