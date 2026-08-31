import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ErpButton, ErpInput } from '../../components/erp';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function ModalOverlay({ children, onBackdropClick }: { children: ReactNode; onBackdropClick: () => void }) {
  return createPortal(
    <div
      className="erp-modal-overlay fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/45 p-4"
      onClick={onBackdropClick}
      role="presentation"
    >
      <div className="my-auto flex w-full max-w-sm items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger, loading, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <ModalOverlay onBackdropClick={onCancel}>
      <div className="w-full rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface,var(--erp-header-bg,#fff))] p-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-erp-text-primary">{title}</h3>
        <p className="mt-1.5 text-[11px] leading-snug text-erp-text-muted">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </ErpButton>
          <ErpButton
            className={`!px-3 !py-1.5 text-[11px] ${danger ? '!bg-red-600 hover:!bg-red-700' : ''}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Working…' : confirmLabel}
          </ErpButton>
        </div>
      </div>
    </ModalOverlay>
  );
}

type PromptDialogProps = {
  open: boolean;
  title: string;
  message: string;
  label: string;
  type?: 'text' | 'password';
  minLength?: number;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function PromptDialog({
  open, title, message, label, type = 'text', minLength = 0,
  confirmLabel = 'Save', loading, onConfirm, onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  if (!open) return null;

  const valid = value.length >= minLength;

  return (
    <ModalOverlay onBackdropClick={onCancel}>
      <div className="w-full rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface,var(--erp-header-bg,#fff))] p-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-erp-text-primary">{title}</h3>
        <p className="mt-1 text-[11px] text-erp-text-muted">{message}</p>
        <label className="mt-3 block text-[10px]">
          <span className="mb-0.5 block text-erp-text-muted">{label}</span>
          <ErpInput
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="!py-1.5 !text-[11px] w-full"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && valid && onConfirm(value)}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={onCancel} disabled={loading}>
            Cancel
          </ErpButton>
          <ErpButton className="!px-3 !py-1.5 text-[11px]" disabled={!valid || loading} onClick={() => onConfirm(value)}>
            {loading ? 'Saving…' : confirmLabel}
          </ErpButton>
        </div>
      </div>
    </ModalOverlay>
  );
}
