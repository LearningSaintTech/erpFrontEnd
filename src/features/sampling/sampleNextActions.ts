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
}): SampleAction[] {
  const { status, sampleType, canEdit, canAdvanceFloor, canApprove, canInventory, canQc, materialCount } = opts;
  const actions: SampleAction[] = [];
  const floorWho = 'Pattern master / sampling team';

  if (canEdit && ['CREATED', 'REVISION_REQUESTED'].includes(status)) {
    if (materialCount > 0) {
      actions.push({
        id: 'submit-rm',
        kind: 'confirm',
        step: 'submit-material',
        label: 'Submit fabric & trims request',
        confirmMessage: 'Submit fabric & trims for SAMPLE_MATERIAL approval?',
        who: 'Pattern master',
      });
    }
  }

  if (canEdit && status === 'REVISION_REQUESTED') {
    actions.push({
      id: 'reopen',
      kind: 'confirm',
      step: 'reopen',
      label: 'Reopen for rework',
      confirmMessage: 'Reopen sample so materials can be updated?',
      who: 'Pattern master',
    });
  }

  if (canApprove && status === 'MATERIAL_REQUEST_PENDING') {
    actions.push(
      {
        id: 'approve-rm',
        kind: 'confirm',
        step: 'approve-material',
        label: 'Approve fabric & trims',
        confirmMessage: 'Approve this material request?',
        who: 'Merchandiser / manager',
      },
      {
        id: 'reject-rm',
        kind: 'comment',
        step: 'reject-material',
        label: 'Reject material request',
        commentTitle: 'Reject material request',
        who: 'Merchandiser / manager',
      },
    );
  }

  if (canInventory && status === 'MATERIAL_REQUEST_APPROVED') {
    actions.push({
      id: 'reserve',
      kind: 'confirm',
      step: 'reserve',
      label: 'Reserve stock',
      confirmMessage: 'Reserve required quantities? Available stock decreases; on-hand unchanged until issue.',
      who: 'Store / inventory',
    });
  }

  if (canInventory && status === 'MATERIAL_RESERVED') {
    actions.push({
      id: 'issue',
      kind: 'confirm',
      step: 'issue',
      label: 'Issue to cutting',
      confirmMessage: 'Issue reserved materials to cutting? On-hand stock decreases → sample status CUTTING.',
      who: 'Store / inventory',
    });
  }

  if (canAdvanceFloor && status === 'CUTTING') {
    actions.push({
      id: 'complete-cutting',
      kind: 'confirm',
      step: 'complete-cutting',
      label: 'Complete cutting → stitching',
      confirmMessage: 'Mark cutting complete and hand bundles to sample tailor?',
      who: floorWho,
    });
  }

  if (canAdvanceFloor && status === 'IN_PROGRESS') {
    actions.push({
      id: 'complete-stitching',
      kind: 'confirm',
      step: 'complete',
      label: 'Complete stitching → QC',
      confirmMessage: 'Mark stitching complete and send to quality inspection?',
      who: floorWho,
    });
  }

  if (canQc && status === 'QC_PENDING') {
    const after = sampleNeedsFitTrial(sampleType) ? 'fit trial' : 'buyer review';
    actions.push(
      {
        id: 'qc-pass',
        kind: 'modal-qc-pass',
        label: `Pass QC → ${after}`,
        who: 'Quality team',
      },
      {
        id: 'qc-fail',
        kind: 'modal-qc-fail',
        label: 'Fail QC',
        who: 'Quality team',
      },
    );
  }

  if (canAdvanceFloor && status === 'FIT_TRIAL') {
    actions.push({
      id: 'fit-trial',
      kind: 'modal-fit-trial',
      label: 'Record fit session → buyer review',
      who: floorWho,
    });
  }

  if (canApprove && status === 'QC_FAILED') {
    actions.push({
      id: 'revision-qc',
      kind: 'comment',
      step: 'revision',
      label: 'Request revision',
      commentTitle: 'Request revised sample after QC fail',
      who: 'Merchandiser / manager',
    });
  }

  if (canApprove && status === 'PENDING_APPROVAL') {
    actions.push(
      {
        id: 'approve',
        kind: 'confirm',
        step: 'approve',
        label: 'Approve for bulk production',
        confirmMessage: 'Approve this sample for bulk production and SKU?',
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
      },
    );
  }

  return actions;
}

/** Who must act next when the current user has no buttons. */
export function sampleWaitingHint(status: string): { who: string; action: string } {
  const hints: Record<string, { who: string; action: string }> = {
    CREATED: { who: 'Pattern master', action: 'Add fabric & trims, then submit the RM request' },
    REVISION_REQUESTED: { who: 'Pattern master', action: 'Update materials and resubmit the RM request' },
    MATERIAL_REQUEST_PENDING: { who: 'Merchandiser / design manager', action: 'Approve SAMPLE_MATERIAL in Approvals → Inbox' },
    MATERIAL_REQUEST_APPROVED: { who: 'Store keeper (inventory.update)', action: 'Reserve stock for all material lines' },
    MATERIAL_RESERVED: { who: 'Store keeper (inventory.update)', action: 'Issue fabric & trims → advances to CUTTING' },
    CUTTING: { who: 'Pattern master / sampling team', action: 'Mark cutting complete → hand off to sample tailor' },
    IN_PROGRESS: { who: 'Pattern master / sampling team', action: 'Complete stitching → send to QC' },
    QC_PENDING: { who: 'QC inspector', action: 'Pass or fail on Quality → Inspections (or this sample)' },
    QC_FAILED: { who: 'Design manager', action: 'Request a revised sample' },
    FIT_TRIAL: { who: 'Pattern master / sampling team', action: 'Record fit session results' },
    PENDING_APPROVAL: { who: 'Design manager or buyer', action: 'Approve, request revision, or reject the sample' },
  };
  return hints[status] || { who: 'Assigned role', action: 'Advance the sample workflow' };
}

export function activeStepGuidanceBody(status: string): string {
  if (status === 'MATERIAL_REQUEST_APPROVED') {
    return 'Trims approved. Store must reserve stock, then issue to cutting before the pattern master can cut.';
  }
  if (status === 'MATERIAL_RESERVED') {
    return 'Stock reserved. Store must issue materials to the cutting department.';
  }
  if (status === 'MATERIAL_REQUEST_PENDING') {
    return 'RM request submitted. Approve SAMPLE_MATERIAL in Approvals inbox or via Approve RM below.';
  }
  return 'Use the action buttons above to advance this sample.';
}

export function sampleWorkflowSuccessMessage(step: string): string {
  switch (step) {
    case 'submit-material': return 'RM request submitted — awaiting SAMPLE_MATERIAL approval';
    case 'approve-material': return 'Fabric & trims approved — store keeper can reserve stock';
    case 'reject-material': return 'Material request rejected';
    case 'reserve': return 'Materials reserved — issue to cutting when ready';
    case 'issue': return 'Materials issued — sample moved to cutting (stock decreased)';
    case 'complete-cutting': return 'Cutting complete — hand off to stitching';
    case 'complete': return 'Stitching complete — sent to QC';
    case 'qc-pass': return 'QC passed';
    case 'qc-fail': return 'QC failed — revision may be required';
    case 'fit-trial': return 'Fit trial recorded';
    case 'approve': return 'Sample approved for bulk production';
    case 'reject': return 'Sample rejected';
    case 'revision': return 'Revision requested';
    case 'reopen': return 'Sample reopened for rework';
    default: return 'Sample updated';
  }
}

export function sampleStepConfirmMessage(step: string): string {
  switch (step) {
    case 'submit-material':
      return 'Submit fabric & trims for SAMPLE_MATERIAL approval? Approvers can act here or in Approvals → Inbox.';
    case 'approve-material':
      return 'Approve this material request? Store keeper can reserve stock after approval.';
    case 'reserve':
      return 'Reserve required quantities from factory stock? Available qty decreases; on-hand stays until issue.';
    case 'issue':
      return 'Issue reserved materials to the cutting department? On-hand stock decreases and the sample advances to CUTTING.';
    case 'complete-cutting':
      return 'Mark cutting complete and hand bundles to the sample tailor?';
    case 'complete':
      return 'Mark stitching complete and send the sample to quality inspection?';
    case 'approve':
      return 'Approve this sample for bulk production and SKU planning?';
    case 'reopen':
      return 'Reopen the sample so materials can be updated?';
    default:
      return 'This action advances the sample workflow.';
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
      title: 'Fit trial not required',
      body: `${sampleType || 'This'} sample type goes to buyer approval directly after QC.`,
    };
  }

  if (terminal) {
    return {
      state: 'done',
      title: status === 'APPROVED' ? 'Sample approved' : 'Sample rejected',
      body: status === 'APPROVED'
        ? 'Ready for SKU matrix and bulk production planning.'
        : 'Sample was rejected — create a new iteration if needed.',
    };
  }

  if (stepId === activeStep) {
    return {
      state: 'active',
      title: `Current stage: ${statusLabel(status)}`,
      body: activeStepGuidanceBody(status),
    };
  }

  const order: SampleWorkflowStepId[] = ['brief', 'materials', 'cutting', 'stitching', 'qc', 'fit', 'approval'];
  if (order.indexOf(stepId) < order.indexOf(activeStep)) {
    return { state: 'done', title: 'Completed', body: 'This stage is done for the current iteration.' };
  }

  const unlockHints: Record<SampleWorkflowStepId, string> = {
    brief: 'Review tech pack and sample type before procuring materials.',
    materials: 'Add fabric & trims, then submit for approval.',
    cutting: 'Unlocks after materials are issued to cutting.',
    stitching: 'Unlocks after cutting is marked complete.',
    qc: 'Unlocks after sample stitching is complete.',
    fit: 'Unlocks after QC pass (fit sample types only).',
    approval: 'Unlocks after QC pass or fit trial completion.',
  };

  return {
    state: 'locked',
    title: 'Not yet active',
    body: unlockHints[stepId],
  };
}
