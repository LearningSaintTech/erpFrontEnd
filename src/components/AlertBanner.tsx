import { AlertCircle, X } from 'lucide-react';
import { toErrorMessage } from '../utils/errors';

interface AlertBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function AlertBanner({ message, onDismiss }: AlertBannerProps) {
  const text = toErrorMessage(message);
  if (!text) return null;
  return (
    <div className="erp-alert-error mb-4 flex items-start gap-2" role="alert">
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{text}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="-my-1 -mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-70 hover:bg-white/60 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
