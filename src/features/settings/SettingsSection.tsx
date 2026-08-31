import type { ReactNode } from 'react';
import { ErpCard } from '../../components/erp';

export function SettingsSection({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <ErpCard className="!p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-medium text-erp-text-primary">{title}</h3>
          {description && <p className="mt-0.5 text-[10px] text-erp-text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </ErpCard>
  );
}

export function FieldLabel({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-[10px] ${className}`}>
      <span className="mb-0.5 block text-erp-text-muted">{label}</span>
      {hint && <span className="mb-0.5 block text-[9px] text-erp-text-muted/80">{hint}</span>}
      {children}
    </label>
  );
}
