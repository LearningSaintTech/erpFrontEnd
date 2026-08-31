export type ErpStatusVariant = 'pending' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_MAP: Record<string, ErpStatusVariant> = {
  DRAFT: 'pending',
  PENDING: 'pending',
  REVISION_REQUESTED: 'pending',
  SUBMITTED: 'shipped',
  IN_REVIEW: 'shipped',
  SHIPPED: 'shipped',
  APPROVED: 'delivered',
  RELEASED: 'delivered',
  ACTIVE: 'delivered',
  DELIVERED: 'delivered',
  REJECTED: 'cancelled',
  CANCELLED: 'cancelled',
  DISCONTINUED: 'cancelled',
  INACTIVE: 'cancelled',
  LOCKED: 'cancelled',
};

export function statusToVariant(status: string): ErpStatusVariant {
  return STATUS_MAP[status] || 'pending';
}

interface ErpStatusBadgeProps {
  status?: string;
  label?: string;
}

export function ErpStatusBadge({ status = 'UNKNOWN', label }: ErpStatusBadgeProps) {
  const variant = statusToVariant(status);
  return (
    <span className={`erp-status-badge erp-status-${variant}`}>
      {label || status.replace(/_/g, ' ')}
    </span>
  );
}
