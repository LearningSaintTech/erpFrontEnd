import { useEffect, useState } from 'react';
import { Button, Field, Modal, Textarea } from '../../../components/erp';

/**
 * Legacy controlled comment dialog (still used by design, BOM, production and purchase pages).
 * Now built on the shared Modal. New code should prefer `usePrompt()` from components/erp.
 */
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
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setComments(''); setTouched(false); }
  }, [open]);

  const trimmed = comments.trim();
  const valid = required ? trimmed.length >= minLength : true;
  const submit = () => {
    setTouched(true);
    if (valid) onConfirm(trimmed);
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
      <Field
        label={required ? 'Comment' : 'Comment (optional)'}
        required={required}
        error={touched && !valid ? `Enter at least ${minLength} characters so the submitter knows what to fix.` : undefined}
      >
        <Textarea
          autoFocus
          rows={4}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
          }}
          placeholder={required ? 'Reason' : 'Optional'}
        />
      </Field>
    </Modal>
  );
}
