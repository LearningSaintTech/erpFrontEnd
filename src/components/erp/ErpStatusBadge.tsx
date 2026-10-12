import type { HTMLAttributes, ReactNode } from 'react';

/** Visual tones used by badges, banners and toasts. */
export type ErpTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Legacy variant names (kept for backward compatibility). */
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
  // In flight / awaiting someone
  APPROVAL_PENDING: 'shipped',
  PENDING_APPROVAL: 'shipped',
  PENDING_QC: 'shipped',
  QC_PENDING: 'shipped',
  IN_PROGRESS: 'shipped',
  ASSIGNED: 'shipped',
  MRP_DONE: 'shipped',
  MATERIAL_RESERVED: 'shipped',
  MATERIAL_REQUEST_PENDING: 'shipped',
  MATERIAL_REQUEST_APPROVED: 'shipped',
  CUTTING: 'shipped',
  FIT_TRIAL: 'shipped',
  SENT: 'shipped',
  PARTIAL: 'shipped',
  STAGED: 'shipped',
  READY_FOR_DISPATCH: 'shipped',
  REWORK: 'pending',
  CHANGES_REQUESTED: 'pending',
  // Done
  COMPLETED: 'delivered',
  RECEIVED: 'delivered',
  CONVERTED: 'delivered',
  CLOSED: 'delivered',
  DISPATCHED: 'delivered',
  PASS: 'delivered',
  PAID: 'delivered',
  RECOVERED: 'delivered',
  // Failed / retired
  QC_FAILED: 'cancelled',
  FAIL: 'cancelled',
  OBSOLETE: 'cancelled',
  OVERRIDDEN: 'cancelled',
  EXPIRED: 'cancelled',
  REVOKED: 'cancelled',
  // Waste awaiting recovery decision; schedule slots not yet started.
  RECORDED: 'pending',
  PLANNED: 'shipped',
};

/**
 * Tone overrides where the legacy 4-variant map is too coarse.
 * DRAFT is neutral (nothing is wrong), retired/inactive records are neutral, not red.
 */
const TONE_OVERRIDES: Record<string, ErpTone> = {
  DRAFT: 'neutral',
  INACTIVE: 'neutral',
  DISCONTINUED: 'neutral',
  OBSOLETE: 'neutral',
  CLOSED: 'neutral',
  LOCKED: 'neutral',
  EXPIRED: 'neutral',
  OVERRIDDEN: 'neutral',
  UNKNOWN: 'neutral',
};

const VARIANT_TONE: Record<ErpStatusVariant, ErpTone> = {
  pending: 'warning',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
};

/** Legacy: status → 4 variants. Unknown statuses map to 'pending'. */
export function statusToVariant(status: string): ErpStatusVariant {
  return STATUS_MAP[status] || 'pending';
}

/** Status → tone. Unknown statuses map to 'neutral'. */
export function statusToTone(status: string): ErpTone {
  const key = (status || '').toUpperCase();
  if (TONE_OVERRIDES[key]) return TONE_OVERRIDES[key];
  const v = STATUS_MAP[key];
  return v ? VARIANT_TONE[v] : 'neutral';
}

const ACRONYMS = new Set(['QC', 'MRP', 'PO', 'PR', 'GRN', 'BOM', 'SKU', 'CAPA', 'ID', 'OK', 'NA', 'FG', 'WIP', 'RM']);

/** "APPROVAL_PENDING" → "Approval pending", "QC_FAILED" → "QC failed". */
export function humanizeStatus(status: string): string {
  if (!status) return '';
  const words = status.replace(/[_-]+/g, ' ').trim().split(/\s+/);
  return words
    .map((w, i) => {
      const up = w.toUpperCase();
      if (ACRONYMS.has(up)) return up;
      const lower = w.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ErpTone;
  /** Show a coloured dot before the label (default true). */
  dot?: boolean;
  children: ReactNode;
}

/** Small rounded label. Use for status, type, counts. */
export function Badge({ tone = 'neutral', dot = true, className = '', children, ...props }: BadgeProps) {
  return (
    <span className={`erp-badge erp-badge-${tone} ${className}`.trim()} {...props}>
      {dot && <span className="erp-badge-dot" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

interface ErpStatusBadgeProps {
  status?: string;
  /** Explicit label; defaults to a human "Sentence case" version of the status. */
  label?: ReactNode;
  /** Force a tone instead of the status map. */
  tone?: ErpTone;
  /** Show a dot (default true). */
  dot?: boolean;
  className?: string;
  /** Legacy: show the raw status text with underscores replaced (old behaviour). */
  raw?: boolean;
}

/** Status pill driven by the shared status → tone map. */
export function ErpStatusBadge({ status = 'UNKNOWN', label, tone, dot = true, className = '', raw }: ErpStatusBadgeProps) {
  const t = tone || statusToTone(status);
  const text = label ?? (raw ? status.replace(/_/g, ' ') : humanizeStatus(status));
  return (
    <Badge tone={t} dot={dot} className={className} title={typeof text === 'string' ? text : undefined}>
      {text}
    </Badge>
  );
}

/** Alias for new code. */
export const StatusBadge = ErpStatusBadge;
