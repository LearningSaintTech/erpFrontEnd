import type { ReactNode } from 'react';

/** Wraps portaled chat UI so theme tokens + opaque surfaces apply outside the main app shell. */
export function ChatPortalShell({ children }: { children: ReactNode }) {
  return (
    <div className="chat-portal-root erp-theme text-[var(--erp-text-primary)]">
      {children}
    </div>
  );
}
