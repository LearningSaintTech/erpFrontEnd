import type { Material, PurchaseLine, PurchaseOrder, PurchaseRequisition, Supplier } from '../../types/api';

export type PurchaseFlowStep = {
  id: string;
  label: string;
  detail: string;
};

export const RM_PURCHASE_FLOW: PurchaseFlowStep[] = [
  { id: 'pr', label: 'PR', detail: 'Store Keeper (or purchaser) creates requisition' },
  { id: 'approve', label: 'Approve', detail: 'L1 Purchase Manager → L2 Factory Admin' },
  { id: 'po', label: 'PO / RFQ', detail: 'Purchase Manager creates PO or RFQ → PO' },
  { id: 'grn', label: 'GRN', detail: 'Goods receipt against open PO' },
  { id: 'qc', label: 'Incoming QC', detail: 'Quality inspect — passed qty receipts to dock' },
  { id: 'stock', label: 'Stock', detail: 'Unallocated RM balance (optional put-away to bin)' },
  { id: 'prod', label: 'Production', detail: 'Reserve → issue for batches; MRP may auto-unblock' },
];

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function formatCurrency(amount?: number) {
  if (amount == null || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function materialIdOf(line: PurchaseLine) {
  return typeof line.materialId === 'string' ? line.materialId : line.materialId._id;
}

export function materialLabel(materialId: PurchaseLine['materialId']) {
  if (!materialId || typeof materialId === 'string') return materialId || '—';
  const m = materialId as Material;
  return `${m.materialCode} — ${m.name}`;
}

export function supplierLabel(supplierId?: string | Supplier) {
  if (!supplierId || typeof supplierId === 'string') return supplierId || '—';
  return `${supplierId.supplierCode} — ${supplierId.name}`;
}

export function supplierIdOf(po: PurchaseOrder) {
  if (!po.supplierId) return '';
  return typeof po.supplierId === 'string' ? po.supplierId : po.supplierId._id;
}

export function lineSummary(lines?: PurchaseLine[]) {
  if (!lines?.length) return '—';
  return lines.map((l) => `${materialLabel(l.materialId)} ${l.requiredQty ?? l.orderedQty ?? l.quantity ?? 0} ${l.unit || ''}`.trim()).join(' · ');
}

export function poNumber(poId?: string | PurchaseOrder) {
  if (!poId || typeof poId === 'string') return poId || '—';
  return poId.poNumber;
}

export function prNumber(prId?: string | PurchaseRequisition) {
  if (!prId || typeof prId === 'string') return prId || '—';
  return prId.prNumber;
}

export function poPrIdOf(po: PurchaseOrder): string {
  if (!po.prId) return '';
  return typeof po.prId === 'string' ? po.prId : po.prId._id;
}

export function findPoForPr(pos: PurchaseOrder[], pr: PurchaseRequisition): PurchaseOrder | undefined {
  return pos.find((po) => poPrIdOf(po) === pr._id);
}

export function poIdOfGrn(grn: { poId?: string | { _id?: string; poNumber?: string } }): string {
  if (!grn.poId) return '';
  return typeof grn.poId === 'string' ? grn.poId : (grn.poId._id || '');
}

export function findGrnsForPo<T extends { _id: string; poId?: string | { _id?: string }; status?: string }>(
  grns: T[],
  poId: string,
): T[] {
  return grns.filter((g) => poIdOfGrn(g) === poId);
}

export function historyPurchaseLabel(linkedPo?: PurchaseOrder, grns?: Array<{ status?: string }>) {
  if (!linkedPo) return 'Converted — PO not found';
  const completed = grns?.some((g) => g.status === 'COMPLETED');
  const pendingQc = grns?.some((g) => g.status === 'PENDING_QC');
  if (completed) return 'Complete — QC passed, stock received';
  if (pendingQc) return 'PO open — GRN awaiting QC';
  if (grns?.length) return 'PO open — GRN in progress';
  if (['RECEIVED'].includes(linkedPo.status)) return 'PO fully received';
  if (['SENT', 'PARTIAL', 'APPROVED'].includes(linkedPo.status)) return 'PO active — receive GRN when shipment arrives';
  return `PO ${linkedPo.status.replace(/_/g, ' ')}`;
}

export function prSourceLabel(pr?: PurchaseRequisition & { sourceType?: string }) {
  if (!pr?.sourceType || pr.sourceType === 'MANUAL') return 'Manual';
  if (pr.sourceType === 'MRP') return 'Production MRP';
  return pr.sourceType;
}

type GrnLineRow = { receivedQty?: number; acceptedQty?: number; materialId?: string | Material };

export function grnLineSummary(grn?: { status?: string; lines?: GrnLineRow[] }) {
  if (!grn?.lines?.length) return '—';
  return grn.lines.map((l) => {
    const qty = l.acceptedQty != null && grn.status === 'COMPLETED' ? l.acceptedQty : l.receivedQty;
    return `${materialLabel(l.materialId as PurchaseLine['materialId'])} ${qty ?? 0}`;
  }).join(' · ');
}

export function grnNextStep(status: string): { label: string; path: string } | null {
  if (status === 'DRAFT') return { label: 'Submit incoming QC', path: '' };
  if (status === 'PENDING_QC') return { label: 'Complete incoming QC', path: '/quality' };
  if (status === 'COMPLETED') return { label: 'Put away or view stock', path: '/warehouse/operations/put-away' };
  return null;
}

export function workflowHint(entity: 'pr' | 'po' | 'grn', status: string) {
  if (entity === 'pr') {
    if (status === 'DRAFT') return 'Submit for approval (Purchase Manager → Admin)';
    if (status === 'SUBMITTED') return 'Pending dual approval — Purchase Manager then Factory Admin';
    if (status === 'APPROVED') return 'Fully approved — Purchase Manager can create PO or RFQ';
    if (status === 'CONVERTED') return 'Converted to PO';
    if (status === 'REJECTED') return 'Rejected — revise lines if needed, then resubmit';
  }
  if (entity === 'po') {
    if (status === 'DRAFT') return 'Approve then send to supplier';
    if (status === 'APPROVED') return 'Send to supplier, then receive GRN';
    if (status === 'SENT' || status === 'PARTIAL') return 'Receive goods (GRN) → incoming QC';
    if (status === 'RECEIVED') return 'Fully received — complete any open GRN QC';
  }
  if (entity === 'grn') {
    if (status === 'DRAFT') return 'Submit for incoming QC (stock not updated yet)';
    if (status === 'PENDING_QC') return 'Quality: inspect → passed qty → unallocated dock stock';
    if (status === 'COMPLETED') return 'Stock received — put away to bin or reserve for production';
  }
  return '';
}

export function purchaseSuccessMessage(type: string, status?: string): string {
  switch (type) {
    case 'submitPr': return 'PR submitted — awaiting Purchase Manager, then Factory Admin';
    case 'approvePr':
      return status === 'APPROVED'
        ? 'PR fully approved — create PO or RFQ'
        : 'Level approved — awaiting next approver (Factory Admin)';
    case 'rejectPr': return 'PR rejected';
    case 'createPo': return 'PO created — approve and send to supplier';
    case 'approvePo': return 'PO approved — send to supplier';
    case 'sendPo': return 'PO sent — receive goods when shipment arrives';
    case 'createGrn': return 'GRN created — submit for incoming QC next';
    case 'submitGrn': return 'GRN submitted — complete incoming QC in Quality to receipt stock';
    case 'rfq': return 'RFQ created';
    case 'sendRfq': return 'RFQ sent to suppliers';
    case 'quote': return 'Quotation recorded';
    case 'selectQuote': return 'Quotation selected';
    default: return 'Updated';
  }
}
