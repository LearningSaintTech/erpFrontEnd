import { hasPermission } from '../../utils/permissions';
import type { PatternDevelopment } from '../../types/api';
import { patternMasterIdOf } from '../pattern/patternUtils';

export function hasSamplingUpdate(permissions: string[], isSuperAdmin = false) {
  return hasPermission(permissions, 'sampling.update', isSuperAdmin);
}

export function canCreateSample(permissions: string[], isSuperAdmin = false) {
  return hasPermission(permissions, 'sampling.create', isSuperAdmin);
}

export function canApproveSample(permissions: string[], isSuperAdmin = false) {
  return hasPermission(permissions, 'sampling.approve', isSuperAdmin);
}

/** Only the assigned pattern master may edit materials and submit RM. */
export function canEditSampleWorkflow(
  permissions: string[],
  userId: string | undefined,
  patternMasterId: string | undefined,
  isSuperAdmin = false,
) {
  if (isSuperAdmin) return true;
  if (!hasSamplingUpdate(permissions, isSuperAdmin) || !userId || !patternMasterId) return false;
  return patternMasterId === userId;
}

/** Sampling floor (cutting / stitching / fit): sampling team, or assigned pattern master. */
export function isSamplingFloorRole(permissions: string[], isSuperAdmin = false) {
  if (isSuperAdmin) return true;
  return canCreateSample(permissions, isSuperAdmin) && !canApproveSample(permissions, isSuperAdmin);
}

/** Cutting, stitching, fit trial, and later floor steps — pattern master or sampling team. */
export function canAdvanceSampleFloor(
  permissions: string[],
  userId: string | undefined,
  patternMasterId: string | undefined,
  isSuperAdmin = false,
) {
  if (isSuperAdmin) return true;
  if (isSamplingFloorRole(permissions, isSuperAdmin)) return true;
  return canEditSampleWorkflow(permissions, userId, patternMasterId, isSuperAdmin);
}

export function patternMasterByDesign(patterns: PatternDevelopment[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const pd of patterns) {
    const designId = typeof pd.designId === 'string' ? pd.designId : pd.designId?._id;
    const masterId = patternMasterIdOf(pd.patternMasterId);
    if (designId && masterId) map.set(designId, masterId);
  }
  return map;
}

/** Resolve assigned pattern master from API-enriched sample payload. */
export function samplePatternMasterId(
  sample: { patternMasterId?: string | { _id: string } },
): string | undefined {
  const pm = sample.patternMasterId;
  if (!pm) return undefined;
  return typeof pm === 'string' ? pm : pm._id;
}

export function samplingCapabilities(permissions: string[], isSuperAdmin = false) {
  const canCreate = canCreateSample(permissions, isSuperAdmin);
  const canApprove = canApproveSample(permissions, isSuperAdmin);
  const canUpdate = hasSamplingUpdate(permissions, isSuperAdmin);
  const canRead = hasPermission(permissions, 'sampling.read', isSuperAdmin) || canUpdate || canCreate;
  /** Pattern masters: update only on their designs — filter queue. */
  const myWorkOnly = canUpdate && !canCreate && !canApprove;
  return { canRead, canCreate, canApprove, canUpdate, myWorkOnly };
}
