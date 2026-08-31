import type { ApprovalInstance } from '../../types/api';

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  DESIGN: 'Design',
  SAMPLE: 'Sample',
  SAMPLE_MATERIAL: 'Sample material',
  PRODUCTION_ORDER: 'Production order',
  PURCHASE_REQUISITION: 'Purchase requisition',
  PURCHASE_ORDER: 'Purchase order',
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
  PURCHASE_REQUISITION: 'purchase.approve',
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
  const required = requiredApproverPermissions(instance);
  if (required.some((p) => permissions.includes(p))) return true;
  // Factory admin / general approver escape hatch (same as backend)
  return permissions.includes('approval.approve');
}

export function requiredApproverLabel(instance: ApprovalInstance): string {
  const perms = requiredApproverPermissions(instance);
  const labels: Record<string, string> = {
    'design.approve': 'Design manager / merchandiser',
    'sampling.approve': 'Factory admin / design manager',
    'production.approve': 'Production manager',
    'purchase.approve': 'Purchase Manager',
    'bom.approve': 'BOM approver',
    'approval.approve': 'Factory Admin',
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
