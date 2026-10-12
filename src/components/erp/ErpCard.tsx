import type { HTMLAttributes, ReactNode } from 'react';

interface ErpCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  children: ReactNode;
  size?: 'default' | 'sm';
  /** Body padding (default true → 16px). */
  padding?: boolean;
  /** Optional header — renders like <Section>. */
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function ErpCard({
  children, size = 'default', padding = true, className = '', title, description, actions, ...props
}: ErpCardProps) {
  const sizeClass = size === 'sm' ? 'erp-card-sm' : 'erp-card';
  if (title || actions) {
    return (
      <div className={`${sizeClass} ${className}`.trim()} {...props}>
        <div className="erp-section-header">
          <div className="min-w-0">
            {title && <h3 className="erp-section-title">{title}</h3>}
            {description && <p className="erp-section-description">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <div className={padding ? 'p-4' : ''}>{children}</div>
      </div>
    );
  }
  return (
    <div className={`${sizeClass}${padding ? ' p-4' : ''} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

/** Alias for new code. */
export const Card = ErpCard;
