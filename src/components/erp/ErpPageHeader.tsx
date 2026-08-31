import type { ReactNode } from 'react';

interface ErpPageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function ErpPageHeader({ title, subtitle, actions }: ErpPageHeaderProps) {
  return (
    <div className="erp-page-header">
      <div>
        <h2 className="erp-page-title">{title}</h2>
        {subtitle && <p className="erp-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
