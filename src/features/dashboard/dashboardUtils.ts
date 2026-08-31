import type { ReportDatePreset } from '../../types/api';

export type DashboardTab = 'overview' | 'production' | 'supply' | 'quality';

export const DASHBOARD_TABS: { id: DashboardTab; label: string; subtitle: string }[] = [
  { id: 'overview', label: 'Overview', subtitle: 'Executive snapshot across all modules' },
  { id: 'production', label: 'Production', subtitle: 'Orders, batches, capacity, and fulfillment' },
  { id: 'supply', label: 'Supply chain', subtitle: 'Inventory, purchase, and warehouse' },
  { id: 'quality', label: 'Quality', subtitle: 'Inspections, CAPA, and compliance' },
];

export const PRESET_OPTIONS: { id: ReportDatePreset; label: string }[] = [
  { id: 'mtd', label: 'Month to date' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'all', label: 'All time' },
];

export const MODULE_LINKS = [
  { name: 'Designs', path: '/designs', perm: 'design.read', desc: 'Styles & variants' },
  { name: 'Sampling', path: '/samples', perm: 'sampling.read', desc: 'Proto & fit' },
  { name: 'SKUs', path: '/skus', perm: 'sku.read', desc: 'Product catalog' },
  { name: 'BOMs', path: '/boms', perm: 'bom.read', desc: 'Bill of materials' },
  { name: 'Inventory', path: '/inventory', perm: 'inventory.read', desc: 'RM & FG stock' },
  { name: 'Purchase', path: '/purchase', perm: 'purchase.read', desc: 'PR, PO, GRN' },
  { name: 'Production', path: '/production', perm: 'production.read', desc: 'Orders & batches' },
  { name: 'Quality', path: '/quality/inspections', perm: 'quality.read', desc: 'QC & CAPA' },
  { name: 'Warehouse', path: '/warehouse/warehouses', perm: 'warehouse.read', desc: 'Bins & dispatch' },
  { name: 'Waste', path: '/waste', perm: 'waste.read', desc: 'Scrap & recovery' },
  { name: 'Reports', path: '/reports/factory', perm: 'report.read', desc: 'Full analytics' },
  { name: 'Approvals', path: '/approvals', perm: 'approval.read', desc: 'Pending actions' },
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

export function statusLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function recordToChart(record: Record<string, number | undefined> | undefined, labelFn = statusLabel): { name: string; value: number }[] {
  if (!record) return [];
  return Object.entries(record)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => ({ name: labelFn(k), value: v ?? 0 }))
    .sort((a, b) => b.value - a.value);
}

export function tabMeta(id: DashboardTab) {
  return DASHBOARD_TABS.find((t) => t.id === id) ?? DASHBOARD_TABS[0];
}
