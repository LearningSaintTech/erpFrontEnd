import type { ReportDatePreset, ReportTabId } from '../../types/api';

export const REPORT_TABS: { id: ReportTabId; label: string; subtitle: string }[] = [
  { id: 'factory', label: 'Factory', subtitle: 'Cross-module executive summary' },
  { id: 'production', label: 'Production', subtitle: 'Orders, batches, capacity, and fulfillment' },
  { id: 'inventory', label: 'Inventory', subtitle: 'Stock levels, value, and low-stock alerts' },
  { id: 'purchase', label: 'Purchase', subtitle: 'PR/PO pipeline and spend' },
  { id: 'quality', label: 'Quality', subtitle: 'Inspection yield, CAPA, and defects' },
  { id: 'waste', label: 'Waste', subtitle: 'Scrap cost and recovery' },
  { id: 'machine', label: 'Machine', subtitle: 'Asset utilization and capacity' },
  { id: 'employee', label: 'Employee', subtitle: 'Workforce assignments' },
  { id: 'financial', label: 'Financial', subtitle: 'Spend, waste cost, and stock value' },
  { id: 'approval', label: 'Approval', subtitle: 'Workflow throughput and backlog' },
];

export const DATE_PRESET_OPTIONS: { id: ReportDatePreset; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'mtd', label: 'Month to date' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'last90', label: 'Last 90 days' },
];

export function tabMeta(id: ReportTabId) {
  return REPORT_TABS.find((t) => t.id === id) ?? REPORT_TABS[0];
}

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

export function recordToChartData(record: Record<string, number> | undefined): { name: string; value: number }[] {
  if (!record) return [];
  return Object.entries(record)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: statusLabel(name), value }))
    .sort((a, b) => b.value - a.value);
}

export function formatPeriod(from?: string, to?: string): string {
  if (!from || !to) return 'All time';
  const f = new Date(from).toLocaleDateString();
  const t = new Date(to).toLocaleDateString();
  return `${f} – ${t}`;
}
