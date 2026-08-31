import type { ProductionBatch, ProductionOrder, SkuRef } from '../../types/api';

export const ORDER_STATUSES = [
  'CREATED', 'MRP_DONE', 'MATERIAL_RESERVED', 'APPROVAL_PENDING',
  'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
] as const;

export const BATCH_STATUSES = ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'REWORK'] as const;

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
  return new Date(d).toLocaleDateString();
}

export function formatDateTime(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleString();
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
    case 'COMPLETED': return 'All planned quantity produced';
    case 'CANCELLED': return 'Order cancelled';
    default: return '';
  }
}

export function isOverdue(order: ProductionOrder): boolean {
  if (!order.deliveryDate || ['COMPLETED', 'CANCELLED'].includes(order.status)) return false;
  return new Date(order.deliveryDate) < new Date();
}

export function progressPct(order: ProductionOrder): number {
  if (!order.plannedQuantity) return 0;
  return Math.min(100, Math.round(((order.producedQuantity || 0) / order.plannedQuantity) * 100));
}

export function formatCost(value?: number) {
  if (value == null || Number.isNaN(value) || value === 0) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}
