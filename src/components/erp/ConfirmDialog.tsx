import {
  createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Overlay';
import { ErpButton } from './ErpButton';
import { Field, Textarea } from './Field';
import { ErpInput } from './ErpInput';

export interface ConfirmOptions {
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' = red confirm button + warning icon. Default 'primary'. */
  tone?: 'danger' | 'primary';
}

export interface PromptOptions {
  title: ReactNode;
  message?: ReactNode;
  /** Field label, e.g. "Reason for rejection". */
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  /** Value is required (default true). */
  required?: boolean;
  /** Minimum trimmed length (default 1 when required). */
  minLength?: number;
  /** Single-line input instead of textarea. */
  singleLine?: boolean;
  defaultValue?: string;
  inputType?: 'text' | 'password';
}

type Pending =
  | { id: number; kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

let dialogSeq = 0;

const DialogContext = createContext<DialogContextValue | null>(null);

function PromptBody({
  opts, onSubmit, onCancel,
}: { opts: PromptOptions; onSubmit: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(opts.defaultValue ?? '');
  const [touched, setTouched] = useState(false);
  const required = opts.required ?? true;
  const min = opts.minLength ?? (required ? 1 : 0);
  const trimmed = value.trim();
  const invalid = trimmed.length < min;
  const error = touched && invalid
    ? (min > 1 ? `Please enter at least ${min} characters.` : 'This field is required.')
    : undefined;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (invalid) return;
    onSubmit(trimmed);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={opts.title}
      size="sm"
      closeOnOverlayClick={false}
      footer={(
        <>
          <ErpButton variant="secondary" onClick={onCancel}>{opts.cancelLabel || 'Cancel'}</ErpButton>
          <ErpButton
            variant={opts.tone === 'danger' ? 'danger-solid' : 'primary'}
            onClick={() => submit()}
          >
            {opts.confirmLabel || 'Submit'}
          </ErpButton>
        </>
      )}
    >
      <form onSubmit={submit} className="space-y-3">
        {opts.message && <div className="text-sm text-erp-text-secondary">{opts.message}</div>}
        <Field
          label={opts.label || 'Comment'}
          required={required}
          error={error}
          hint={min > 1 && !error ? `Minimum ${min} characters` : undefined}
        >
          {opts.singleLine ? (
            <ErpInput
              type={opts.inputType || 'text'}
              value={value}
              placeholder={opts.placeholder}
              onChange={(e) => setValue(e.target.value)}
              data-autofocus=""
            />
          ) : (
            <Textarea
              rows={4}
              value={value}
              placeholder={opts.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
              }}
              data-autofocus=""
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

/**
 * Mount once at the app root (done in App.tsx). Provides useConfirm() / usePrompt().
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Pending[]>([]);
  const current = queue[0];

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setQueue((q) => [...q, { id: ++dialogSeq, kind: 'confirm', opts, resolve }]);
  }), []);

  const prompt = useCallback((opts: PromptOptions) => new Promise<string | null>((resolve) => {
    setQueue((q) => [...q, { id: ++dialogSeq, kind: 'prompt', opts, resolve }]);
  }), []);

  const queueRef = useRef(queue);
  queueRef.current = queue;

  const finish = useCallback((value: boolean | string | null) => {
    const head = queueRef.current[0];
    if (!head) return;
    setQueue((q) => (q[0] === head ? q.slice(1) : q));
    if (head.kind === 'confirm') head.resolve(value === true);
    else head.resolve(typeof value === 'string' ? value : null);
  }, []);

  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {current?.kind === 'confirm' && (
        <Modal
          open
          role="alertdialog"
          size="sm"
          onClose={() => finish(false)}
          title={(
            <span className="flex items-center gap-2">
              {current.opts.tone === 'danger' && (
                <AlertTriangle size={18} className="shrink-0 text-[var(--erp-danger-solid)]" aria-hidden="true" />
              )}
              {current.opts.title}
            </span>
          )}
          footer={(
            <>
              <ErpButton
                variant="secondary"
                onClick={() => finish(false)}
                data-autofocus={current.opts.tone === 'danger' ? '' : undefined}
              >
                {current.opts.cancelLabel || 'Cancel'}
              </ErpButton>
              <ErpButton
                variant={current.opts.tone === 'danger' ? 'danger-solid' : 'primary'}
                onClick={() => finish(true)}
                data-autofocus={current.opts.tone === 'danger' ? undefined : ''}
              >
                {current.opts.confirmLabel || 'Confirm'}
              </ErpButton>
            </>
          )}
        >
          {current.opts.message
            ? <div className="text-sm leading-relaxed text-erp-text-secondary">{current.opts.message}</div>
            : null}
        </Modal>
      )}
      {current?.kind === 'prompt' && (
        <PromptBody
          key={current.id}
          opts={current.opts}
          onSubmit={(v) => finish(v)}
          onCancel={() => finish(null)}
        />
      )}
    </DialogContext.Provider>
  );
}

function useDialogContext() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useConfirm/usePrompt must be used within <ConfirmProvider>');
  return ctx;
}

/**
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Cancel order?', message: '…', confirmLabel: 'Cancel order', tone: 'danger' }))) return;
 */
export function useConfirm() {
  return useDialogContext().confirm;
}

/**
 *   const prompt = usePrompt();
 *   const reason = await prompt({ title: 'Reject PR', label: 'Reason', minLength: 5, tone: 'danger' });
 *   if (reason == null) return; // cancelled
 */
export function usePrompt() {
  return useDialogContext().prompt;
}
