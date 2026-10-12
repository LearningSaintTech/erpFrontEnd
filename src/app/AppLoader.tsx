import { Spinner } from '../components/erp';

/**
 * Shown while the session is restored on a full page load (before the shell renders).
 * `fullScreen` for the app boot; compact inside the shell for permission checks.
 */
export function AppLoader({ fullScreen = false, label = 'Loading your workspace…' }: { fullScreen?: boolean; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 bg-[var(--erp-bg,transparent)] ${fullScreen ? 'min-h-screen' : 'min-h-[40vh]'}`}
    >
      {fullScreen && (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--erp-accent)] text-sm font-bold text-white shadow-erp-xs" aria-hidden="true">
          EF
        </span>
      )}
      <span className="flex items-center gap-2 text-[13px] text-erp-text-muted">
        <Spinner size={16} />
        {label}
      </span>
    </div>
  );
}
