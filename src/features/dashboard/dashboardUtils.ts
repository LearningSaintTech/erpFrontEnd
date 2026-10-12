import type { ReportDatePreset } from '../../types/api';
import { humanizeStatus } from '../../components/erp';

export type DashboardTab = 'overview' | 'production' | 'supply' | 'quality';

export const DASHBOARD_TABS: { id: DashboardTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'production', label: 'Production' },
  { id: 'supply', label: 'Supply chain' },
  { id: 'quality', label: 'Quality' },
];

/** Same presets and order as the Reports page so the period filter feels identical. */
export const PRESET_OPTIONS: { id: ReportDatePreset; label: string }[] = [
  { id: 'mtd', label: 'Month to date' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'last90', label: 'Last 90 days' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'all', label: 'All time' },
];

export const MODULE_LINKS = [
  { name: 'Designs', path: '/designs', perm: 'design.read', desc: 'Styles and variants' },
  { name: 'Sampling', path: '/samples', perm: 'sampling.read', desc: 'Proto and fit samples' },
  { name: 'SKUs', path: '/products/skus', perm: 'sku.read', desc: 'Product catalog' },
  { name: 'BOMs', path: '/products/boms', perm: 'bom.read', desc: 'Bills of materials' },
  { name: 'Inventory', path: '/inventory', perm: 'inventory.read', desc: 'Raw material and finished stock' },
  { name: 'Purchase', path: '/purchase', perm: 'purchase.read', desc: 'Requisitions, payments, receipts' },
  { name: 'Production', path: '/production/orders', perm: 'production.read', desc: 'Orders and batches' },
  { name: 'Quality', path: '/quality/inspections', perm: 'quality.read', desc: 'Inspections and CAPA' },
  { name: 'Warehouse', path: '/warehouse/warehouses', perm: 'warehouse.read', desc: 'Bins and dispatch' },
  { name: 'Waste', path: '/waste', perm: 'waste.read', desc: 'Scrap and recovery' },
  { name: 'Reports', path: '/reports/factory', perm: 'report.read', desc: 'Full analytics' },
  { name: 'Approvals', path: '/approvals', perm: 'approval.read', desc: 'Pending decisions' },
] as const;

export function formatCurrency(n?: number): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function formatNumber(n?: number): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat().format(n);
}

export function formatPct(n?: number): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n}%`;
}

/** Sentence-case label for a raw enum key ("IN_PROGRESS" → "In progress"). */
export function statusLabel(key: string): string {
  return humanizeStatus(key);
}

export function recordToChart(record: Record<string, number | undefined> | undefined, labelFn = statusLabel): { name: string; value: number }[] {
  if (!record) return [];
  return Object.entries(record)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => ({ name: labelFn(k), value: v ?? 0 }))
    .sort((a, b) => b.value - a.value);
}

export function presetLabel(id: ReportDatePreset) {
  return PRESET_OPTIONS.find((o) => o.id === id)?.label ?? 'Selected period';
}

function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Client-side from/to (YYYY-MM-DD) for a preset, for APIs that take explicit dates. */
export function presetToRange(preset: ReportDatePreset): { from?: string; to?: string } {
  const now = new Date();
  const back = (days: number) => isoDay(new Date(now.getTime() - (days - 1) * 86_400_000));
  switch (preset) {
    case 'mtd': return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) };
    case 'ytd': return { from: isoDay(new Date(now.getFullYear(), 0, 1)), to: isoDay(now) };
    case 'last7': return { from: back(7), to: isoDay(now) };
    case 'last30': return { from: back(30), to: isoDay(now) };
    case 'last90': return { from: back(90), to: isoDay(now) };
    default: return {};
  }
}

/** Short currency for KPI tiles: ₹4.15L, ₹36.7K. Full value goes in the tooltip/hint. */
export function formatCompactCurrency(n?: number): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (Math.abs(n) < 10000) return formatCurrency(n);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1,
  }).format(n);
}

/** Exact amount for a KPI hint, only when the tile shows a compacted value. */
export function currencyHint(n?: number): string | undefined {
  if (n == null || Number.isNaN(n) || Math.abs(n) < 10000) return undefined;
  return formatCurrency(n);
}
