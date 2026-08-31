import { type ReactNode } from 'react';

/**
 * Fixed modern ERP shell: black sidebar, white workspace, blue accent.
 * Theme tokens live in styles/slate-theme.css — no dark mode / palette switching.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <div className="erp-theme erp-theme-bg min-h-screen">
      {children}
    </div>
  );
}
