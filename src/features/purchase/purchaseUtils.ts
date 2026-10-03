import type { Material, PurchaseLine, PurchaseOrder, PurchaseRequisition, Supplier } from '../../types/api';

export type PurchaseFlowStep = {
  id: string;
  label: string;
  detail: string;
};

export const PURCHASE_FLOW_SUMMARY =
  'PR → Factory Admin / Super Admin approve → Payment (agreed on call) → GRN + invoice → Finance marks paid';

export const RM_PURCHASE_FLOW: PurchaseFlowStep[] = [
  { id: 'pr', label: 'PR', detail: 'Store Keeper (or purchaser) creates requisition' },
  { id: 'approve', label: 'Approve', detail: 'Super Admin or Factory Admin' },
  { id: 'pay', label: 'Payment', detail: 'Agreed with supplier on call — create payment. Finance marks paid after invoice.' },
  { id: 'grn', label: 'GRN', detail: 'Goods receipt against the payment, upload supplier invoice' },
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
  if (!linkedPo) return 'Converted — payment not found';
  const completed = grns?.some((g) => g.status === 'COMPLETED');
  const pendingQc = grns?.some((g) => g.status === 'PENDING_QC');
  if (linkedPo.paymentStatus === 'PAID') return 'Paid — invoice recorded';
  if (completed) return 'Received — Finance can mark paid once invoice is on GRN';
  if (pendingQc) return 'GRN awaiting incoming QC';
  if (grns?.length) return 'GRN in progress — upload invoice';
  if (['RECEIVED'].includes(linkedPo.status)) return 'Fully received — attach invoice if missing';
  if (['SENT', 'PARTIAL', 'APPROVED'].includes(linkedPo.status)) return 'Open payment — receive GRN and upload invoice';
  return `Payment ${linkedPo.status.replace(/_/g, ' ')}`;
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
  if (status === 'PENDING_QC') return { label: 'Complete incoming QC', path: '/quality/inspections' };
  if (status === 'COMPLETED') return { label: 'Put away or view stock', path: '/warehouse/operations/put-away' };
  return null;
}

export function workflowHint(entity: 'pr' | 'po' | 'grn', status: string) {
  if (entity === 'pr') {
    if (status === 'DRAFT') return 'Submit for Factory Admin / Super Admin approval';
    if (status === 'SUBMITTED') return 'Pending Factory Admin or Super Admin approval';
    if (status === 'APPROVED') return 'Approved — create a payment after agreeing with the supplier on call';
    if (status === 'CONVERTED') return 'Converted to payment';
    if (status === 'REJECTED') return 'Rejected — revise lines if needed, then resubmit';
  }
  if (entity === 'po') {
    if (status === 'DRAFT') return 'Approve this payment so GRN can be recorded';
    if (status === 'APPROVED') return 'Record GRN and upload the supplier invoice, then Finance marks paid';
    if (status === 'SENT' || status === 'PARTIAL') return 'Receive goods (GRN) and upload invoice';
    if (status === 'RECEIVED') return 'Fully received — complete any open GRN QC';
  }
  if (entity === 'grn') {
    if (status === 'DRAFT') return 'Upload invoice, then submit for incoming QC';
    if (status === 'PENDING_QC') return 'Quality: inspect → passed qty → unallocated dock stock';
    if (status === 'COMPLETED') return 'Stock received — Finance can mark paid once the invoice is attached';
  }
  return '';
}

export function purchaseSuccessMessage(type: string, status?: string): string {
  switch (type) {
    case 'submitPr': return 'PR submitted — awaiting Factory Admin or Super Admin';
    case 'approvePr':
      return status === 'APPROVED'
        ? 'PR approved — create a payment after agreeing with the supplier on call'
        : 'Approved';
    case 'rejectPr': return 'PR rejected';
    case 'createPo': return 'Payment created — record GRN and upload the supplier invoice';
    case 'approvePo': return 'Payment approved — record GRN when goods arrive';
    case 'sendPo': return 'Payment noted — receive goods when shipment arrives';
    case 'markPaid': return 'Marked paid';
    case 'createGrn': return 'GRN created — attach invoice if not already, then submit QC';
    case 'submitGrn': return 'GRN submitted — complete incoming QC in Quality to receipt stock';
    case 'rfq': return 'RFQ created';
    case 'sendRfq': return 'RFQ sent to suppliers';
    case 'quote': return 'Quotation recorded';
    case 'selectQuote': return 'Quotation selected';
    default: return 'Updated';
  }
}
