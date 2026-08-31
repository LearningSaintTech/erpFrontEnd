import type { Bom, BomLine, Material, MrpPreview, Sku } from '../../types/api';

export function skuLabel(skuId: Bom['skuId']) {
  if (!skuId || typeof skuId === 'string') return skuId || '—';
  const s = skuId as Sku;
  return `${s.skuCode} — ${s.name}`;
}

export function skuIdOf(bom: Bom) {
  return typeof bom.skuId === 'string' ? bom.skuId : bom.skuId._id;
}

export function materialIdOf(line: BomLine) {
  return typeof line.materialId === 'string' ? line.materialId : line.materialId._id;
}

export function materialLabel(materialId?: string | Material) {
  if (!materialId || typeof materialId === 'string') return materialId || '—';
  return materialId.materialCode || materialId.name || '—';
}

export function statusLabel(status?: string) {
  return (status ?? '—').replace(/_/g, ' ');
}

export function workflowStep(status: string) {
  if (status === 'DRAFT') return { label: 'Draft', step: 1 };
  if (status === 'APPROVED') return { label: 'Approved', step: 2 };
  if (status === 'ACTIVE') return { label: 'Active', step: 3 };
  if (status === 'OBSOLETE') return { label: 'Obsolete', step: 0 };
  return { label: statusLabel(status), step: 0 };
}

export function formatCost(value?: number) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

export function mrpShortageCount(mrp?: MrpPreview | null) {
  if (!mrp?.lines?.length) return 0;
  return mrp.lines.filter((l) => (l.shortageQty ?? 0) > 0).length;
}
