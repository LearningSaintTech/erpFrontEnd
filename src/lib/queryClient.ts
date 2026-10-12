import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from '../components/erp/Toast';
import { getApiErrorMessage } from '../utils/errors';

/**
 * Typed mutation `meta` used by the global toast handlers below.
 *
 *   useMutation({ mutationFn, meta: { successMessage: 'Vendor saved' } })
 *   useMutation({ mutationFn, meta: { skipErrorToast: true } })   // page shows its own error
 */
export interface ErpMutationMeta extends Record<string, unknown> {
  /** Toast shown on success. */
  successMessage?: string;
  /** Optional second line for the success toast. */
  successDescription?: string;
  /** Do not show the global error toast. */
  skipErrorToast?: boolean;
  /**
   * Force the global error toast even when the mutation has its own `onError`.
   * (By default mutations with their own onError — the legacy pattern that sets a page
   * banner — are skipped so the user doesn't see the same error twice.)
   */
  errorToast?: boolean;
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: ErpMutationMeta;
  }
}

/** A paged/filtered list response: a plain array or `{ items: [...] }`. */
function isListResult(data: unknown): boolean {
  return Array.isArray(data)
    || (!!data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items));
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // When a list's search/filter/page changes, keep showing the previous rows until the new
      // ones arrive instead of flashing a skeleton (which also closed any open row menu).
      // Only for list results — a detail view switching records must never show the old record.
      placeholderData: (previous: unknown) => (isListResult(previous) ? previous : undefined),
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      const meta = mutation.meta;
      if (meta?.skipErrorToast) return;
      if (mutation.options.onError && !meta?.errorToast) return;
      toast.error(getApiErrorMessage(error), { id: `mutation-error-${mutation.mutationId}` });
    },
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const meta = mutation.meta;
      if (meta?.successMessage) {
        toast.success(meta.successMessage, { description: meta.successDescription });
      }
    },
  }),
});
