export function SuccessBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div
      className="mb-3 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]"
      style={{
        borderColor: 'rgb(22 163 74 / 0.3)',
        background: 'rgb(22 163 74 / 0.08)',
        color: 'var(--erp-success-text)',
      }}
    >
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="ml-4 opacity-70 hover:opacity-100">×</button>
      )}
    </div>
  );
}
