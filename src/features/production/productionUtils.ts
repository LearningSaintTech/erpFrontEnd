import type { ProductionBatch, ProductionOrder, SkuRef } from '../../types/api';
import { humanizeStatus } from '../../components/erp';

export const humanStatus = humanizeStatus;

// Fields the production API returns that the shared types do not declare yet.
declare module '../../types/api' {
  interface ProductionOrder {
    /** Pieces accepted by final QC — drives completion and progress. */
    passedQuantity?: number;
    /** Pieces rejected by in-process + final QC. */
    rejectedQuantity?: number;
    /** List endpoint only: qty a new batch may still take (incl. top-up for QC rejects). */
    remainingToBatch?: number;
    /** List endpoint only: batches IN_PROGRESS / REWORK. */
    runningBatches?: number;
    suggestedPrId?: string | { _id: string; prNumber?: string; status?: string };
    /** Detail endpoint populates the MRP snapshot (lines with material refs). */
    mrpId?: string | OrderMrp;
    bomId?: string | { _id: string; bomCode?: string };
    designId?: string | { _id: string; designCode?: string; title?: string };
    approvedAt?: string;
    rejectionComments?: string;
    plannedStart?: string;
    plannedEnd?: string;
  }
  interface ProductionBatch {
    rejectedQuantity?: number;
    passedQuantity?: number;
    finalRejectedQuantity?: number;
    /** Stage list frozen at batch creation. */
    stages?: string[];
    closedReason?: string;
    stageHistory?: { stage?: string; startedAt?: string; completedAt?: string; completedBy?: string }[];
    stageQcPassed?: Record<string, boolean>;
    machineId?: string | { _id: string; machineCode?: string; name?: string; machineType?: string };
    shiftId?: string | { _id: string; name?: string; startTime?: string; endTime?: string };
    workerIds?: Array<string | { _id: string; firstName?: string; lastName?: string }>;
    issuedMaterials?: {
      materialId?: string | { _id: string; materialCode?: string; name?: string; unit?: string };
      quantity?: number; unit?: string; unitCost?: number; extendedCost?: number;
    }[];
    /** Detail endpoint only: this batch's QC inspections. */
    inspections?: {
      _id: string; inspectionNumber?: string; inspectionType?: string; stageAtInspection?: string; status?: string;
      result?: string; disposition?: string; passedQuantity?: number; failedQuantity?: number; completedAt?: string;
    }[];
    createdAt?: string;
    updatedAt?: string;
  }
}

export interface OrderMrpLine {
  materialId?: string | { _id: string; materialCode?: string; name?: string; unit?: string };
  requiredQty?: number;
  availableQty?: number;
  shortageQty?: number;
  onOrderQty?: number;
  netShortageQty?: number;
  unit?: string;
  extendedCost?: number;
}

export interface OrderMrp {
  _id: string;
  lines?: OrderMrpLine[];
  hasShortage?: boolean;
  totalCost?: number;
}

/** Order workflow shown as a StepFlow in the order drawer. */
export const ORDER_FLOW = [
  { id: 'CREATED', label: 'Created' },
  { id: 'MRP_DONE', label: 'Materials planned' },
  { id: 'MATERIAL_RESERVED', label: 'Reserved' },
  { id: 'APPROVAL_PENDING', label: 'Approval' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'IN_PROGRESS', label: 'In production' },
  { id: 'COMPLETED', label: 'Completed' },
] as const;

/** Stages that need a passed in-process QC before they can be completed (mirrors the API). */
const QC_GATED_STAGES = new Set(['CUTTING', 'SEWING', 'STITCHING', 'FINISHING', 'PACKING']);

export function stageNeedsQc(batch: ProductionBatch): boolean {
  const stage = batch.currentStage;
  if (!stage || !QC_GATED_STAGES.has(stage)) return false;
  return !batch.stageQcPassed?.[stage];
}

export function batchStages(batch: ProductionBatch, fallback: string[] = []): string[] {
  return batch.stages?.length ? batch.stages : fallback;
}

/** "CUTTING" → "Cutting". */
export function stageLabel(stage?: string): string {
  if (!stage) return '—';
  const s = stage.replace(/_/g, ' ').toLowerCase();
  return stage === 'QC' ? 'QC' : s.charAt(0).toUpperCase() + s.slice(1);
}

export function isBatchRunning(b: ProductionBatch): boolean {
  return ['IN_PROGRESS', 'REWORK'].includes(b.status) && b.currentStage !== 'COMPLETED';
}

export function remainingToBatch(o: ProductionOrder): number {
  return o.remainingToBatch ?? Math.max(0, o.plannedQuantity - (o.producedQuantity || 0));
}

export function refName(ref: unknown, ...keys: string[]): string {
  if (!ref || typeof ref !== 'object') return '';
  const r = ref as Record<string, unknown>;
  for (const k of keys) if (r[k]) return String(r[k]);
  return '';
}

export function personName(u: string | { firstName?: string; lastName?: string }): string {
  if (typeof u === 'string') return u.slice(-6);
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
}

export const ORDER_STATUSES = [
  'CREATED', 'MRP_DONE', 'MATERIAL_RESERVED', 'APPROVAL_PENDING',
  'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
] as const;

export const BATCH_STATUSES = ['CREATED', 'IN_PROGRESS', 'REWORK', 'COMPLETED', 'CANCELLED'] as const;

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export const MACHINE_TYPES = [
  'CUTTING', 'SEWING', 'PRINTING', 'EMBROIDERY', 'WASHING', 'IRONING', 'OTHER',
] as const;

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Created',
  MRP_DONE: 'MRP done',
  MATERIAL_RESERVED: 'RM reserved',
  APPROVAL_PENDING: 'Pending approval',
  APPROVED: 'Approved',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REWORK: 'Rework',
  PLANNED: 'Planned',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function priorityLabel(priority?: string): string {
  return priority ? (PRIORITY_LABELS[priority] || priority) : '—';
}

export function formatDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function skuLabel(sku?: string | SkuRef): string {
  if (!sku) return '—';
  if (typeof sku === 'string') return sku.slice(-8);
  return sku.skuCode || sku.name || '—';
}

export function orderLabel(order?: string | ProductionOrder): string {
  if (!order) return '—';
  if (typeof order === 'string') return order.slice(-8);
  return order.orderNumber || '—';
}

export function batchOrderLabel(batch: ProductionBatch): string {
  const o = batch.productionOrderId;
  if (!o || typeof o === 'string') return typeof o === 'string' ? o.slice(-8) : '—';
  return o.orderNumber || '—';
}

export function workflowHint(status: string): string {
  switch (status) {
    case 'CREATED': return 'Run MRP to calculate material requirements';
    case 'MRP_DONE': return 'Reserve raw materials from inventory';
    case 'MATERIAL_RESERVED': return 'Submit for production approval';
    case 'APPROVAL_PENDING': return 'Awaiting approver sign-off';
    case 'APPROVED': return 'Create a batch to start shop-floor work';
    case 'IN_PROGRESS': return 'Batches running — complete stages on shop floor';
    case 'COMPLETED': return 'All planned quantity passed final QC';
    case 'CANCELLED': return 'Order cancelled';
    default: return '';
  }
}

export function isOverdue(order: ProductionOrder): boolean {
  if (!order.deliveryDate || ['COMPLETED', 'CANCELLED'].includes(order.status)) return false;
  return new Date(order.deliveryDate) < new Date();
}

/** Progress = pieces that passed final QC / planned (produced-but-uninspected pieces do not count). */
export function progressPct(order: ProductionOrder): number {
  if (!order.plannedQuantity) return 0;
  return Math.min(100, Math.round(((order.passedQuantity || 0) / order.plannedQuantity) * 100));
}

/** True when the batch sits at the first stage of its own (frozen) stage list — nothing to roll back to. */
export function isFirstStage(batch: ProductionBatch, fallbackStages: string[] = []): boolean {
  const stages = batch.stages?.length ? batch.stages : fallbackStages;
  return stages.length > 0 && stages[0] === batch.currentStage;
}

/** Final QC has posted a result for this batch (passed or rejected pieces recorded). */
export function finalQcDone(batch: ProductionBatch): boolean {
  return (batch.passedQuantity || 0) + (batch.finalRejectedQuantity || 0) > 0;
}

export function batchGoodQty(batch: ProductionBatch): number {
  return Math.max(0, (batch.plannedQuantity || 0) - (batch.rejectedQuantity || 0));
}

export function formatCost(value?: number) {
  if (value == null || Number.isNaN(value) || value === 0) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}
