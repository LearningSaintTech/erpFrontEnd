import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePrompt } from '../../components/erp';
import { designApi } from '../../services/manufacturing';
import type { Design } from '../../types/api';
import { ReleasePatternMasterModal } from './components/ReleasePatternMasterModal';

export type DesignDecision = 'approve' | 'revision' | 'reject' | 'release';

type DesignRef = Pick<Design, '_id'> & Partial<Pick<Design, 'designCode' | 'title'>>;

function refLabel(d: DesignRef) {
  if (d.designCode && d.title) return `${d.designCode} — ${d.title}`;
  return d.designCode || d.title || 'this design';
}

/**
 * Design manager decisions (approve · request revision · reject · release) shared by the
 * library list and the design record. Reasons are collected with usePrompt; release opens
 * the pattern-master picker. Success / error toasts come from mutation meta.
 */
export function useDesignDecisions(opts: { onDone?: (decision: DesignDecision, id: string) => void } = {}) {
  const qc = useQueryClient();
  const prompt = usePrompt();
  const [releaseTarget, setReleaseTarget] = useState<DesignRef | null>(null);

  const invalidate = (id: string, released = false) => {
    qc.invalidateQueries({ queryKey: ['design', id] });
    qc.invalidateQueries({ queryKey: ['design-timeline', id] });
    qc.invalidateQueries({ queryKey: ['designs-page'] });
    qc.invalidateQueries({ queryKey: ['designs'] });
    qc.invalidateQueries({ queryKey: ['design-stats'] });
    qc.invalidateQueries({ queryKey: ['approvals-pending'] });
    qc.invalidateQueries({ queryKey: ['approvals-stats'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    qc.invalidateQueries({ queryKey: ['notifications-recent'] });
    if (released) {
      qc.invalidateQueries({ queryKey: ['pattern-development', id] });
      qc.invalidateQueries({ queryKey: ['pattern-developments'] });
      qc.invalidateQueries({ queryKey: ['pattern-stats'] });
      qc.invalidateQueries({ queryKey: ['designs-released'] });
    }
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => designApi.approve(id),
    meta: { successMessage: 'Design approved', successDescription: 'Release it when it is ready for pattern development.' },
    onSuccess: (_d, id) => { invalidate(id); opts.onDone?.('approve', id); },
  });

  const revisionMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) => designApi.revision(id, comments),
    meta: { successMessage: 'Sent back to the designer for revision' },
    onSuccess: (_d, v) => { invalidate(v.id); opts.onDone?.('revision', v.id); },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) => designApi.reject(id, comments),
    meta: { successMessage: 'Design rejected' },
    onSuccess: (_d, v) => { invalidate(v.id); opts.onDone?.('reject', v.id); },
  });

  const releaseMutation = useMutation({
    mutationFn: ({ id, patternMasterId }: { id: string; patternMasterId: string }) =>
      designApi.release(id, { patternMasterId }),
    meta: { successMessage: 'Design released to pattern', successDescription: 'The pattern master can start the tech pack now.' },
    onSuccess: (_d, v) => {
      setReleaseTarget(null);
      invalidate(v.id, true);
      opts.onDone?.('release', v.id);
    },
  });

  const requestRevision = async (d: DesignRef) => {
    const comments = await prompt({
      title: 'Request revision',
      message: `Tell the designer what to change in ${refLabel(d)}. They can edit and resubmit.`,
      label: 'What needs to change',
      placeholder: 'e.g. Add a back view and confirm the collar shape…',
      minLength: 3,
      confirmLabel: 'Send back',
    });
    if (comments != null) revisionMutation.mutate({ id: d._id, comments });
  };

  const reject = async (d: DesignRef) => {
    const comments = await prompt({
      title: 'Reject design',
      message: `${refLabel(d)} will be closed. The designer can clone it to start again.`,
      label: 'Reason',
      minLength: 3,
      tone: 'danger',
      confirmLabel: 'Reject design',
    });
    if (comments != null) rejectMutation.mutate({ id: d._id, comments });
  };

  const pending = approveMutation.isPending || revisionMutation.isPending
    || rejectMutation.isPending || releaseMutation.isPending;

  const releaseModal = (
    <ReleasePatternMasterModal
      open={!!releaseTarget}
      designLabel={releaseTarget ? refLabel(releaseTarget) : undefined}
      loading={releaseMutation.isPending}
      onCancel={() => setReleaseTarget(null)}
      onConfirm={(patternMasterId) => {
        if (releaseTarget) releaseMutation.mutate({ id: releaseTarget._id, patternMasterId });
      }}
    />
  );

  return {
    approve: (d: DesignRef) => approveMutation.mutate(d._id),
    requestRevision,
    reject,
    openRelease: (d: DesignRef) => setReleaseTarget(d),
    releaseModal,
    pending,
    approving: approveMutation.isPending,
  };
}
