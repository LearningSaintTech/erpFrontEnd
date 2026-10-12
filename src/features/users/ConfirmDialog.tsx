import { useEffect, useState } from 'react';
import { Button, ErpInput, Field, Modal } from '../../components/erp';

/*
 * Legacy controlled dialogs still imported by other feature pages (BOM, inventory, production,
 * purchase, quality, SKU, warehouse…). Rebuilt on the shared Modal so they get focus trapping,
 * Esc handling and consistent styling. New code should use `useConfirm()` / `usePrompt()`.
 */

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

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger, loading, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!loading) onCancel(); }}
      title={title}
      size="sm"
      role="alertdialog"
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger-solid' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <p className="text-sm leading-relaxed text-erp-text-secondary">{message}</p>
    </Modal>
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
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setValue(''); setTouched(false); }
  }, [open]);

  const valid = value.length >= minLength;
  const submit = () => {
    setTouched(true);
    if (valid) onConfirm(value);
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!loading) onCancel(); }}
      title={title}
      description={message}
      size="sm"
      closeOnOverlayClick={false}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button onClick={submit} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      <Field label={label} error={touched && !valid ? `Enter at least ${minLength} characters.` : undefined}>
        <ErpInput
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        />
      </Field>
    </Modal>
  );
}
