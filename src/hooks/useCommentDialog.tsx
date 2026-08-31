import { useCallback, useState, type ReactNode } from 'react';
import { ErpButton } from '../components/erp';

interface DialogState {
  open: boolean;
  title: string;
  comments: string;
  resolve?: (value: string | undefined) => void;
}

export function useCommentDialog() {
  const [state, setState] = useState<DialogState>({
    open: false,
    title: '',
    comments: '',
  });

  const ask = useCallback((title: string) => {
    return new Promise<string | undefined>((resolve) => {
      setState({ open: true, title, comments: '', resolve });
    });
  }, []);

  const close = useCallback((value: string | undefined) => {
    setState((s) => {
      const resolve = s.resolve;
      queueMicrotask(() => resolve?.(value));
      return { open: false, title: '', comments: '' };
    });
  }, []);

  const CommentDialog = useCallback((): ReactNode => {
    if (!state.open) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
        <div className="erp-card w-full max-w-md p-5 shadow-xl">
          <h3 className="mb-3 text-sm font-semibold">{state.title}</h3>
          <textarea
            autoFocus
            rows={4}
            value={state.comments}
            onChange={(e) => setState((s) => ({ ...s, comments: e.target.value }))}
            placeholder="Comments (optional)"
            className="mb-4 w-full rounded border px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" onClick={() => close(undefined)}>Cancel</ErpButton>
            <ErpButton onClick={() => close(state.comments.trim() || undefined)}>Confirm</ErpButton>
          </div>
        </div>
      </div>
    );
  }, [state, close]);

  return { ask, CommentDialog };
}
