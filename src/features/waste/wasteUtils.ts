import type { WasteRecord } from '../../types/api';

const TYPE_LABELS: Record<string, string> = {
  FABRIC_SCRAP: 'Fabric scrap',
  THREAD_WASTE: 'Thread waste',
  ACCESSORY_WASTE: 'Accessory waste',
  REWORK: 'Rework',
  REJECTED_PIECES: 'Rejected pieces',
  PACKAGING_WASTE: 'Packaging waste',
  MACHINE_TIME: 'Machine time',
  LABOUR_HOURS: 'Labour hours',
  PRODUCTION_SCRAP: 'Production scrap',
};

const STATUS_LABELS: Record<string, string> = {
  RECORDED: 'Recorded',
  RECOVERED: 'Recovered',
};

const RECOVERY_LABELS: Record<string, string> = {
  NONE: 'None',
  RECYCLE: 'Recycle',
  REUSE: 'Reuse',
  DISPOSE: 'Dispose',
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function recoveryLabel(action?: string): string {
  if (!action) return '—';
  return RECOVERY_LABELS[action] || action;
}

export function formatCurrency(n?: number): string {
  if (n == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function formatDateTime(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

export function batchLabel(batch: WasteRecord['batchId']): string {
  if (!batch) return '—';
  if (typeof batch === 'string') return batch.slice(-6);
  return batch.batchNumber || '—';
}

export function materialLabel(mat: WasteRecord['materialId']): string {
  if (!mat) return '—';
  if (typeof mat === 'string') return mat.slice(-6);
  return mat.materialCode ? `${mat.materialCode} — ${mat.name || ''}` : (mat.name || '—');
}

export function skuLabel(sku: WasteRecord['skuId']): string {
  if (!sku) return '—';
  if (typeof sku === 'string') return sku.slice(-6);
  return sku.skuCode || '—';
}

export function recordToChartData(record: Record<string, number> | undefined): { name: string; value: number }[] {
  if (!record) return [];
  return Object.entries(record)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: typeLabel(k), value: v }))
    .sort((a, b) => b.value - a.value);
}
