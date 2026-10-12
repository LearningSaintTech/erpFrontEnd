import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Catches render errors in a routed page so one broken screen shows a recoverable message
 * instead of blanking the whole app (sidebar and header stay usable).
 * Keyed by location in AppLayout, so navigating away resets it.
 */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep it visible in the console for debugging / e2e problem collection.
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-xl border border-[var(--erp-border)] bg-[var(--erp-surface)] p-6 text-center shadow-[var(--erp-shadow-sm)]" role="alert">
        <AlertTriangle className="mx-auto mb-3 text-[var(--erp-warning,#d97706)]" size={28} aria-hidden="true" />
        <h1 className="text-base font-semibold text-erp-text-primary">This page couldn’t be displayed</h1>
        <p className="mt-1 text-sm text-erp-text-muted">
          Something went wrong while showing this screen. You can reload it or go to another page from the menu.
        </p>
        <button type="button" className="erp-btn-primary mt-4" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}
