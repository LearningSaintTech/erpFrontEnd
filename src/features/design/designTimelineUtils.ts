import type { DesignTimelineEntry, DesignTimelineKind } from '../../types/api';

const KIND_LABELS: Record<string, string> = {
  CREATED: 'Created',
  EDIT: 'Saved',
  CLONED: 'Cloned',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REVISION_REQUESTED: 'Revision requested',
  RELEASED: 'Released',
};

const KIND_BADGE: Record<string, string> = {
  CREATED: 'DRAFT',
  EDIT: 'DRAFT',
  CLONED: 'DRAFT',
  SUBMITTED: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  RELEASED: 'RELEASED',
};

export function timelineKindLabel(kind: DesignTimelineKind | string): string {
  return KIND_LABELS[kind] || kind.replace(/_/g, ' ');
}

export function timelineBadgeStatus(kind: DesignTimelineKind | string): string {
  return KIND_BADGE[kind] || 'DRAFT';
}

export function timelineHasComments(entry: DesignTimelineEntry): boolean {
  return !!entry.comments?.trim() && ['REJECTED', 'REVISION_REQUESTED', 'APPROVED'].includes(entry.kind);
}

export function formatTimelineWhen(at?: string): string {
  if (!at) return '—';
  return new Date(at).toLocaleString();
}
