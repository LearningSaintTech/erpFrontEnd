import type { InventoryBalance, InventoryTransaction } from '../../types/api';
import { binLabel } from '../warehouse/warehouseUtils';

export type InventoryFlowStep = {
  id: string;
  label: string;
  detail: string;
};

/** RM inventory position in the end-to-end lifecycle (see raw-material-lifecycle.md). */
export const RM_INVENTORY_FLOW: InventoryFlowStep[] = [
  { id: 'master', label: 'Material master', detail: 'Register RM codes — required before Purchase PR lines' },
  { id: 'receipt', label: 'Receipt', detail: 'Normal path: Purchase GRN → incoming QC → unallocated dock' },
  { id: 'dock', label: 'Dock / bins', detail: 'Balances per location — put-away & transfer in Warehouse' },
  { id: 'hold', label: 'Reserve', detail: 'Holds for SAMPLE or PRODUCTION_ORDER (workflow modules)' },
  { id: 'issue', label: 'Issue', detail: 'Sample issue, production batch issue, warehouse pick' },
  { id: 'history', label: 'Movements', detail: 'Append-only transaction ledger for traceability' },
];

export const RESERVATION_REFERENCE_TYPES = [
  { value: 'SAMPLE', label: 'Sample (SAMPLE)' },
  { value: 'PRODUCTION_ORDER', label: 'Production order' },
  { value: 'MANUAL', label: 'Manual / ad-hoc' },
] as const;

export const MATERIAL_CATEGORIES = [
  { value: 'FABRIC', label: 'Fabric' },
  { value: 'THREAD', label: 'Thread' },
  { value: 'BUTTON', label: 'Button' },
  { value: 'LABEL', label: 'Label' },
  { value: 'ZIPPER', label: 'Zipper' },
  { value: 'PACKAGING', label: 'Packaging' },
  { value: 'ACCESSORY', label: 'Accessory' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const MATERIAL_UNITS = [
  { value: 'METERS', label: 'Meters' },
  { value: 'YARDS', label: 'Yards' },
  { value: 'PIECES', label: 'Pieces' },
  { value: 'CONES', label: 'Cones' },
  { value: 'KG', label: 'Kilograms' },
] as const;

export const TRANSACTION_TYPES = [
  { value: '', label: 'All types' },
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'ISSUE', label: 'Issue' },
  { value: 'RESERVATION', label: 'Reservation' },
  { value: 'RESERVATION_RELEASE', label: 'Release' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
] as const;

export function categoryLabel(value?: string) {
  return MATERIAL_CATEGORIES.find((c) => c.value === value)?.label || value || '—';
}

export function unitLabel(value?: string) {
  return MATERIAL_UNITS.find((u) => u.value === value)?.label || value || '—';
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function transactionLabel(type: string) {
  return TRANSACTION_TYPES.find((t) => t.value === type)?.label
    || type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function transactionReferenceLabel(tx: Pick<InventoryTransaction, 'referenceType' | 'referenceId'>) {
  if (!tx.referenceType) return '—';
  const id = tx.referenceId ? ` …${tx.referenceId.slice(-6)}` : '';
  return `${tx.referenceType.replace(/_/g, ' ')}${id}`;
}

export function stockWorkflowHint(balance: InventoryBalance): string {
  const avail = balance.available ?? 0;
  const onDock = !balance.storageBinId;
  if (avail <= 0 && (balance.reserved ?? 0) > 0) return 'Fully reserved — release or issue from sample/production';
  if (avail <= 0) return 'No available stock — request purchase or receive via GRN + QC';
  if (balance.isLowStock) return 'Below reorder level — request purchase to replenish';
  if (onDock && avail > 0) return 'On unallocated dock — put away to bin in Warehouse';
  if (!onDock && avail > 0) return 'In bin — transfer or pick from Warehouse';
  return '';
}

/** Suggested PR qty to bring available back above reorder (min 1). */
export function suggestedPrQty(balance: Pick<InventoryBalance, 'available' | 'reorderLevel' | 'isOutOfStock'>): number {
  const avail = balance.available ?? 0;
  const reorder = balance.reorderLevel ?? 0;
  if (reorder > 0) return Math.max(reorder - avail, reorder, 1);
  if (avail <= 0) return 100;
  return Math.max(Math.ceil(avail * 0.5), 1);
}

export function inventorySuccessMessage(action: string): string {
  switch (action) {
    case 'createMaterial': return 'Material created — use in Purchase PR or BOM';
    case 'updateMaterial': return 'Material updated';
    case 'manualReceipt': return 'Manual receipt posted to stock';
    case 'reserve': return 'Stock reserved';
    case 'release': return 'Reservations released';
    case 'requestPurchase': return 'Purchase requisition created — submit it on Purchase for approval';
    default: return 'Updated';
  }
}

export function inventoryConfirmMessage(action: 'manualReceipt' | 'reserve' | 'release', detail?: string): string {
  switch (action) {
    case 'manualReceipt':
      return `Post manual receipt${detail ? `: ${detail}` : ''}? Normal RM intake is Purchase GRN → incoming QC. Use manual receipt only for corrections or opening balances.`;
    case 'reserve':
      return `Reserve stock${detail ? ` (${detail})` : ''}? Available qty will decrease until issue or release.`;
    case 'release':
      return `Release all active reservations for this reference? Held qty returns to available.`;
    default:
      return 'Continue?';
  }
}

export type PostQcFlowStep = { id: string; label: string; detail: string };

/** After incoming QC — dock stock to bin to production/sampling */
export const RM_POST_QC_FLOW: PostQcFlowStep[] = [
  { id: 'dock', label: 'Dock stock', detail: 'QC passed qty on unallocated balance (you are here)' },
  { id: 'putaway', label: 'Put away', detail: 'Warehouse — move dock qty into a storage bin' },
  { id: 'use', label: 'Reserve / issue', detail: 'Samples or Production consume stock from dock or bin' },
];

export function materialIdFromBalance(b: { materialId?: string | { _id: string; materialCode?: string } }): string {
  const m = b.materialId;
  if (!m) return '';
  return typeof m === 'string' ? m : m._id;
}

export function putAwayPath(materialId?: string, materialCode?: string): string {
  if (materialId) return `/warehouse/operations/put-away?materialId=${materialId}`;
  if (materialCode) return `/warehouse/operations/put-away?material=${encodeURIComponent(materialCode)}`;
  return '/warehouse/operations/put-away';
}

export function stockLocatorPath(opts?: { materialId?: string; skuId?: string; search?: string; inventoryType?: string }): string {
  const params = new URLSearchParams();
  if (opts?.inventoryType) params.set('inventoryType', opts.inventoryType);
  if (opts?.materialId) params.set('materialId', opts.materialId);
  if (opts?.skuId) params.set('skuId', opts.skuId);
  if (opts?.search) params.set('search', opts.search);
  const q = params.toString();
  return q ? `/warehouse/stock-locator?${q}` : '/warehouse/stock-locator';
}

export function materialParts(materialId: { materialCode?: string; name?: string } | string | undefined): { code: string; name: string } {
  if (!materialId) return { code: '—', name: '' };
  if (typeof materialId === 'string') return { code: materialId, name: '' };
  return { code: materialId.materialCode || '—', name: materialId.name || '' };
}

export function materialDisplayName(materialId: { materialCode?: string; name?: string } | string | undefined) {
  const { code, name } = materialParts(materialId);
  return name ? `${code} — ${name}` : code;
}

export function balanceLocationLabel(balance: {
  storageBinId?: string | { zoneCode?: string; binCode?: string } | null;
  noBalanceYet?: boolean;
  onHand?: number;
}): string {
  if (balance.noBalanceYet || ((balance.onHand ?? 0) === 0 && !balance.storageBinId)) {
    return 'No stock yet';
  }
  const bin = balance.storageBinId;
  if (!bin) return 'Unallocated (dock)';
  if (typeof bin === 'string') return `Bin …${bin.slice(-6)}`;
  return binLabel(bin);
}

export function performerName(performedBy: InventoryTransaction['performedBy']) {
  if (!performedBy || typeof performedBy === 'string') return '—';
  const parts = [performedBy.firstName, performedBy.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : performedBy.email || '—';
}

export function formatDateTime(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
