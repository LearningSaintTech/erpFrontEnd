import { AlertTriangle } from 'lucide-react';
import { Button, EmptyRow } from '../../components/erp';
import { toErrorMessage } from '../../utils/errors';

/** Table row shown when a list query fails (query errors are not toasted globally). */
export function QueryErrorRow({ colSpan, error, onRetry, what = 'this list' }: {
  colSpan: number;
  error: unknown;
  onRetry?: () => void;
  what?: string;
}) {
  return (
    <EmptyRow
      colSpan={colSpan}
      icon={AlertTriangle}
      title={`Couldn't load ${what}`}
      action={onRetry ? <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button> : undefined}
    >
      {toErrorMessage(error) || 'Something went wrong.'}
    </EmptyRow>
  );
}
