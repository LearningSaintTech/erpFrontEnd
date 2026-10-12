import type { SampleWorkflowStepId } from './sampleWorkflowUtils';
import { inferSampleStep, sampleNeedsFitTrial } from './sampleWorkflowUtils';
import { statusLabel } from './sampleUtils';
import type { Sample } from '../../types/api';

export type SampleActionKind =
  | 'confirm'
  | 'comment'
  | 'modal-qc-pass'
  | 'modal-qc-fail'
  | 'modal-fit-trial'
  | 'save-materials';

export interface SampleAction {
  id: string;
  kind: SampleActionKind;
  label: string;
  confirmMessage?: string;
  commentTitle?: string;
  step?: string;
  who: string;
  /** Destructive / negative outcome — shown in red and kept out of the primary slot. */
  danger?: boolean;
}

export function getSampleActions(opts: {
  status: string;
  sampleType?: string;
  canEdit: boolean;
  canAdvanceFloor: boolean;
  canApprove: boolean;
  canInventory: boolean;
  canQc: boolean;
  materialCount: number;
  /** sampling.approve or sampling.create — may abandon a non-terminal sample. */
  canCancel?: boolean;
}): SampleAction[] {
  const {
    status, sampleType, canEdit, canAdvanceFloor, canApprove, canInventory, canQc, materialCount, canCancel,
  } = opts;
  const actions: SampleAction[] = [];
  const floorWho = 'Pattern master / sampling team';

  // REVISION_REQUESTED still holds the last iteration's stock — Reopen (below) releases it first.
  if (canEdit && status === 'CREATED' && materialCount > 0) {
    actions.push({
      id: 'submit-rm',
      kind: 'confirm',
      step: 'submit-material',
      label: 'Submit materials for approval',
      confirmMessage: 'The fabric and trims list goes to the merchandiser for approval. You can still be asked to change it.',
      who: 'Pattern master',
    });
  }

  if (canEdit && status === 'REVISION_REQUESTED') {
    actions.push({
      id: 'reopen',
      kind: 'confirm',
      step: 'reopen',
      label: 'Reopen for rework',
      confirmMessage: 'Reserved stock from the last round is released so you can update the materials and resubmit.',
      who: 'Pattern master',
    });
  }

  if (canApprove && status === 'MATERIAL_REQUEST_PENDING') {
    actions.push(
      {
        id: 'approve-rm',
        kind: 'confirm',
        step: 'approve-material',
        label: 'Approve materials',
        confirmMessage: 'The store keeper can then reserve the fabric and trims.',
        who: 'Merchandiser / manager',
      },
      {
        id: 'request-material-changes',
        kind: 'comment',
        step: 'request-material-changes',
        label: 'Request changes',
        commentTitle: 'Ask the pattern master to change the materials',
        who: 'Merchandiser / manager',
      },
      {
        id: 'reject-rm',
        kind: 'comment',
        step: 'reject-material',
        label: 'Reject materials',
        commentTitle: 'Reject material request',
        who: 'Merchandiser / manager',
        danger: true,
      },
    );
  }

  if (canInventory && status === 'MATERIAL_REQUEST_APPROVED') {
    actions.push({
      id: 'reserve',
      kind: 'confirm',
      step: 'reserve',
      label: 'Reserve stock',
      confirmMessage: 'Required quantities are held for this sample. Available stock goes down; on-hand stays the same until you issue.',
      who: 'Store / inventory',
    });
  }

  if (canInventory && status === 'MATERIAL_RESERVED') {
    actions.push({
      id: 'issue',
      kind: 'confirm',
      step: 'issue',
      label: 'Issue to cutting',
      confirmMessage: 'Reserved materials leave the store and the sample moves to cutting. On-hand stock goes down.',
      who: 'Store / inventory',
    });
  }

  if (canAdvanceFloor && status === 'CUTTING') {
    actions.push({
      id: 'complete-cutting',
      kind: 'confirm',
      step: 'complete-cutting',
      label: 'Mark cutting complete',
      confirmMessage: 'Cut bundles are handed to the sample tailor for stitching.',
      who: floorWho,
    });
  }

  if (canAdvanceFloor && status === 'IN_PROGRESS') {
    actions.push({
      id: 'complete-stitching',
      kind: 'confirm',
      step: 'complete',
      label: 'Mark stitching complete',
      confirmMessage: 'The sample goes to quality inspection.',
      who: floorWho,
    });
  }

  if (canQc && status === 'QC_PENDING') {
    actions.push(
      {
        id: 'qc-pass',
        kind: 'modal-qc-pass',
        label: 'Pass QC',
        who: 'Quality team',
      },
      {
        id: 'qc-fail',
        kind: 'modal-qc-fail',
        label: 'Fail QC',
        who: 'Quality team',
        danger: true,
      },
    );
  }

  if (canAdvanceFloor && status === 'FIT_TRIAL') {
    actions.push({
      id: 'fit-trial',
      kind: 'modal-fit-trial',
      label: 'Record fit session',
      who: floorWho,
    });
  }

  if (canApprove && status === 'FIT_TRIAL') {
    actions.push({
      id: 'revision-fit',
      kind: 'comment',
      step: 'revision',
      label: 'Request revision',
      commentTitle: 'Request a revised sample after the fit trial',
      who: 'Buyer / design manager',
    });
  }

  if (canApprove && status === 'QC_FAILED') {
    actions.push({
      id: 'revision-qc',
      kind: 'comment',
      step: 'revision',
      label: 'Request revised sample',
      commentTitle: 'Request a revised sample after QC failed',
      who: 'Merchandiser / manager',
    });
  }

  if (canApprove && status === 'PENDING_APPROVAL') {
    actions.push(
      {
        id: 'approve',
        kind: 'confirm',
        step: 'approve',
        label: 'Approve sample',
        confirmMessage: 'The sample is approved for bulk production. SKUs can be generated from it.',
        who: 'Buyer / design manager',
      },
      {
        id: 'revision',
        kind: 'comment',
        step: 'revision',
        label: 'Request revision',
        commentTitle: 'Request sample revision',
        who: 'Buyer / design manager',
      },
      {
        id: 'reject',
        kind: 'comment',
        step: 'reject',
        label: 'Reject sample',
        commentTitle: 'Reject sample',
        who: 'Buyer / design manager',
        danger: true,
      },
    );
  }

  if (canCancel && !SAMPLE_CLOSED_STATUSES.includes(status)) {
    actions.push({
      id: 'cancel',
      kind: 'confirm',
      step: 'cancel',
      label: 'Cancel sample',
      confirmMessage: 'Reserved stock is released and open approvals and inspections are closed. This cannot be undone.',
      who: 'Sampling manager',
      danger: true,
    });
  }

  return actions;
}

/** Statuses where no further workflow action applies (COMPLETED is legacy). */
export const SAMPLE_CLOSED_STATUSES = ['APPROVED', 'REJECTED', 'COMPLETED'];

/** Who must act next when the current user has no buttons. */
export function sampleWaitingHint(status: string): { who: string; action: string } {
  const hints: Record<string, { who: string; action: string }> = {
    CREATED: { who: 'Pattern master', action: 'Add fabric and trims, then submit them for approval' },
    REVISION_REQUESTED: { who: 'Pattern master', action: 'Reopen for rework, update the materials and resubmit' },
    MATERIAL_REQUEST_PENDING: { who: 'Merchandiser / design manager', action: 'Approve the material request' },
    MATERIAL_REQUEST_APPROVED: { who: 'Store keeper', action: 'Reserve stock for every material line' },
    MATERIAL_RESERVED: { who: 'Store keeper', action: 'Issue the materials to cutting' },
    CUTTING: { who: 'Pattern master / sampling team', action: 'Cut the pieces and mark cutting complete' },
    IN_PROGRESS: { who: 'Pattern master / sampling team', action: 'Stitch the sample and send it to QC' },
    QC_PENDING: { who: 'QC inspector', action: 'Inspect the sample and pass or fail it' },
    QC_FAILED: { who: 'Design manager', action: 'Request a revised sample' },
    FIT_TRIAL: { who: 'Pattern master / sampling team', action: 'Record the fit session' },
    PENDING_APPROVAL: { who: 'Design manager or buyer', action: 'Approve, request a revision or reject the sample' },
  };
  return hints[status] || { who: 'Assigned role', action: 'Move the sample to its next step' };
}

/** Short verb for the list's action button — says what you'll do, not just "Take action". */
export function sampleActionLabel(status: string): string {
  const labels: Record<string, string> = {
    CREATED: 'Add materials',
    REVISION_REQUESTED: 'Rework sample',
    MATERIAL_REQUEST_PENDING: 'Review materials',
    MATERIAL_REQUEST_APPROVED: 'Reserve stock',
    MATERIAL_RESERVED: 'Issue materials',
    CUTTING: 'Finish cutting',
    IN_PROGRESS: 'Finish stitching',
    QC_PENDING: 'Inspect',
    QC_FAILED: 'Request revision',
    FIT_TRIAL: 'Record fit',
    PENDING_APPROVAL: 'Review sample',
  };
  return labels[status] || 'Take action';
}

export function activeStepGuidanceBody(status: string): string {
  if (status === 'MATERIAL_REQUEST_APPROVED') return 'Materials approved. The store keeper reserves stock, then issues it to cutting.';
  if (status === 'MATERIAL_RESERVED') return 'Stock reserved. The store keeper issues it to cutting next.';
  if (status === 'MATERIAL_REQUEST_PENDING') return 'Waiting for the merchandiser to approve the material request.';
  return sampleWaitingHint(status).action + '.';
}

export function sampleWorkflowSuccessMessage(step: string): string {
  switch (step) {
    case 'submit-material': return 'Materials submitted for approval';
    case 'approve-material': return 'Materials approved — the store can reserve stock';
    case 'reject-material': return 'Material request rejected';
    case 'reserve': return 'Stock reserved';
    case 'issue': return 'Materials issued — sample moved to cutting';
    case 'complete-cutting': return 'Cutting complete — sent to stitching';
    case 'complete': return 'Stitching complete — sent to QC';
    case 'qc-pass': return 'QC passed';
    case 'qc-fail': return 'QC failed';
    case 'fit-trial': return 'Fit session recorded';
    case 'approve': return 'Sample approved for bulk production';
    case 'reject': return 'Sample rejected';
    case 'revision': return 'Revision requested';
    case 'reopen': return 'Sample reopened for rework';
    case 'request-material-changes': return 'Changes requested — back with the pattern master';
    case 'cancel': return 'Sample cancelled — reserved stock released';
    default: return 'Sample updated';
  }
}

export function sampleStepConfirmMessage(step: string): string {
  switch (step) {
    case 'submit-material':
      return 'The fabric and trims list goes to the merchandiser for approval.';
    case 'approve-material':
      return 'The store keeper can then reserve the fabric and trims.';
    case 'reserve':
      return 'Required quantities are held for this sample. On-hand stock stays the same until you issue.';
    case 'issue':
      return 'Reserved materials leave the store and the sample moves to cutting.';
    case 'complete-cutting':
      return 'Cut bundles are handed to the sample tailor for stitching.';
    case 'complete':
      return 'The sample goes to quality inspection.';
    case 'approve':
      return 'The sample is approved for bulk production and SKU planning.';
    case 'reopen':
      return 'The sample reopens so materials can be updated.';
    default:
      return 'This moves the sample to its next step.';
  }
}

export function stepGuidance(
  stepId: SampleWorkflowStepId,
  status: string,
  sampleType?: string,
): { title: string; body: string; state: 'active' | 'done' | 'locked' | 'skipped' } {
  const activeStep = inferSampleStep({ status, sampleType } as Sample);
  const terminal = ['APPROVED', 'REJECTED'].includes(status);

  if (stepId === 'fit' && !sampleNeedsFitTrial(sampleType)) {
    return {
      state: 'skipped',
      title: 'No fit trial for this sample type',
      body: 'It goes straight to buyer approval after QC.',
    };
  }

  if (terminal) {
    return {
      state: 'done',
      title: status === 'APPROVED' ? 'Sample approved' : 'Sample rejected',
      body: status === 'APPROVED'
        ? 'Ready for SKUs and bulk production planning.'
        : 'Create a new sample if the design needs another round.',
    };
  }

  if (stepId === activeStep) {
    return { state: 'active', title: `Now: ${statusLabel(status)}`, body: activeStepGuidanceBody(status) };
  }

  const order: SampleWorkflowStepId[] = ['brief', 'materials', 'cutting', 'stitching', 'qc', 'fit', 'approval'];
  if (order.indexOf(stepId) < order.indexOf(activeStep)) {
    return { state: 'done', title: 'Done', body: 'This step is finished for the current round.' };
  }

  const unlockHints: Record<SampleWorkflowStepId, string> = {
    brief: 'Review the tech pack and sample type.',
    materials: 'Add fabric and trims, then submit them for approval.',
    cutting: 'Opens once materials are issued to cutting.',
    stitching: 'Opens once cutting is complete.',
    qc: 'Opens once stitching is complete.',
    fit: 'Opens after QC passes (fit sample types only).',
    approval: 'Opens after QC or the fit trial.',
  };

  return { state: 'locked', title: 'Not started yet', body: unlockHints[stepId] };
}
