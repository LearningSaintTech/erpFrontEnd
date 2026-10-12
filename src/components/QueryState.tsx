import type { ReactNode } from 'react';
import { AlertTriangle, type LucideIcon } from 'lucide-react';
import { EmptyState, TableSkeleton, Skeleton } from './erp/DataDisplay';
import { ErpButton } from './erp/ErpButton';
import { toErrorMessage } from '../utils/errors';

interface QueryStateProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  /** Empty-state title. */
  emptyMessage?: ReactNode;
  emptyDescription?: ReactNode;
  emptyIcon?: LucideIcon;
  /** e.g. a "New …" button or "Clear filters". */
  emptyAction?: ReactNode;
  /** Screen-reader loading text. */
  loadingMessage?: string;
  /** 'block' (default) shows text lines; 'table' shows skeleton table rows; 'inline' a small line. */
  skeleton?: 'table' | 'block' | 'inline';
  skeletonRows?: number;
  skeletonColumns?: number;
  /** Shows a Retry button on error. */
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Standard loading / error / empty wrapper for query-driven content.
 *   <QueryState skeleton="table" isLoading={q.isLoading} isError={q.isError} error={q.error} onRetry={q.refetch}
 *     isEmpty={!rows.length} emptyMessage="No purchase orders yet" emptyAction={<Button…/>}>
 *     <table…/>
 *   </QueryState>
 */
export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage = 'No records found',
  emptyDescription,
  emptyIcon,
  emptyAction,
  loadingMessage = 'Loading…',
  skeleton = 'block',
  skeletonRows = 5,
  skeletonColumns = 5,
  onRetry,
  children,
}: QueryStateProps) {
  if (isLoading) {
    if (skeleton === 'table') {
      return <TableSkeleton rows={skeletonRows} columns={skeletonColumns} />;
    }
    return (
      <div role="status" aria-label={loadingMessage} className={skeleton === 'inline' ? 'py-2' : 'space-y-3 p-4'}>
        {skeleton === 'inline'
          ? <Skeleton width="40%" />
          : (
            <>
              <Skeleton width="45%" height={14} />
              <Skeleton width="90%" />
              <Skeleton width="75%" />
              <Skeleton width="60%" />
            </>
          )}
        <span className="erp-sr-only">{loadingMessage}</span>
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load this data"
        description={toErrorMessage(error) || 'Failed to load data'}
        action={onRetry ? <ErpButton variant="secondary" size="sm" onClick={onRetry}>Try again</ErpButton> : undefined}
      />
    );
  }
  if (isEmpty) {
    return (
      <EmptyState icon={emptyIcon} title={emptyMessage} description={emptyDescription} action={emptyAction} />
    );
  }
  return <>{children}</>;
}
