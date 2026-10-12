import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  description?: ReactNode;
  /** ms; default 4000 (errors 6000). 0 = stays until dismissed. */
  duration?: number;
  /** Optional action button, e.g. { label: 'Undo', onClick }. */
  action?: { label: string; onClick: () => void };
  /** Replace an existing toast with the same id instead of stacking. */
  id?: string;
}

interface ToastItem extends ToastOptions {
  id: string;
  type: ToastType;
  message: ReactNode;
}

/* ── tiny external store so `toast.*` works outside React (e.g. MutationCache) ── */
let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let seq = 0;
const MAX_VISIBLE = 5;

function emit() {
  listeners.forEach((l) => l());
}

function push(type: ToastType, message: ReactNode, opts: ToastOptions = {}) {
  const id = opts.id || `t${++seq}`;
  const item: ToastItem = { ...opts, id, type, message };
  items = [...items.filter((t) => t.id !== id), item].slice(-MAX_VISIBLE);
  emit();
  return id;
}

function dismiss(id?: string) {
  items = id ? items.filter((t) => t.id !== id) : [];
  emit();
}

/**
 * Imperative toasts. Requires <ToastProvider /> mounted once (done in App.tsx).
 *
 *   toast.success('Purchase order created', { description: 'PO-0042 sent for approval' });
 *   toast.error(getApiErrorMessage(err));
 */
export const toast = {
  success: (message: ReactNode, opts?: ToastOptions) => push('success', message, opts),
  error: (message: ReactNode, opts?: ToastOptions) => push('error', message, opts),
  info: (message: ReactNode, opts?: ToastOptions) => push('info', message, opts),
  warning: (message: ReactNode, opts?: ToastOptions) => push('warning', message, opts),
  dismiss,
};

const ICONS: Record<ToastType, { Icon: typeof Info; color: string }> = {
  success: { Icon: CheckCircle2, color: 'var(--erp-success-solid)' },
  error: { Icon: XCircle, color: 'var(--erp-danger-solid)' },
  warning: { Icon: AlertTriangle, color: 'var(--erp-warning-solid)' },
  info: { Icon: Info, color: 'var(--erp-info-solid)' },
};

function ToastView({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration ?? (item.type === 'error' ? 6000 : 4000));
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (remaining.current <= 0 || paused) return undefined;
    startedAt.current = Date.now();
    const t = window.setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(t);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, item.id]);

  const { Icon, color } = ICONS[item.type];
  const urgent = item.type === 'error';
  return (
    <div
      className="erp-toast"
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon size={18} style={{ color, marginTop: 1 }} className="shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="erp-toast-title">{item.message}</p>
        {item.description && <div className="erp-toast-description">{item.description}</div>}
        {item.action && (
          <button
            type="button"
            className="erp-btn-link mt-1.5 text-[13px]"
            onClick={() => { item.action?.onClick(); dismiss(item.id); }}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        className="erp-icon-btn erp-btn-sm -mr-1 -mt-1 !min-h-7 !min-w-7"
        aria-label="Dismiss notification"
        onClick={() => dismiss(item.id)}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Renders the toast stack (top-right). Mount once near the app root. */
export function ToastProvider({ children }: { children?: ReactNode }) {
  const list = useSyncExternalStore(subscribe, () => items, () => items);
  return (
    <>
      {children}
      {createPortal(
        <div className="erp-toast-region" aria-label="Notifications" role="region">
          {list.map((t) => <ToastView key={t.id} item={t} />)}
        </div>,
        document.body,
      )}
    </>
  );
}
