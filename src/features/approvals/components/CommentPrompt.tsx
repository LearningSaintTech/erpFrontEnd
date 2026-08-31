import { useEffect, useState } from 'react';
import { ErpButton } from '../../../components/erp';

export function CommentPrompt({
  open,
  title,
  message,
  required = false,
  minLength = 3,
  confirmLabel = 'Confirm',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  required?: boolean;
  minLength?: number;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: (comments: string) => void;
  onCancel: () => void;
}) {
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (open) setComments('');
  }, [open]);

  if (!open) return null;

  const trimmed = comments.trim();
  const valid = required ? trimmed.length >= minLength : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-erp-text-primary">{title}</h3>
        {message && <p className="mt-1 text-[11px] text-erp-text-muted">{message}</p>}
        <textarea
          autoFocus
          rows={4}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder={required ? 'Reason required (min 3 characters)' : 'Optional comments'}
          className="erp-input mt-3 w-full resize-y !py-2 text-[11px]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={onCancel} disabled={loading}>
            Cancel
          </ErpButton>
          <ErpButton
            className="!px-3 !py-1.5 text-[11px]"
            disabled={!valid || loading}
            onClick={() => onConfirm(trimmed)}
          >
            {loading ? 'Working…' : confirmLabel}
          </ErpButton>
        </div>
      </div>
    </div>
  );
}
