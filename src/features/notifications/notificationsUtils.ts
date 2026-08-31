import type { NotificationItem } from '../../types/api';

const EVENT_LABELS: Record<string, string> = {
  'design.approved': 'Design approved',
  'design.rejected': 'Design rejected',
  'design.revision_requested': 'Design revision',
  'design.released': 'Design released',
  'design.submitted': 'Design submitted',
  'pattern.assigned': 'Pattern assigned',
  'pattern.completed': 'Pattern ready for sampling',
  'pattern.fit_revision': 'Pattern revision required',
  'pr.submitted': 'PR submitted',
  'production.materials_ready': 'Materials ready',
  'production.reserve_failed': 'Reserve failed',
  'production.partial_stock': 'Partial stock',
  'batch.completed': 'Batch completed',
  'sample.revision_requested': 'Sample revision',
  'sample.created': 'Sample created',
  'sample.material_pending': 'Sample materials pending',
  'sample.qc_pending': 'Sample QC pending',
  'sample.approved': 'Sample approved',
  'material_master.requested': 'Fabric request',
  'material_master.approved': 'Fabric added to store',
  'material_master.rejected': 'Fabric request declined',
  'approval.pending': 'Approval pending',
  'approval.approved': 'Approved',
  'approval.rejected': 'Rejected',
  'chat.message': 'New chat message',
};

const ROUTE_MAP: Record<string, string> = {
  DESIGN: '/designs',
  PRODUCTION_ORDER: '/production',
  PRODUCTION_BATCH: '/production',
  PURCHASE_REQUISITION: '/purchase',
  PURCHASE_ORDER: '/purchase',
  SAMPLE: '/samples',
  PATTERN: '/pattern',
  APPROVAL: '/approvals',
  QUALITY_INSPECTION: '/quality/inspections',
  CAPA: '/quality/capa',
  CHAT_ROOM: '/chat',
  MATERIAL_MASTER_REQUEST: '/inventory?tab=requests',
};

export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] || eventType.replace(/\./g, ' · ').replace(/_/g, ' ');
}

export function statusLabel(status: string): string {
  return status === 'UNREAD' ? 'Unread' : 'Read';
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function notificationLink(n: NotificationItem): string | null {
  if (!n.referenceType || !n.referenceId) return null;
  if (n.referenceType === 'CHAT_ROOM' || n.eventType === 'chat.message') {
    return `/chat?room=${n.referenceId}`;
  }
  if (n.referenceType === 'MATERIAL_MASTER_REQUEST') return '/inventory?tab=requests';
  const base = ROUTE_MAP[n.referenceType];
  if (!base) return null;
  if (n.referenceType === 'PATTERN') return `${base}?designId=${n.referenceId}`;
  if (n.referenceType === 'SAMPLE') return `${base}?sampleId=${n.referenceId}`;
  if (n.referenceType === 'DESIGN') {
    if (n.eventType === 'pattern.completed') return `/samples?designId=${n.referenceId}&from=pattern`;
    return `${base}/${n.referenceId}`;
  }
  return base;
}

export function isUnread(n: NotificationItem): boolean {
  return n.status === 'UNREAD';
}
