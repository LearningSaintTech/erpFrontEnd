import { useCallback, useState, type ReactNode } from 'react';
import { ErpButton, Field, Modal, Textarea } from '../components/erp';

interface DialogState {
  open: boolean;
  title: string;
  comments: string;
  resolve?: (value: string | undefined) => void;
}

/**
 * Legacy optional-comment dialog. Kept for compatibility — new code should use
 * `usePrompt()` from components/erp (supports required + min length).
 *
 *   const { ask, CommentDialog } = useCommentDialog();
 *   const comments = await ask('Approve design');  // undefined when cancelled or empty
 *   … render {CommentDialog()} somewhere in the tree.
 */
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
      <Modal
        open
        size="sm"
        title={state.title}
        onClose={() => close(undefined)}
        closeOnOverlayClick={false}
        footer={(
          <>
            <ErpButton variant="secondary" onClick={() => close(undefined)}>Cancel</ErpButton>
            <ErpButton onClick={() => close(state.comments.trim() || undefined)}>Confirm</ErpButton>
          </>
        )}
      >
        <Field label="Comments" hint="Optional">
          <Textarea
            data-autofocus=""
            rows={4}
            value={state.comments}
            onChange={(e) => setState((s) => ({ ...s, comments: e.target.value }))}
            placeholder="Add a note for the record"
          />
        </Field>
      </Modal>
    );
  }, [state, close]);

  return { ask, CommentDialog };
}
