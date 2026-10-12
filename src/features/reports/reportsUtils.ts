import type { ReportDatePreset, ReportTabId } from '../../types/api';
import { humanizeStatus } from '../../components/erp';

export const REPORT_TABS: { id: ReportTabId; label: string; subtitle: string }[] = [
  { id: 'factory', label: 'Factory', subtitle: 'A summary across all modules.' },
  { id: 'production', label: 'Production', subtitle: 'Orders, batches, capacity and fulfillment.' },
  { id: 'inventory', label: 'Inventory', subtitle: 'Stock levels, value and low-stock materials.' },
  { id: 'purchase', label: 'Purchase', subtitle: 'Requisitions, payments and spend.' },
  { id: 'quality', label: 'Quality', subtitle: 'Inspection yield, CAPA and defects.' },
  { id: 'waste', label: 'Waste', subtitle: 'Scrap cost and recovery.' },
  { id: 'machine', label: 'Machines', subtitle: 'Machine status, utilization and capacity.' },
  { id: 'employee', label: 'People', subtitle: 'Who has access, by role.' },
  { id: 'financial', label: 'Financial', subtitle: 'Supplier payments, spend and stock value.' },
  { id: 'approval', label: 'Approvals', subtitle: 'Approval throughput and backlog.' },
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
  return humanizeStatus(key);
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
  const f = new Date(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const t = new Date(to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${f} – ${t}`;
}

// Report fields the API returns that the shared types do not declare yet.
declare module '../../types/api.extended' {
  interface ProductionReport {
    /** Pieces accepted by final QC (fulfillment = passed / planned). */
    totalPassedQty?: number;
    totalRejectedQty?: number;
    ordersCancelled?: number;
    batchesCancelled?: number;
  }
  interface InventoryReport {
    /** RM reserved quantity (material units); FG reserved pieces are reported separately. */
    rmReserved?: number;
    fgReserved?: number;
  }
}
