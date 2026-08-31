import type { Design, DesignUser } from '../../types/api';

export function designerLabel(createdBy?: string | DesignUser) {
  if (!createdBy || typeof createdBy === 'string') return '—';
  const name = `${createdBy.firstName || ''} ${createdBy.lastName || ''}`.trim();
  return name || createdBy.email || '—';
}

export function collectionName(collectionId: Design['collectionId'], collectionCode?: string) {
  if (collectionCode) return collectionCode;
  if (!collectionId) return '—';
  if (typeof collectionId === 'string') return collectionId;
  return collectionId.code || collectionId.name || '—';
}

export function formatDesignPrice(d: Design) {
  if (d.targetPrice == null) return '—';
  return `${d.currency || 'INR'} ${d.targetPrice.toLocaleString()}`;
}

/**
 * True admin / design manager for review UI.
 * Factory admin holds create+approve together — still an admin.
 * A designer who only authors (or got a stray approve grant) is not.
 */
export function isDesignAdmin(permissions: string[], isSuperAdmin: boolean) {
  if (isSuperAdmin || permissions.includes('*')) return true;
  if (!permissions.includes('design.approve')) return false;
  // Design manager / merchandiser — approve without authoring
  if (!permissions.includes('design.create') && !permissions.includes('design.update')) return true;
  // Elevated admins that also hold author perms in the catalog
  return permissions.includes('design.delete')
    || permissions.includes('user.read')
    || permissions.includes('user.update')
    || permissions.includes('approval.approve')
    || permissions.includes('approval.configure')
    || permissions.includes('role.configure');
}

/** Designer author workspace — create/edit drafts; never review decisions. */
export function isDesignerWorkspace(permissions: string[], isSuperAdmin: boolean) {
  if (isDesignAdmin(permissions, isSuperAdmin)) return false;
  return permissions.includes('design.create') || permissions.includes('design.update');
}

export function canViewAllDesigns(permissions: string[], isSuperAdmin: boolean) {
  return isDesignAdmin(permissions, isSuperAdmin) || permissions.includes('user.read');
}

export function canAuthorDesign(permissions: string[], isSuperAdmin: boolean) {
  return isDesignerWorkspace(permissions, isSuperAdmin);
}

export function canEditDesign(permissions: string[], isSuperAdmin: boolean, status?: string) {
  if (!isDesignerWorkspace(permissions, isSuperAdmin)) return false;
  if (!status || status === 'DRAFT' || status === 'REVISION_REQUESTED') return true;
  return false;
}

export function canCreateDesign(permissions: string[], isSuperAdmin: boolean) {
  return isDesignerWorkspace(permissions, isSuperAdmin) && permissions.includes('design.create');
}

/** Approve / reject / revision / release — admins and design managers only. */
export function canShowDesignApproverUi(permissions: string[], isSuperAdmin: boolean) {
  return isDesignAdmin(permissions, isSuperAdmin);
}

export const DESIGN_STATUSES = [
  'DRAFT', 'IN_REVIEW', 'APPROVED', 'RELEASED', 'REJECTED', 'REVISION_REQUESTED',
] as const;

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}
