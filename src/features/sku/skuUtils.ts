import type { Design, Material, Sample, Sku } from '../../types/api';

export function designLabel(designId?: string | Design) {
  if (!designId || typeof designId === 'string') return designId || '—';
  return `${designId.designCode} — ${designId.title}`;
}

export function designIdOf(sku: Sku) {
  if (!sku.designId) return '';
  return typeof sku.designId === 'string' ? sku.designId : sku.designId._id;
}

export function sampleLabel(sampleId?: string | Sample) {
  if (!sampleId || typeof sampleId === 'string') return sampleId || '—';
  return sampleId.sampleCode;
}

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function formatPrice(value?: number, currency = 'INR') {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function colorSwatch(color?: { name?: string; hexCode?: string }) {
  if (!color?.name) return '—';
  return color.name;
}
