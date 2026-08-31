import type { ReactNode } from 'react';
import { AlertBanner } from './AlertBanner';

interface QueryStateProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  children: ReactNode;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Failed to load data';
}

export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage = 'No records found',
  loadingMessage = 'Loading…',
  children,
}: QueryStateProps) {
  if (isLoading) {
    return <p className="py-8 text-center text-[11px] text-erp-text-muted">{loadingMessage}</p>;
  }
  if (isError) {
    return <AlertBanner message={errorMessage(error)} />;
  }
  if (isEmpty) {
    return <p className="py-8 text-center text-[11px] text-erp-text-muted">{emptyMessage}</p>;
  }
  return <>{children}</>;
}
