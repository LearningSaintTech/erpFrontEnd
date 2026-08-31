import type { QualityInspection } from '../../types/api';
import type { GoodsReceiptRef } from '../../types/api.extended';

export const INSPECTION_TYPES = ['INCOMING', 'IN_PROCESS', 'FINAL', 'SAMPLING'] as const;
export const DISPOSITIONS = ['PASS', 'REWORK', 'REJECT'] as const;
export const CAPA_TYPES = ['CORRECTIVE', 'PREVENTIVE'] as const;
export const SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;

const TYPE_LABELS: Record<string, string> = {
  INCOMING: 'Incoming',
  IN_PROCESS: 'In-process',
  FINAL: 'Final',
  SAMPLING: 'Sampling',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  OPEN: 'Open',
  CLOSED: 'Closed',
};

const RESULT_LABELS: Record<string, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  PARTIAL: 'Partial',
  REWORK: 'Rework',
  REJECT: 'Reject',
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

export function statusLabel(status?: string): string {
  return STATUS_LABELS[status ?? ''] || (status ?? '—').replace(/_/g, ' ');
}

export function resultLabel(result?: string): string {
  if (!result) return '—';
  return RESULT_LABELS[result] || result;
}

export function dispositionLabel(d?: string): string {
  if (!d) return '—';
  return RESULT_LABELS[d] || d;
}

export function formatDateTime(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

export function inspectionSummary(i: QualityInspection): string {
  const parts = [typeLabel(i.inspectionType)];
  if (i.stageAtInspection) parts.push(i.stageAtInspection);
  return parts.join(' · ');
}

export function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export const RM_INCOMING_QC_FLOW = [
  { id: 'grn', label: 'GRN submitted', detail: 'Purchase submits GRN → PENDING_QC' },
  { id: 'inspect', label: 'Incoming QC', detail: 'Inspect materials — inspection auto-created on submit' },
  { id: 'pass', label: 'Pass qty', detail: 'Accepted qty receipts to dock or optional RM bin' },
  { id: 'stock', label: 'Stock', detail: 'View balances in Inventory; put away in Warehouse' },
] as const;

export function grnLineSummary(grn?: { lines?: GoodsReceiptRef['lines'] }) {
  if (!grn?.lines?.length) return '—';
  return grn.lines.map((l) => {
    const m = l.materialId;
    const code = typeof m === 'object' && m ? (m.materialCode || m.name) : '';
    const qty = l.receivedQty ?? 0;
    const unit = l.unit || (typeof m === 'object' && m ? m.unit : '');
    return `${code || 'Material'} ${qty}${unit ? ` ${unit}` : ''}`.trim();
  }).join(' · ');
}

export function poNumberFromGrn(grn: GoodsReceiptRef) {
  if (!grn.poId) return '—';
  if (typeof grn.poId === 'string') return grn.poId;
  return grn.poId.poNumber || '—';
}

export function inspectionRefId(insp: QualityInspection): string {
  const ref = insp.referenceId;
  if (!ref) return '';
  return typeof ref === 'string' ? ref : (ref as { _id?: string })._id || '';
}

export function inspectionIdFromGrn(grn: GoodsReceiptRef): string | undefined {
  const insp = grn.qcInspectionId;
  if (!insp) return undefined;
  return typeof insp === 'string' ? insp : insp._id;
}

export function incomingQcSuccessMessage(): string {
  return 'Incoming QC completed — stock posted to inventory';
}

export function qualitySuccessMessage(action: string): string {
  switch (action) {
    case 'incomingComplete': return incomingQcSuccessMessage();
    case 'createIncoming': return 'Incoming inspection ready — enter pass/fail quantities';
    default: return 'Updated';
  }
}
