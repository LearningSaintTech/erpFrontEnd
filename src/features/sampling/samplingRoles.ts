import { ALL_SAMPLE_STATUSES } from './sampleWorkflowUtils';

/**
 * Sample statuses the current user can act on — drives the "Needs my action" queue.
 * Mirrors the role checks in getSampleActions().
 */
export function needsMyActionStatuses(caps: {
  isSuperAdmin: boolean;
  canUpdate: boolean;
  canCreate: boolean;
  canApprove: boolean;
  canInventory: boolean;
  canQc: boolean;
}): string[] {
  if (caps.isSuperAdmin) return ALL_SAMPLE_STATUSES.filter((s) => !['APPROVED', 'REJECTED'].includes(s));
  const out = new Set<string>();
  if (caps.canUpdate) ['CREATED', 'REVISION_REQUESTED', 'CUTTING', 'IN_PROGRESS', 'FIT_TRIAL'].forEach((s) => out.add(s));
  if (caps.canCreate && !caps.canApprove) ['CUTTING', 'IN_PROGRESS', 'FIT_TRIAL'].forEach((s) => out.add(s));
  if (caps.canApprove) ['MATERIAL_REQUEST_PENDING', 'PENDING_APPROVAL', 'QC_FAILED', 'FIT_TRIAL'].forEach((s) => out.add(s));
  if (caps.canInventory) ['MATERIAL_REQUEST_APPROVED', 'MATERIAL_RESERVED'].forEach((s) => out.add(s));
  if (caps.canQc) out.add('QC_PENDING');
  return [...out];
}
