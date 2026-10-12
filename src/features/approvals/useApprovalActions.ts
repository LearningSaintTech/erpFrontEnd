import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { approvalApi } from '../../services/approvals';
import type { ApprovalInstance } from '../../types/api';
import { toast, usePrompt } from '../../components/erp';
import { documentCode } from './approvalUtils';

export type ApprovalActionType = 'approve' | 'reject' | 'changes';

/** Approve / request changes / reject with the standard comment prompts and cache refresh. */
export function useApprovalActions({ onDone }: { onDone?: () => void } = {}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const prompt = usePrompt();

  const invalidate = () => {
    ['approvals-pending', 'approvals-history', 'approvals-stats', 'approval', 'designs', 'designs-page',
      'design-stats', 'samples', 'production-orders', 'purchase-list', 'dashboard-factory']
      .forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  };

  const mutation = useMutation({
    mutationFn: async ({ id, type, comments }: { id: string; type: ApprovalActionType; documentType: string; code: string; comments?: string }) => {
      if (type === 'approve') return approvalApi.approve(id, comments || undefined);
      if (type === 'reject') return approvalApi.reject(id, comments!);
      return approvalApi.requestChanges(id, comments!);
    },
    onSuccess: (_, vars) => {
      invalidate();
      onDone?.();
      const verb = vars.type === 'approve' ? 'approved' : vars.type === 'reject' ? 'rejected' : 'sent back for changes';
      const open = vars.documentType === 'DESIGN' ? '/designs'
        : vars.documentType === 'SAMPLE_MATERIAL' || vars.documentType === 'SAMPLE' ? '/samples' : null;
      toast.success(`${vars.code} ${verb}`, open ? {
        action: { label: vars.documentType === 'DESIGN' ? 'Open designs' : 'Open samples', onClick: () => navigate(open) },
      } : undefined);
    },
  });

  const run = async (item: ApprovalInstance, type: ApprovalActionType) => {
    const code = documentCode(item);
    let comments: string | null;
    if (type === 'approve') {
      comments = await prompt({
        title: `Approve ${code}?`,
        message: 'The submitter is notified. Add a note if it helps them.',
        label: 'Comment (optional)',
        placeholder: 'Optional',
        required: false,
        confirmLabel: 'Approve',
      });
    } else if (type === 'reject') {
      comments = await prompt({
        title: `Reject ${code}?`,
        message: 'Rejection ends this approval. The document cannot be resubmitted as is.',
        label: 'Reason',
        placeholder: 'Explain why this is rejected',
        minLength: 3,
        tone: 'danger',
        confirmLabel: 'Reject',
      });
    } else {
      comments = await prompt({
        title: `Request changes on ${code}`,
        message: 'The document goes back to the submitter with your comments.',
        label: 'What needs to change?',
        placeholder: 'Be specific so it can be fixed in one pass',
        minLength: 3,
        confirmLabel: 'Send back',
      });
    }
    if (comments == null) return;
    mutation.mutate({ id: item._id, type, documentType: item.documentType, code, comments: comments.trim() });
  };

  return { run, isPending: mutation.isPending, pendingId: mutation.isPending ? mutation.variables?.id : undefined };
}
