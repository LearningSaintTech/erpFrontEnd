import { useEffect, type ReactNode } from 'react';

/**
 * Fixed modern ERP shell: light workspace, blue accent.
 * Theme tokens live in styles/slate-theme.css — no dark mode / palette switching.
 * `erp-theme` is also put on <body> so portaled UI (modals, drawers, menus, toasts)
 * receives the same scoped styles.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('erp-theme');
  }, []);
  return (
    <div className="erp-theme erp-theme-bg min-h-screen">
      {children}
    </div>
  );
}
