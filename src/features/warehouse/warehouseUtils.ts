import type {
  CycleCountLine, DispatchReadyBalance, InventoryBalance, Material, SkuRef, StorageBin, Warehouse,
} from '../../types/api';

export const WAREHOUSE_TYPES = ['RAW_MATERIAL', 'WIP', 'FINISHED_GOODS'] as const;

const TYPE_LABELS: Record<string, string> = {
  RAW_MATERIAL: 'Raw material',
  WIP: 'WIP',
  FINISHED_GOODS: 'Finished goods',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  FROZEN: 'Frozen',
  DRAFT: 'Draft',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  STAGED: 'Staged',
  READY_FOR_DISPATCH: 'Ready to ship',
  DISPATCHED: 'Dispatched',
};

export function warehouseTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

export function binLabel(bin?: StorageBin | { _id?: string; zoneCode?: string; binCode?: string; zoneId?: string }): string {
  if (!bin) return '—';
  const zone = bin.zoneCode || (bin.zoneId ? 'Z' : 'UNZ');
  return `${zone}-${bin.binCode || '?'}`;
}

export function pickPath(materialId?: string, skuId?: string): string {
  if (skuId) return `/warehouse/operations/picking?inventoryType=FINISHED_GOODS&skuId=${skuId}`;
  if (materialId) return `/warehouse/operations/picking?materialId=${materialId}`;
  return '/warehouse/operations/picking';
}

export function transferPath(materialId?: string, skuId?: string): string {
  if (skuId) return `/warehouse/operations/transfer?inventoryType=FINISHED_GOODS&skuId=${skuId}`;
  if (materialId) return `/warehouse/operations/transfer?materialId=${materialId}`;
  return '/warehouse/operations/transfer';
}

export function dispatchPath(skuId?: string): string {
  if (skuId) return `/warehouse/operations/dispatch?inventoryType=FINISHED_GOODS&skuId=${skuId}`;
  return '/warehouse/operations/dispatch';
}

export function materialLabel(mat?: string | Material): string {
  if (!mat) return '—';
  if (typeof mat === 'string') return mat.slice(-8);
  return mat.materialCode || mat.name || '—';
}

export function materialRowId(mat?: string | Material): string {
  if (!mat) return '';
  return typeof mat === 'string' ? mat : mat._id;
}

export function skuLabel(sku?: string | SkuRef): string {
  if (!sku) return '—';
  if (typeof sku === 'string') return sku.slice(-8);
  return sku.skuCode || sku.name || '—';
}

export function locatorItemLabel(row: {
  inventoryType?: string;
  materialId?: string | Material;
  skuId?: string | SkuRef;
}): string {
  if (row.inventoryType === 'FINISHED_GOODS' || row.skuId) {
    return skuLabel(row.skuId);
  }
  const mat = row.materialId;
  if (!mat) return '—';
  if (typeof mat === 'string') return mat.slice(-8);
  return `${mat.materialCode || '—'} — ${mat.name || ''}`.trim();
}

export function warehouseLabel(wh?: string | Warehouse): string {
  if (!wh) return '—';
  if (typeof wh === 'string') return wh.slice(-8);
  return wh.warehouseCode || wh.name || '—';
}

export function dispatchRowSku(row: DispatchReadyBalance): string {
  return skuLabel(row.skuId);
}

export function dispatchRowQty(row: DispatchReadyBalance): number {
  return row.onHand ?? 0;
}

export function dispatchBinId(row: DispatchReadyBalance): string {
  const b = row.storageBinId;
  if (!b) return '';
  return typeof b === 'string' ? b : b._id;
}

export function cycleLineMaterial(line: CycleCountLine): string {
  if (line.skuId) return skuLabel(line.skuId);
  return materialLabel(line.materialId);
}

export function varianceClass(variance: number): string {
  if (variance > 0) return 'text-emerald-600';
  if (variance < 0) return 'text-red-600';
  return 'text-erp-text-muted';
}

export function balanceBinId(row?: InventoryBalance | null): string | null {
  if (!row?.storageBinId) return null;
  const b = row.storageBinId;
  return typeof b === 'string' ? b : b._id ?? null;
}

export function transferableQty(row?: InventoryBalance | null): number {
  if (!row) return 0;
  return Math.max(0, (row.onHand ?? 0) - (row.reserved ?? 0));
}

export function unallocatedBalance(rows: InventoryBalance[]): InventoryBalance | undefined {
  return rows.find((r) => !balanceBinId(r));
}

export function binBalanceRow(rows: InventoryBalance[], binId: string): InventoryBalance | undefined {
  return rows.find((r) => balanceBinId(r) === binId);
}

export function indexBalancesByBin(rows: InventoryBalance[]): Map<string, InventoryBalance> {
  const map = new Map<string, InventoryBalance>();
  for (const r of rows) {
    const bid = balanceBinId(r);
    if (bid) map.set(bid, r);
  }
  return map;
}

export function stockOpSuccessMessage(type: string, data: unknown): string {
  const d = data as { quantity?: number } | undefined;
  const q = d?.quantity;
  switch (type) {
    case 'putAway': return q != null ? `Put away ${q} units into bin` : 'Stock put away into bin';
    case 'pick': return q != null ? `Picked ${q} units (stock decreased)` : 'Pick completed — stock decreased';
    case 'transfer': return q != null ? `Transferred ${q} units between locations` : 'Transfer completed';
    case 'fgPutAway': return 'Stock staged in bin';
    case 'markReady': return 'Marked ready to ship';
    case 'dispatch': return 'Dispatched — stock decreased';
    default: return 'Saved';
  }
}

export const RM_PUT_AWAY_FLOW = [
  { id: 'dock', label: 'Unallocated dock', detail: 'Stock from GRN + incoming QC lands here first' },
  { id: 'putaway', label: 'Put away', detail: 'Select material → choose bin → confirm qty' },
  { id: 'bin', label: 'Bin stock', detail: 'Available for transfer, pick, or workflow reserve/issue' },
] as const;

export const FG_PUT_AWAY_FLOW = [
  { id: 'qc', label: 'Final QC', detail: 'Finished goods received from production QC' },
  { id: 'putaway', label: 'Put away', detail: 'Select SKU → choose bin → stage stock' },
  { id: 'bin', label: 'Bin stock', detail: 'Available for transfer, pick, or dispatch' },
] as const;
