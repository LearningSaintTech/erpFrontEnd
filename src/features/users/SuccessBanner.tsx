import { CheckCircle2, X } from 'lucide-react';

/**
 * Legacy inline success message (still used by several feature pages).
 * New code should use `toast.success()` or mutation `meta.successMessage` instead.
 */
export function SuccessBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--erp-success-border)] bg-[var(--erp-success-bg)] px-3 py-2 text-[13px] text-[var(--erp-success-text)]"
    >
      <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="erp-icon-btn erp-btn-sm !min-h-7 !min-w-7" aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
