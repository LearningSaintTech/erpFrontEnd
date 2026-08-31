import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, ClipboardList, Download, FileText, Package, RefreshCw, Search, ShoppingCart, Truck, Users,
} from 'lucide-react';
import { purchaseApi } from '../../services/operations';
import { inventoryApi } from '../../services/manufacturing';
import { approvalApi } from '../../services/approvals';
import { AlertBanner } from '../../components/AlertBanner';
import { ApprovalsHint } from '../../components/ApprovalsHint';
import {
  ErpPageHeader, ErpStatusBadge, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpTabs,
} from '../../components/erp';
import type {
  ApprovalInstance, GoodsReceipt, Material, PurchaseOrder, PurchaseRequisition, Quotation, Rfq, Supplier,
} from '../../types/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { CommentPrompt } from '../approvals/components/CommentPrompt';
import {
  canActOnApproval, requiredApproverLabel, workflowLevelLabel,
} from '../approvals/approvalUtils';
import {
  findGrnsForPo, findPoForPr, formatCurrency, grnLineSummary, grnNextStep, historyPurchaseLabel,
  lineSummary, materialLabel, poNumber, prNumber, prSourceLabel, purchaseSuccessMessage,
  RM_PURCHASE_FLOW, statusLabel, supplierIdOf, supplierLabel, workflowHint,
} from './purchaseUtils';
import { unitLabel } from '../inventory/inventoryUtils';
import { downloadCsv } from '../../utils/csvExport';

const PAGE_SIZE = 15;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';

type TabId = 'pr' | 'po' | 'grn' | 'rfq' | 'suppliers' | 'history';

type PrLine = { materialId: string; requiredQty: number; unit: string; estimatedUnitCost: number };

export function PurchasePage() {
  const qc = useQueryClient();
  const { permissions, user } = useAuth();
  const userId = user?._id;
  const canCreate = permissions.includes('*') || permissions.includes('purchase.create');
  const canUpdate = permissions.includes('*') || permissions.includes('purchase.update');
  const canApprove = permissions.includes('*') || permissions.includes('purchase.approve');
  const canExport = permissions.includes('*') || permissions.includes('purchase.export');
  const canReadApprovals = permissions.includes('*') || permissions.includes('approval.read');
  /** PO / RFQ / suppliers — Purchase Manager (and admin), not Store Keeper requesters */
  const canExecute = canCreate && canApprove;
  /** GRN receive — Store Keeper or Purchase Manager */
  const canReceive = canCreate;

  const [tab, setTab] = useState<TabId>('pr');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [supplierForm, setSupplierForm] = useState({ supplierCode: '', name: '', contactEmail: '', leadTimeDays: '7' });
  const [prLines, setPrLines] = useState<PrLine[]>([]);
  const [prMaterialId, setPrMaterialId] = useState('');
  const [prQty, setPrQty] = useState('100');
  const [poPrId, setPoPrId] = useState('');
  const [poSupplierId, setPoSupplierId] = useState('');
  const [grnPoId, setGrnPoId] = useState('');
  const [grnQtys, setGrnQtys] = useState<Record<string, number>>({});
  const [rfqPrId, setRfqPrId] = useState('');
  const [rfqSupplierIds, setRfqSupplierIds] = useState<string[]>([]);
  const [quoteRfqId, setQuoteRfqId] = useState('');
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [quotePrice, setQuotePrice] = useState('100');
  const [rejectPrId, setRejectPrId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; message: string; fn: () => void } | null>(null);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const { data: stats } = useQuery({ queryKey: ['purchase-stats'], queryFn: () => purchaseApi.stats() });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['purchase-list', tab, page, search],
    queryFn: async () => {
      const params = {
        page,
        limit: tab === 'suppliers' ? 50 : PAGE_SIZE,
        search: search || undefined,
      };
      switch (tab) {
        case 'pr':
          return purchaseApi.listPRsPage({
            ...params,
            status: 'DRAFT,SUBMITTED,APPROVED,REJECTED',
          });
        case 'po':
          return purchaseApi.listPOsPage({
            ...params,
            // Searching (e.g. View PO from History) includes closed/received orders
            ...(search ? {} : { status: 'DRAFT,APPROVED,SENT,PARTIAL' }),
          });
        case 'grn':
          return purchaseApi.listGRNsPage({
            ...params,
            // Include COMPLETED so Store Keeper can open Stock after QC; search finds all
            ...(search ? {} : { status: 'DRAFT,PENDING_QC,COMPLETED' }),
          });
        case 'history':
          return purchaseApi.listPRsPage({
            ...params,
            status: 'CONVERTED',
          });
        case 'rfq': return purchaseApi.listRfqsPage(params);
        default: return purchaseApi.listSuppliersPage(params);
      }
    },
  });

  const items = (data?.items ?? []) as Array<PurchaseRequisition | PurchaseOrder | GoodsReceipt | Rfq | Supplier>;
  const meta = data?.meta;

  const { data: materials = [], isError: materialsError } = useQuery({
    queryKey: ['materials'],
    queryFn: () => inventoryApi.listMaterials(),
    enabled: canCreate,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => purchaseApi.listSuppliers(),
    enabled: canExecute,
  });

  const { data: approvedPrs = [] } = useQuery({
    queryKey: ['prs-approved'],
    queryFn: () => purchaseApi.listPRs({ status: 'APPROVED' }),
    enabled: canExecute,
  });

  const { data: openPos = [] } = useQuery({
    queryKey: ['pos-open'],
    queryFn: () => purchaseApi.listPOs({ limit: 200 }),
    enabled: canReceive,
    select: (pos) => pos.filter((p) => ['APPROVED', 'SENT', 'PARTIAL'].includes(p.status)),
  });

  const { data: posForPrLink = [] } = useQuery({
    queryKey: ['pos-pr-link'],
    queryFn: () => purchaseApi.listPOs({ limit: 500 }),
    enabled: tab === 'pr' || tab === 'history',
  });

  const { data: historyGrns = [] } = useQuery({
    queryKey: ['grns-history-link'],
    queryFn: () => purchaseApi.listGRNs({ limit: 500 }),
    enabled: tab === 'history',
  });

  const { data: pendingPrApprovals = [] } = useQuery({
    queryKey: ['approvals-pending-pr'],
    queryFn: () => approvalApi.pending({ documentType: 'PURCHASE_REQUISITION', limit: 100 }).then((r) => r.items),
    enabled: canReadApprovals && tab === 'pr',
  });

  const prApprovalByDocId = useMemo(() => {
    const map = new Map<string, ApprovalInstance>();
    for (const inst of pendingPrApprovals) {
      const docId = typeof inst.documentId === 'string' ? inst.documentId : String(inst.documentId);
      map.set(docId, inst);
    }
    return map;
  }, [pendingPrApprovals]);

  const { data: grnPreview } = useQuery({
    queryKey: ['po-receipt-preview', grnPoId],
    queryFn: () => purchaseApi.poReceiptPreview(grnPoId),
    enabled: !!grnPoId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['purchase-list'] });
    qc.invalidateQueries({ queryKey: ['purchase-stats'] });
    qc.invalidateQueries({ queryKey: ['prs'] });
    qc.invalidateQueries({ queryKey: ['prs-approved'] });
    qc.invalidateQueries({ queryKey: ['pos'] });
    qc.invalidateQueries({ queryKey: ['pos-open'] });
    qc.invalidateQueries({ queryKey: ['pos-pr-link'] });
    qc.invalidateQueries({ queryKey: ['grns'] });
    qc.invalidateQueries({ queryKey: ['rfqs'] });
    qc.invalidateQueries({ queryKey: ['suppliers-all'] });
    qc.invalidateQueries({ queryKey: ['approvals-pending'] });
    qc.invalidateQueries({ queryKey: ['approvals-pending-pr'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances-page'] });
    qc.invalidateQueries({ queryKey: ['inventory-availability'] });
    qc.invalidateQueries({ queryKey: ['inventory-stats'] });
    qc.invalidateQueries({ queryKey: ['warehouse-stats'] });
    qc.invalidateQueries({ queryKey: ['qc-queue'] });
    qc.invalidateQueries({ queryKey: ['quality-stats'] });
    qc.invalidateQueries({ queryKey: ['quality-pending'] });
    qc.invalidateQueries({ queryKey: ['rfq-quotes'] });
  };

  const promptConfirm = (label: string, message: string, fn: () => void) => {
    setConfirmAction({ label, message, fn });
  };

  const openGrnForPo = (poId: string) => {
    setTab('grn');
    setPage(1);
    setGrnPoId(poId);
    setGrnQtys({});
  };

  const goToPo = (po: PurchaseOrder) => {
    setTab('po');
    setPage(1);
    setSearch(po.poNumber);
    setSearchInput(po.poNumber);
  };

  const addPrLine = () => {
    const mat = materials.find((m: Material) => m._id === prMaterialId);
    const qty = Number(prQty);
    if (!mat || !qty || qty <= 0) return;
    if (prLines.some((l) => l.materialId === mat._id)) {
      setError('Material already on this PR — adjust quantity or remove the line first');
      return;
    }
    setPrLines((lines) => [...lines, {
      materialId: mat._id,
      requiredQty: qty,
      unit: mat.unit,
      estimatedUnitCost: mat.unitCost || 0,
    }]);
    setPrMaterialId('');
    setError('');
  };

  const createSupplier = useMutation({
    mutationFn: () => purchaseApi.createSupplier({
      supplierCode: supplierForm.supplierCode.trim(),
      name: supplierForm.name.trim(),
      contactEmail: supplierForm.contactEmail || undefined,
      leadTimeDays: Number(supplierForm.leadTimeDays) || 7,
    }),
    onSuccess: () => {
      setSupplierForm({ supplierCode: '', name: '', contactEmail: '', leadTimeDays: '7' });
      invalidate();
      showSuccess('Supplier added');
    },
    onError: (e: Error) => setError(e.message),
  });

  const createPR = useMutation({
    mutationFn: () => purchaseApi.createPR({ lines: prLines }),
    onSuccess: () => {
      setPrLines([]);
      invalidate();
      showSuccess('Purchase requisition created');
    },
    onError: (e: Error) => setError(e.message),
  });

  const workflow = useMutation({
    mutationFn: async (action: { type: string; id?: string; body?: object; comments?: string; supplierIds?: string[] }) => {
      switch (action.type) {
        case 'submitPr': return purchaseApi.submitPR(action.id!);
        case 'approvePr': return purchaseApi.approvePR(action.id!);
        case 'rejectPr': return purchaseApi.rejectPR(action.id!, action.comments!);
        case 'createPo': return purchaseApi.createPO(action.body as { supplierId: string; prId: string });
        case 'approvePo': return purchaseApi.approvePO(action.id!);
        case 'sendPo': return purchaseApi.sendPO(action.id!);
        case 'createGrn': return purchaseApi.createGRN(action.body as { poId: string; lines: { materialId: string; receivedQty: number; unit?: string }[] });
        case 'submitGrn': return purchaseApi.submitGrnQc(action.id!);
        case 'rfq': return purchaseApi.createRfqFromPr(action.id!, action.supplierIds);
        case 'sendRfq': return purchaseApi.sendRfq(action.id!);
        case 'quote': return purchaseApi.addQuotation(action.id!, action.body as Parameters<typeof purchaseApi.addQuotation>[1]);
        case 'selectQuote': return purchaseApi.selectQuotation(action.id!);
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (result, vars) => {
      setConfirmAction(null);
      setRejectPrId(null);
      invalidate();
      if (vars.type === 'selectQuote' && result && 'purchaseOrder' in result) {
        showSuccess(`PO ${result.purchaseOrder.poNumber} created from quotation`);
      } else if (vars.type === 'createGrn') {
        showSuccess(purchaseSuccessMessage('createGrn'));
        setGrnPoId('');
        setGrnQtys({});
        setTab('grn');
      } else if (vars.type === 'approvePr' && result && typeof result === 'object' && 'status' in result) {
        showSuccess(purchaseSuccessMessage('approvePr', (result as PurchaseRequisition).status));
      } else {
        showSuccess(purchaseSuccessMessage(vars.type));
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const materialKey = (id: string | Material) => (typeof id === 'string' ? id : id._id);

  const submitGrn = () => {
    if (!grnPoId || !grnPreview?.lines.length) return;
    const lines = grnPreview.lines.map((l) => ({
      materialId: materialKey(l.materialId),
      receivedQty: grnQtys[materialKey(l.materialId)] ?? l.remainingQty,
      unit: l.unit,
    })).filter((l) => (l.receivedQty ?? 0) > 0);
    if (!lines.length) {
      setError('Enter receive quantities');
      return;
    }
    workflow.mutate({ type: 'createGrn', body: { poId: grnPoId, lines } });
  };

  const activeFlowStep = tab === 'pr' ? 'pr'
    : tab === 'po' || tab === 'rfq' ? 'po'
      : tab === 'grn' ? 'grn'
        : 'pr';

  const submitQuote = () => {
    const rfq = items.find((r) => (r as Rfq)._id === quoteRfqId) as Rfq | undefined;
    if (!quoteRfqId || !quoteSupplierId || !rfq?.lines?.length) {
      setError('Select an RFQ with lines and a supplier');
      return;
    }
    const unitPrice = Number(quotePrice);
    if (!unitPrice || unitPrice < 0) {
      setError('Enter a valid unit price');
      return;
    }
    workflow.mutate({
      type: 'quote',
      id: quoteRfqId,
      body: {
        supplierId: quoteSupplierId,
        lines: rfq.lines.map((rfqLine) => {
          const mat = typeof rfqLine.materialId === 'object' ? (rfqLine.materialId as Material) : materials.find((m) => m._id === rfqLine.materialId);
          return {
            materialId: typeof rfqLine.materialId === 'object' ? (rfqLine.materialId as Material)._id : String(rfqLine.materialId),
            quantity: rfqLine.quantity || rfqLine.requiredQty || 1,
            unit: rfqLine.unit || mat?.unit || 'PIECES',
            unitPrice,
          };
        }),
      },
    });
  };

  return (
    <div className="purchase-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Purchase"
        subtitle={(
          <>
            Store Keeper PR → Purchase Manager + Admin approve → Purchase Manager PO/RFQ → GRN → QC → stock.
            <Link to="/approvals" className="ml-2 text-[var(--erp-accent)]">Approvals →</Link>
            <Link to="/production/orders" className="ml-2 text-[var(--erp-accent)]">Production →</Link>
            <Link to="/quality" className="ml-2 text-[var(--erp-accent)]">Quality →</Link>
            <Link to="/inventory" className="ml-2 text-[var(--erp-accent)]">Inventory →</Link>
          </>
        )}
        actions={(
          <div className="flex gap-2">
            {canExport && items.length > 0 && (
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => {
                if (tab === 'po') {
                  downloadCsv('purchase-orders.csv', ['PO', 'Status', 'Total'], (items as PurchaseOrder[]).map((p) => [p.poNumber, p.status, (p as PurchaseOrder & { totalAmount?: number }).totalAmount ?? '']));
                } else if (tab === 'pr') {
                  downloadCsv('purchase-requisitions.csv', ['PR', 'Status'], (items as PurchaseRequisition[]).map((p) => [p.prNumber, p.status]));
                } else if (tab === 'grn') {
                  downloadCsv('goods-receipts.csv', ['GRN', 'Status'], (items as GoodsReceipt[]).map((g) => [g.grnNumber, g.status]));
                } else if (tab === 'suppliers') {
                  downloadCsv(
                    'suppliers.csv',
                    ['Vendor ID', 'Name', 'Contact Person', 'Mobile', 'Email', 'GST No.', 'Material Supplied', 'Payment Terms', 'Status'],
                    (items as Supplier[]).map((s) => [
                      s.supplierCode,
                      s.name,
                      s.contactPerson || '',
                      s.phone || '',
                      s.contactEmail || '',
                      s.gstNumber || '',
                      s.materialsSupplied || '',
                      s.paymentTerms || '',
                      s.status || 'ACTIVE',
                    ]),
                  );
                }
              }}>
                <Download size={12} className="mr-1 inline" /> Export CSV
              </ErpButton>
            )}
            <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={isFetching} onClick={() => { refetch(); invalidate(); }}>
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              <span className="ml-1">Refresh</span>
            </ErpButton>
          </div>
        )}
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-amber-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">PR pending</p>
              <p className="text-lg font-semibold">{(stats?.prDraft ?? 0) + (stats?.prSubmitted ?? 0)}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Open POs</p>
              <p className="text-lg font-semibold">{stats?.poOpen ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">GRN QC queue</p>
              <p className="text-lg font-semibold">{stats?.grnPendingQc ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-emerald-600" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Open PO value</p>
              <p className="text-lg font-semibold">{stats ? formatCurrency(stats.openPoValue) : '—'}</p>
            </div>
          </div>
        </ErpCard>
      </div>

      <ErpCard className="mb-3 !p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Raw material procurement flow</p>
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          {RM_PURCHASE_FLOW.map((step, i) => (
            <span key={step.id} className="flex items-center gap-1">
              {i > 0 && <ArrowRight size={10} className="text-erp-text-muted" />}
              <span
                className={`rounded px-1.5 py-0.5 ${
                  (step.id === activeFlowStep || (activeFlowStep === 'grn' && step.id === 'grn'))
                    ? 'bg-[var(--erp-accent-muted)] font-medium'
                    : 'text-erp-text-muted'
                }`}
                title={step.detail}
              >
                {step.label}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-erp-text-muted">
          Store Keeper creates PRs → Purchase Manager then Factory Admin approve → Purchase Manager runs RFQ/PO.
          After QC pass, stock lands on the unallocated dock; optional bin put-away feeds reserve/issue for samples and batches.
        </p>
      </ErpCard>

      <ErpTabs
        tabs={[
          { id: 'pr', label: `Requisitions (${(stats?.prDraft ?? 0) + (stats?.prSubmitted ?? 0) + (stats?.prApproved ?? 0)})` },
          { id: 'po', label: `Orders (${stats?.poOpen ?? 0} open)` },
          { id: 'grn', label: `Receipts (${(stats?.grnDraft ?? 0) + (stats?.grnPendingQc ?? 0)})` },
          ...(canExecute ? [
            { id: 'rfq' as const, label: `RFQ (${stats?.rfqOpen ?? 0})` },
            { id: 'suppliers' as const, label: `Suppliers (${stats?.suppliers ?? 0})` },
          ] : []),
          { id: 'history', label: 'History' },
        ]}
        active={tab}
        onChange={(id) => { setTab(id as TabId); setPage(1); setSearch(''); setSearchInput(''); }}
      />

      <div className="mt-3 space-y-3">
        {tab === 'pr' && canCreate && (
          <ErpCard className="!p-3">
            <h3 className="mb-2 text-[11px] font-semibold">New purchase requisition</h3>
            <p className="mb-2 text-[10px] text-erp-text-muted">
              {canExecute
                ? 'Create a PR, submit it, then approve via L1 Purchase Manager → L2 Factory Admin before PO/RFQ.'
                : 'Create and submit a PR. Purchase Manager and Factory Admin must approve before purchasing proceeds.'}
            </p>
            {materialsError && (
              <p className="mb-2 text-[10px] text-red-600">Could not load materials. Check factory access and purchase permissions.</p>
            )}
            {!materialsError && materials.length === 0 && (
              <p className="mb-2 text-[10px] text-erp-text-muted">No materials in this factory — add materials in Inventory first.</p>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1">
                <label className={fieldLabel}>Material</label>
                <ErpSelect className="w-full !py-1.5 text-[11px]" value={prMaterialId} onChange={(e) => setPrMaterialId(e.target.value)}>
                  <option value="">Select…</option>
                  {materials.map((m: Material) => (
                    <option key={m._id} value={m._id}>{m.materialCode} — {m.name}</option>
                  ))}
                </ErpSelect>
              </div>
              <div className="w-24">
                <label className={fieldLabel}>Qty</label>
                <ErpInput className="!py-1.5 text-[11px]" type="number" min={1} value={prQty} onChange={(e) => setPrQty(e.target.value)} />
              </div>
              <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={addPrLine}>Add line</ErpButton>
              <ErpButton className="!px-3 !py-1.5 text-[11px]" disabled={!prLines.length || createPR.isPending || materials.length === 0} onClick={() => createPR.mutate()}>
                Create PR ({prLines.length} lines)
              </ErpButton>
            </div>
            {prLines.length > 0 && (
              <p className="mt-2 text-[10px] text-erp-text-muted">
                {prLines.map((l, i) => {
                  const m = materials.find((x: Material) => x._id === l.materialId);
                  return <span key={i}>{i > 0 && ' · '}{m?.materialCode} {l.requiredQty} {l.unit}</span>;
                })}
              </p>
            )}
          </ErpCard>
        )}

        {tab === 'po' && canExecute && approvedPrs.length > 0 && (
          <ErpCard className="!p-3">
            <h3 className="mb-2 text-[11px] font-semibold">Create PO from approved PR</h3>
            <p className="mb-2 text-[10px] text-erp-text-muted">Only PRs still in APPROVED status appear here. Converted PRs are already linked to an order — use the Orders list below.</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[160px]">
                <label className={fieldLabel}>PR</label>
                <ErpSelect className="w-full !py-1.5 text-[11px]" value={poPrId} onChange={(e) => setPoPrId(e.target.value)}>
                  <option value="">Select PR…</option>
                  {approvedPrs.map((pr: PurchaseRequisition) => (
                    <option key={pr._id} value={pr._id}>{pr.prNumber}</option>
                  ))}
                </ErpSelect>
              </div>
              <div className="min-w-[160px]">
                <label className={fieldLabel}>Supplier</label>
                <ErpSelect className="w-full !py-1.5 text-[11px]" value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                  <option value="">Select supplier…</option>
                  {suppliers.map((s: Supplier) => (
                    <option key={s._id} value={s._id}>{s.supplierCode} — {s.name}</option>
                  ))}
                </ErpSelect>
              </div>
              <ErpButton className="!px-3 !py-1.5 text-[11px]" disabled={!poPrId || !poSupplierId || workflow.isPending} onClick={() => workflow.mutate({ type: 'createPo', body: { prId: poPrId, supplierId: poSupplierId } })}>
                Create PO
              </ErpButton>
            </div>
          </ErpCard>
        )}

        {tab === 'grn' && canReceive && (
          <ErpCard className="!p-3">
            <h3 className="mb-2 text-[11px] font-semibold">Goods receipt (GRN)</h3>
            <p className="mb-2 text-[10px] text-erp-text-muted">
              Receive against an open PO → submit incoming QC → Quality inspects → passed qty receipts to unallocated dock (optional put-away bin in QC).
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px]">
                <label className={fieldLabel}>Open PO</label>
                <ErpSelect className="w-full !py-1.5 text-[11px]" value={grnPoId} onChange={(e) => { setGrnPoId(e.target.value); setGrnQtys({}); }}>
                  <option value="">Select PO…</option>
                  {openPos.map((po: PurchaseOrder) => (
                    <option key={po._id} value={po._id}>{po.poNumber} — {supplierLabel(po.supplierId)} ({statusLabel(po.status)})</option>
                  ))}
                </ErpSelect>
              </div>
              {grnPreview && grnPreview.lines.length > 0 && (
                <ErpButton
                  className="!px-3 !py-1.5 text-[11px]"
                  disabled={workflow.isPending}
                  onClick={() => promptConfirm(
                    'Create GRN',
                    'Record received quantities? Stock is not updated until incoming QC passes in Quality.',
                    submitGrn,
                  )}
                >
                  Receive
                </ErpButton>
              )}
            </div>
            {grnPreview?.lines.map((l) => {
              const mid = materialKey(l.materialId);
              return (
              <div key={mid} className="mt-2 flex items-center gap-2 text-[10px]">
                <span className="min-w-[140px]">{l.materialCode} — {l.materialName}</span>
                <span className="text-erp-text-muted">Remaining {l.remainingQty} {unitLabel(l.unit)}</span>
                <ErpInput type="number" min={0} max={l.remainingQty} className="!w-20 !py-1 text-[10px]" value={grnQtys[mid] ?? l.remainingQty} onChange={(e) => setGrnQtys({ ...grnQtys, [mid]: Number(e.target.value) })} />
              </div>
            );})}
          </ErpCard>
        )}

        {tab === 'rfq' && canExecute && approvedPrs.length > 0 && (
          <ErpCard className="!p-3">
            <h3 className="mb-2 text-[11px] font-semibold">RFQ & quotation</h3>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px]">
                <label className={fieldLabel}>From PR</label>
                <ErpSelect className="w-full !py-1.5 text-[11px]" value={rfqPrId} onChange={(e) => setRfqPrId(e.target.value)}>
                  <option value="">PR…</option>
                  {approvedPrs.map((pr: PurchaseRequisition) => (
                    <option key={pr._id} value={pr._id}>{pr.prNumber}</option>
                  ))}
                </ErpSelect>
              </div>
              <div className="min-w-[140px]">
                <label className={fieldLabel}>Suppliers</label>
                <ErpSelect className="w-full !py-1.5 text-[11px]" value={rfqSupplierIds[0] || ''} onChange={(e) => setRfqSupplierIds(e.target.value ? [e.target.value] : [])}>
                  <option value="">Supplier…</option>
                  {suppliers.map((s: Supplier) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </ErpSelect>
              </div>
              <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" disabled={!rfqPrId || !rfqSupplierIds.length} onClick={() => workflow.mutate({ type: 'rfq', id: rfqPrId, supplierIds: rfqSupplierIds })}>Create RFQ</ErpButton>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-[var(--erp-border)] pt-2">
              <div className="min-w-[120px]">
                <label className={fieldLabel}>RFQ</label>
                <ErpSelect className="w-full !py-1.5 text-[11px]" value={quoteRfqId} onChange={(e) => setQuoteRfqId(e.target.value)}>
                  <option value="">Select…</option>
                  {(items as Rfq[]).filter((r: Rfq) => ['DRAFT', 'SENT'].includes(r.status)).map((r) => (
                    <option key={r._id} value={r._id}>{r.rfqNumber}</option>
                  ))}
                </ErpSelect>
              </div>
              <div className="min-w-[120px]">
                <label className={fieldLabel}>Supplier quote</label>
                <ErpSelect className="w-full !py-1.5 text-[11px]" value={quoteSupplierId} onChange={(e) => setQuoteSupplierId(e.target.value)}>
                  <option value="">…</option>
                  {suppliers.map((s: Supplier) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </ErpSelect>
              </div>
              <div className="w-20">
                <label className={fieldLabel}>Unit ₹</label>
                <ErpInput className="!py-1.5 text-[11px]" type="number" value={quotePrice} onChange={(e) => setQuotePrice(e.target.value)} />
              </div>
              <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={submitQuote}>Add quote</ErpButton>
            </div>
          </ErpCard>
        )}

        {tab === 'suppliers' && canExecute && (
          <ErpCard className="!p-3">
            <h3 className="mb-2 text-[11px] font-semibold">Add supplier</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className={fieldLabel}>Code</label>
                <ErpInput className="!py-1.5 text-[11px] font-mono" value={supplierForm.supplierCode} onChange={(e) => setSupplierForm({ ...supplierForm, supplierCode: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Name</label>
                <ErpInput className="!py-1.5 text-[11px]" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabel}>Lead days</label>
                <ErpInput className="!py-1.5 text-[11px]" type="number" value={supplierForm.leadTimeDays} onChange={(e) => setSupplierForm({ ...supplierForm, leadTimeDays: e.target.value })} />
              </div>
              <div className="flex items-end">
                <ErpButton className="w-full !py-1.5 text-[11px]" disabled={!supplierForm.supplierCode || !supplierForm.name || createSupplier.isPending} onClick={() => createSupplier.mutate()}>Add</ErpButton>
              </div>
            </div>
          </ErpCard>
        )}

        {tab === 'history' && (
          <ErpCard className="!p-3">
            <p className="text-[10px] text-erp-text-muted">
              Past purchases: PRs converted to PO (and linked GRN / QC). Active work stays on Requisitions, Orders, and Receipts.
            </p>
          </ErpCard>
        )}

        <ErpCard className="!p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--erp-border)] p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
              <ErpInput className="!py-1.5 pl-7 text-[11px]" placeholder="Search…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }} />
            </div>
            <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => { setSearch(searchInput); setPage(1); }}>Search</ErpButton>
          </div>

          {isLoading ? (
            <p className="p-4 text-[11px] text-erp-text-muted">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <ErpDataTable className={`w-full text-[11px] ${tab === 'suppliers' ? 'min-w-[1100px]' : 'min-w-[800px]'}`}>
                <thead>
                  <tr>
                    {tab === 'suppliers' ? (
                      <>
                        <th className="px-3 py-2 text-left">Vendor ID</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Contact Person</th>
                        <th className="px-3 py-2 text-left">Mobile</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">GST No.</th>
                        <th className="px-3 py-2 text-left">Material Supplied</th>
                        <th className="px-3 py-2 text-left">Payment Terms</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2 text-left">Document</th>
                        <th className="px-3 py-2 text-left">Details</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tab === 'pr' && (items as PurchaseRequisition[]).map((pr) => {
                    const approval = prApprovalByDocId.get(pr._id);
                    const canActLevel = approval
                      ? canActOnApproval(approval, permissions, userId)
                      : canApprove;
                    const levelHint = approval
                      ? `${workflowLevelLabel(approval)} · needs ${requiredApproverLabel(approval)}`
                      : null;
                    return (
                    <tr key={pr._id} className="border-t border-[var(--erp-border)]">
                      <td className="px-3 py-2 font-mono">
                        {pr.prNumber}
                        {(pr as PurchaseRequisition & { sourceType?: string }).sourceType === 'MRP' && (
                          <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] text-amber-800">MRP</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-erp-text-muted">
                        {lineSummary(pr.lines)}
                        <span className="mt-0.5 block text-[9px]">{prSourceLabel(pr as PurchaseRequisition & { sourceType?: string })}</span>
                      </td>
                      <td className="px-3 py-2">
                        <ErpStatusBadge status={pr.status} label={statusLabel(pr.status)} />
                        <p className="mt-0.5 text-[10px] text-erp-text-muted">
                          {pr.status === 'SUBMITTED' && levelHint
                            ? levelHint
                            : workflowHint('pr', pr.status)}
                        </p>
                        {pr.status === 'SUBMITTED' && approval && (approval.currentLevel ?? 1) > 1 && (
                          <p className="mt-0.5 text-[9px] text-emerald-700">
                            L1 done (Purchase Manager) — waiting on Factory Admin
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {canUpdate && (pr.status === 'DRAFT' || pr.status === 'REJECTED') && (
                            <ErpButton className="!px-2 !py-1 text-[10px]" onClick={() => promptConfirm('Submit PR for approval?', 'Starts dual approval: Purchase Manager (L1) then Factory Admin (L2).', () => workflow.mutate({ type: 'submitPr', id: pr._id }))}>
                              {pr.status === 'REJECTED' ? 'Resubmit' : 'Submit'}
                            </ErpButton>
                          )}
                          {pr.status === 'SUBMITTED' && !canActLevel && (
                            <ApprovalsHint label={
                              approval && (approval.currentLevel ?? 1) > 1
                                ? 'Awaiting Factory Admin (L2)'
                                : 'Awaiting approver'
                            }
                            />
                          )}
                          {pr.status === 'SUBMITTED' && canActLevel && (
                            <>
                              <ErpButton
                                className="!px-2 !py-1 text-[10px]"
                                onClick={() => workflow.mutate({ type: 'approvePr', id: pr._id })}
                              >
                                {(approval?.currentLevel ?? 1) > 1 ? 'Approve L2' : 'Approve L1'}
                              </ErpButton>
                              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => setRejectPrId(pr._id)}>Reject</ErpButton>
                            </>
                          )}
                          {canExecute && pr.status === 'APPROVED' && (
                            <ErpButton className="!px-2 !py-1 text-[10px]" onClick={() => { setPoPrId(pr._id); setTab('po'); }}>Create PO</ErpButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );})}

                  {tab === 'history' && (items as PurchaseRequisition[]).map((pr) => {
                    const linkedPo = findPoForPr(posForPrLink, pr);
                    const linkedGrns = linkedPo ? findGrnsForPo(historyGrns, linkedPo._id) : [];
                    const latestGrn = linkedGrns[0];
                    return (
                      <tr key={pr._id} className="border-t border-[var(--erp-border)]">
                        <td className="px-3 py-2 font-mono">
                          {pr.prNumber}
                          {linkedPo && (
                            <span className="mt-0.5 block text-[9px] text-erp-text-muted">{linkedPo.poNumber}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[10px] text-erp-text-muted">
                          {lineSummary(pr.lines)}
                          {linkedPo && (
                            <span className="mt-0.5 block text-[9px]">
                              {supplierLabel(linkedPo.supplierId)} · {formatCurrency(linkedPo.totalAmount)}
                            </span>
                          )}
                          {latestGrn && (
                            <span className="mt-0.5 block text-[9px] text-[var(--erp-accent)]">
                              {latestGrn.grnNumber} · {statusLabel(latestGrn.status)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <ErpStatusBadge
                            status={latestGrn?.status === 'COMPLETED' ? 'DELIVERED' : 'SHIPPED'}
                            label={latestGrn?.status === 'COMPLETED' ? 'Completed' : 'In history'}
                          />
                          <p className="mt-0.5 text-[10px] text-erp-text-muted">
                            {historyPurchaseLabel(linkedPo, linkedGrns)}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {linkedPo && (
                              <ErpButton className="!px-2 !py-1 text-[10px]" onClick={() => goToPo(linkedPo)}>View PO</ErpButton>
                            )}
                            {latestGrn?.status === 'COMPLETED' && (
                              <>
                                <Link to="/inventory?tab=stock" className="self-center text-[10px] text-[var(--erp-accent)]">Inventory</Link>
                                <Link to="/warehouse/operations/put-away" className="self-center text-[10px] text-[var(--erp-accent)]">Put away</Link>
                              </>
                            )}
                            {latestGrn?.status === 'PENDING_QC' && (
                              <Link to="/quality" className="self-center text-[10px] text-[var(--erp-accent)]">QC →</Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {tab === 'po' && (items as PurchaseOrder[]).map((po) => (
                    <tr key={po._id} className="border-t border-[var(--erp-border)]">
                      <td className="px-3 py-2 font-mono">{po.poNumber}</td>
                      <td className="px-3 py-2 text-[10px]">
                        {po.prId && <span className="block font-mono text-[9px] text-erp-text-muted">PR {prNumber(po.prId)}</span>}
                        {supplierLabel(po.supplierId)} · {formatCurrency(po.totalAmount)}
                        <span className="mt-0.5 block text-[9px] text-erp-text-muted">{lineSummary(po.lines)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <ErpStatusBadge status={po.status} label={statusLabel(po.status)} />
                        <p className="mt-0.5 text-[10px] text-erp-text-muted">{workflowHint('po', po.status)}</p>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {canApprove && po.status === 'DRAFT' && (
                            <ErpButton className="!px-2 !py-1 text-[10px]" onClick={() => workflow.mutate({ type: 'approvePo', id: po._id })}>Approve</ErpButton>
                          )}
                          {canExecute && po.status === 'APPROVED' && (
                            <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => workflow.mutate({ type: 'sendPo', id: po._id })}>Send</ErpButton>
                          )}
                          {canReceive && ['APPROVED', 'SENT', 'PARTIAL'].includes(po.status) && (
                            <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => openGrnForPo(po._id)}>Receive GRN</ErpButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {tab === 'grn' && (items as GoodsReceipt[]).map((grn) => {
                    const next = grnNextStep(grn.status);
                    return (
                      <tr key={grn._id} className="border-t border-[var(--erp-border)]">
                        <td className="px-3 py-2 font-mono">{grn.grnNumber}</td>
                        <td className="px-3 py-2 text-[10px]">
                          PO {poNumber(grn.poId)}
                          <span className="mt-0.5 block text-[9px] text-erp-text-muted">{grnLineSummary(grn)}</span>
                        </td>
                        <td className="px-3 py-2">
                          <ErpStatusBadge status={grn.status} label={statusLabel(grn.status)} />
                          <p className="mt-0.5 text-[10px] text-erp-text-muted">{workflowHint('grn', grn.status)}</p>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {canUpdate && grn.status === 'DRAFT' && (
                              <ErpButton
                                variant="secondary"
                                className="!px-2 !py-1 text-[10px]"
                                onClick={() => promptConfirm(
                                  'Submit for incoming QC',
                                  'Send GRN to Quality? Physical stock is not updated until QC passes.',
                                  () => workflow.mutate({ type: 'submitGrn', id: grn._id }),
                                )}
                              >
                                Submit QC
                              </ErpButton>
                            )}
                            {grn.status === 'PENDING_QC' && next && (
                              <Link to={next.path} className="inline-flex items-center text-[10px] text-[var(--erp-accent)]">{next.label} →</Link>
                            )}
                            {grn.status === 'COMPLETED' && (
                              <>
                                <Link to="/inventory?tab=stock" className="text-[10px] text-[var(--erp-accent)]">View stock</Link>
                                <Link to="/warehouse/operations/put-away" className="text-[10px] text-[var(--erp-accent)]">Put away</Link>
                                <Link to="/production/orders" className="text-[10px] text-[var(--erp-accent)]">Production</Link>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {tab === 'rfq' && (items as Rfq[]).map((rfq) => (
                    <RfqRow key={rfq._id} rfq={rfq} canUpdate={canUpdate} canApprove={canApprove} onSend={() => workflow.mutate({ type: 'sendRfq', id: rfq._id })} onSelect={(id) => workflow.mutate({ type: 'selectQuote', id })} />
                  ))}

                  {tab === 'suppliers' && (items as Supplier[]).map((s) => (
                    <tr key={s._id} className="border-t border-[var(--erp-border)]">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{s.supplierCode}</td>
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2 text-erp-text-muted">{s.contactPerson || '—'}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{s.phone || '—'}</td>
                      <td className="px-3 py-2 text-erp-text-muted">{s.contactEmail || '—'}</td>
                      <td className="px-3 py-2 font-mono text-[10px] whitespace-nowrap">{s.gstNumber || '—'}</td>
                      <td className="px-3 py-2">{s.materialsSupplied || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{s.paymentTerms || '—'}</td>
                      <td className="px-3 py-2"><ErpStatusBadge status={s.status || 'ACTIVE'} /></td>
                    </tr>
                  ))}

                  {items.length === 0 && (
                    <tr>
                      <td colSpan={tab === 'suppliers' ? 9 : 4} className="px-4 py-8 text-center text-erp-text-muted">
                        {tab === 'history'
                          ? 'No past purchases yet — converted PRs appear here after PO creation'
                          : 'No records'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </ErpDataTable>
            </div>
          )}
          {meta && meta.totalPages > 0 && (
            <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2">
              <p className="text-[10px] text-erp-text-muted">{meta.page}/{meta.totalPages} · {meta.total}</p>
              <div className="flex gap-1">
                <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</ErpButton>
                <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
              </div>
            </div>
          )}
        </ErpCard>
      </div>

      <ConfirmDialog open={!!confirmAction} title={confirmAction?.label ?? ''} message={confirmAction?.message ?? 'Continue?'} confirmLabel="Yes" loading={workflow.isPending} onCancel={() => setConfirmAction(null)} onConfirm={() => confirmAction?.fn()} />
      <CommentPrompt open={!!rejectPrId} title="Reject PR" message="Reason for rejection (min 3 characters)" required minLength={3} confirmLabel="Reject" loading={workflow.isPending} onCancel={() => setRejectPrId(null)} onConfirm={(comments) => { if (rejectPrId) workflow.mutate({ type: 'rejectPr', id: rejectPrId, comments }); }} />
    </div>
  );
}

function RfqRow({ rfq, canUpdate, canApprove, onSend, onSelect }: {
  rfq: Rfq; canUpdate: boolean; canApprove: boolean; onSend: () => void; onSelect: (id: string) => void;
}) {
  const { data: quotes = [] } = useQuery({
    queryKey: ['rfq-quotes', rfq._id],
    queryFn: () => purchaseApi.compareQuotations(rfq._id),
    enabled: ['DRAFT', 'SENT'].includes(rfq.status),
  });

  return (
    <>
      <tr className="border-t border-[var(--erp-border)]">
        <td className="px-3 py-2 font-mono">{rfq.rfqNumber}</td>
        <td className="px-3 py-2 text-[10px]">PR {prNumber(rfq.prId)}</td>
        <td className="px-3 py-2"><ErpStatusBadge status={rfq.status} label={statusLabel(rfq.status)} /></td>
        <td className="px-3 py-2 text-right">
          {canUpdate && rfq.status === 'DRAFT' && (
            <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={onSend}>Send</ErpButton>
          )}
        </td>
      </tr>
      {quotes.length > 0 && (
        <tr className="bg-[var(--erp-surface-muted)]">
          <td colSpan={4} className="px-3 py-2 text-[10px]">
            {quotes.map((q: Quotation) => (
              <div key={q._id} className="flex items-center justify-between py-0.5">
                <span>{supplierLabel(q.supplierId)} — {formatCurrency(q.totalAmount)}</span>
                {canApprove && q.status === 'SUBMITTED' && (
                  <ErpButton className="!px-2 !py-0.5 text-[10px]" onClick={() => onSelect(q._id)}>Select → PO</ErpButton>
                )}
                {q.status === 'SELECTED' && <span className="text-emerald-600">Selected</span>}
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}
