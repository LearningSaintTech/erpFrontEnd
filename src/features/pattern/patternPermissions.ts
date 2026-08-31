import { hasPermission } from '../../utils/permissions';
import type { PatternDevelopment } from '../../types/api';
import { patternMasterIdOf } from './patternUtils';

/** Assign released designs to a pattern master. */
export function canAssignPattern(permissions: string[], isSuperAdmin = false) {
  return hasPermission(permissions, 'pattern.create', isSuperAdmin);
}

/** Reopen completed development (design manager / approver). */
export function canReopenPattern(permissions: string[], isSuperAdmin = false) {
  return hasPermission(permissions, 'pattern.approve', isSuperAdmin);
}

/** Has pattern.update — pattern master role only in demo matrix. */
export function hasPatternUpdate(permissions: string[], isSuperAdmin = false) {
  return hasPermission(permissions, 'pattern.update', isSuperAdmin);
}

/** Only the assigned pattern master may edit marker, grading, and sign-off. */
export function canEditPatternWorkflow(
  permissions: string[],
  userId: string | undefined,
  patternMasterId: PatternDevelopment['patternMasterId'],
  isSuperAdmin = false,
) {
  if (isSuperAdmin) return true;
  if (!hasPatternUpdate(permissions, isSuperAdmin) || !userId) return false;
  const masterId = patternMasterIdOf(patternMasterId);
  return !!masterId && masterId === userId;
}

export function patternCapabilities(permissions: string[], isSuperAdmin = false) {
  const canAssign = canAssignPattern(permissions, isSuperAdmin);
  const canReopen = canReopenPattern(permissions, isSuperAdmin);
  const canUpdate = hasPatternUpdate(permissions, isSuperAdmin);
  const canRead = hasPermission(permissions, 'pattern.read', isSuperAdmin) || canUpdate || canAssign;
  /** Pattern masters: update only, no assign/reopen — show their queue. */
  const myWorkOnly = canUpdate && !canAssign && !canReopen;
  return { canRead, canAssign, canReopen, canUpdate, myWorkOnly };
}
