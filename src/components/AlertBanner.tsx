import { toErrorMessage } from '../utils/errors';

interface AlertBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function AlertBanner({ message, onDismiss }: AlertBannerProps) {
  const text = toErrorMessage(message);
  if (!text) return null;
  return (
    <div className="erp-alert-error mb-4 flex items-center justify-between">
      <span>{text}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="ml-4 opacity-70 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  );
}
