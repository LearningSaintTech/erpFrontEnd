import type { ApprovalInstance } from '../../types/api';

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  DESIGN: 'Design',
  SAMPLE: 'Sample',
  SAMPLE_MATERIAL: 'Sample material',
  PRODUCTION_ORDER: 'Production order',
  PURCHASE_REQUISITION: 'Purchase requisition',
  PURCHASE_ORDER: 'Payment',
  BOM: 'Bill of materials',
};

export function documentTypeLabel(type: string) {
  return DOCUMENT_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

export const DOCUMENT_TYPE_APPROVE_PERMISSION: Record<string, string> = {
  DESIGN: 'design.approve',
  SAMPLE: 'sampling.approve',
  SAMPLE_MATERIAL: 'sampling.approve',
  PRODUCTION_ORDER: 'production.approve',
  PURCHASE_REQUISITION: 'purchase.authorize',
  PURCHASE_ORDER: 'purchase.approve',
  BOM: 'bom.approve',
};

export function requiredApproverPermissions(instance: ApprovalInstance): string[] {
  const wf = typeof instance.workflowId === 'object' ? instance.workflowId : null;
  const level = instance.currentLevel ?? 1;
  const levelConfig = wf?.levels?.find((l) => l.level === level);
  const docPerm = DOCUMENT_TYPE_APPROVE_PERMISSION[instance.documentType] || 'approval.approve';
  // Match backend: only this level's roles (do not merge doc default into every level)
  if (!levelConfig?.approverRoles?.length) return [docPerm];
  return [...levelConfig.approverRoles];
}

/** The earlier level this user already approved on this instance, if any. */
export function approvedEarlierLevel(instance: ApprovalInstance, userId?: string): number | undefined {
  if (!userId) return undefined;
  const current = instance.currentLevel ?? 1;
  const step = (instance.steps || []).find((s) => {
    const by = s.approverId && typeof s.approverId === 'object' ? (s.approverId as { _id?: string })._id : s.approverId;
    return s.action === 'APPROVED' && String(by) === String(userId) && (s.level ?? 0) < current;
  });
  return step?.level;
}

export function canActOnApproval(
  instance: ApprovalInstance,
  permissions: string[],
  userId?: string,
): boolean {
  if (permissions.includes('*')) return true;
  const submitterId = typeof instance.submittedBy === 'object'
    ? instance.submittedBy?._id
    : instance.submittedBy;
  // Match backend: only block self-approval at level 1
  if (
    submitterId
    && userId
    && String(submitterId) === String(userId)
    && (instance.currentLevel ?? 1) <= 1
  ) {
    return false;
  }
  // Match backend: whoever approved an earlier level cannot decide a later one.
  if (approvedEarlierLevel(instance, userId)) return false;
  const required = requiredApproverPermissions(instance);
  if (required.some((p) => permissions.includes(p))) return true;
  if (instance.documentType === 'PURCHASE_REQUISITION') return false;
  // Match backend: general approval authority only where the level names no roles,
  // and only together with the document's own approve permission.
  const wf = typeof instance.workflowId === 'object' ? instance.workflowId : null;
  const levelConfig = wf?.levels?.find((l) => l.level === (instance.currentLevel ?? 1));
  if (levelConfig?.approverRoles?.length) return false;
  const docPerm = DOCUMENT_TYPE_APPROVE_PERMISSION[instance.documentType];
  return permissions.includes('approval.approve') && Boolean(docPerm && permissions.includes(docPerm));
}

export function requiredApproverLabel(instance: ApprovalInstance): string {
  const perms = requiredApproverPermissions(instance);
  const labels: Record<string, string> = {
    'design.approve': 'Design manager / merchandiser',
    'sampling.approve': 'Factory admin / design manager',
    'production.approve': 'Production manager',
    'purchase.approve': 'Purchase staff',
    'purchase.authorize': 'Factory Admin / Super Admin',
    'purchase.pay': 'Finance',
    'bom.approve': 'BOM approver',
    // Same wording as the workflow editor ("Who approves"); held by Factory Admin and several sub-admins.
    'approval.approve': 'General approval authority',
  };
  return perms.map((p) => labels[p] || p).join(' or ') || 'General approver';
}

export function submitterName(submittedBy: ApprovalInstance['submittedBy']) {
  if (!submittedBy || typeof submittedBy === 'string') return 'Unknown';
  const parts = [submittedBy.firstName, submittedBy.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : submittedBy.email || 'Unknown';
}

export function formatAge(submittedAt?: string) {
  if (!submittedAt) return '—';
  const ms = Date.now() - new Date(submittedAt).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function isOverdue(submittedAt?: string, slaHours = 24) {
  if (!submittedAt) return false;
  const ms = Date.now() - new Date(submittedAt).getTime();
  return ms > slaHours * 60 * 60 * 1000;
}

/** SLA (hours) configured for the instance's current level; defaults to 24h. */
export function levelSlaHours(instance: ApprovalInstance) {
  const wf = typeof instance.workflowId === 'object' ? instance.workflowId : null;
  const level = wf?.levels?.find((l) => l.level === (instance.currentLevel ?? 1));
  return level?.slaHours && level.slaHours > 0 ? level.slaHours : 24;
}

export function isOverSla(instance: ApprovalInstance) {
  return instance.status === 'PENDING' && isOverdue(instance.submittedAt, levelSlaHours(instance));
}

export function documentCode(instance: ApprovalInstance) {
  return instance.documentSummary?.code || `…${String(instance.documentId).slice(-8)}`;
}

const STEP_ACTION_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Changes requested',
  DELEGATED: 'Delegated',
  ESCALATED: 'Escalated',
};

export function stepActionLabel(action?: string) {
  if (!action) return 'Updated';
  return STEP_ACTION_LABELS[action] || action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function stepTone(action?: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (action === 'APPROVED') return 'success';
  if (action === 'REJECTED') return 'danger';
  if (action === 'CHANGES_REQUESTED') return 'warning';
  return 'neutral';
}

export function personName(p?: string | { firstName?: string; lastName?: string; email?: string }) {
  if (!p || typeof p === 'string') return 'Approver';
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Approver';
}

/** Why the current user cannot act on a pending item (shown instead of the action buttons). */
export function blockedReason(instance: ApprovalInstance, userId?: string) {
  const submitterId = typeof instance.submittedBy === 'object' ? instance.submittedBy?._id : instance.submittedBy;
  if (userId && submitterId && String(submitterId) === String(userId) && (instance.currentLevel ?? 1) <= 1) {
    return 'You submitted this — another approver must decide';
  }
  const earlier = approvedEarlierLevel(instance, userId);
  if (earlier) {
    return `You approved level ${earlier} — a different approver must decide level ${instance.currentLevel ?? 1}`;
  }
  return `Waiting for ${requiredApproverLabel(instance)}`;
}

export function workflowLevelLabel(instance: ApprovalInstance) {
  const wf = instance.workflowId;
  const max = typeof wf === 'object' && wf?.levels?.length
    ? Math.max(...wf.levels.map((l) => l.level))
    : 1;
  return `Level ${instance.currentLevel ?? 1} of ${max}`;
}

export function documentLink(instance: ApprovalInstance) {
  return instance.documentSummary?.route;
}

export function revisionFeedback(instance: ApprovalInstance): string | undefined {
  const fromDoc = instance.documentSummary?.revisionComments?.trim();
  if (fromDoc) return fromDoc;
  const step = [...(instance.steps || [])]
    .reverse()
    .find((s) => s.action === 'CHANGES_REQUESTED' && s.comments?.trim());
  return step?.comments?.trim();
}

export function rejectionFeedback(instance: ApprovalInstance): string | undefined {
  const fromDoc = instance.documentSummary?.rejectionComments?.trim();
  if (fromDoc) return fromDoc;
  const step = [...(instance.steps || [])]
    .reverse()
    .find((s) => s.action === 'REJECTED' && s.comments?.trim());
  return step?.comments?.trim();
}
