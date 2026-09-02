import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, ClipboardList, Download, FileText, RefreshCw, Search, ShoppingCart, Truck, X,
} from 'lucide-react';
import { purchaseApi } from '../../services/operations';
import { inventoryApi } from '../../services/manufacturing';
import { approvalApi } from '../../services/approvals';
import { AlertBanner } from '../../components/AlertBanner';
import { ApprovalsHint } from '../../components/ApprovalsHint';
import {
  ActionStack, ComposeSection, EmptyRow, ErpButton, ErpDataTable, ErpInput, ErpPageHeader,
  ErpSelect, ErpStatusBadge, ErpTabs, StatTile, TabShell, TabToolbar, TablePager, TextLink,
  btnSm, fieldLabel,
} from '../../components/erp';
import type {
  ApprovalInstance, GoodsReceipt, Material, PurchaseLine, PurchaseOrder, PurchaseRequisition, Quotation, Rfq, Supplier,
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
  materialLabel, poNumber, prNumber, prSourceLabel, purchaseSuccessMessage,
  RM_PURCHASE_FLOW, statusLabel, supplierLabel, workflowHint,
} from './purchaseUtils';
import { unitLabel } from '../inventory/inventoryUtils';
import { downloadCsv } from '../../utils/csvExport';

const PAGE_SIZE = 15;

type TabId = 'pr' | 'po' | 'grn' | 'rfq' | 'suppliers' | 'history';

type PrLine = { materialId: string; requiredQty: number; unit: string; estimatedUnitCost: number };

function LinesList({ lines }: { lines?: PurchaseLine[] }) {
  if (!lines?.length) return <span className="text-erp-text-muted">-</span>;
  return (
    <ul className="space-y-0.5">
      {lines.map((l, i) => (
        <li key={i} className="text-[12px] leading-snug">
          <span className="text-erp-text-primary">{materialLabel(l.materialId)}</span>
          <span className="text-erp-text-muted">
            {' '}{l.requiredQty ?? l.orderedQty ?? l.quantity ?? 0} {l.unit || ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PurchasePage() {
  const qc = useQueryClient();
  const { permissions, user } = useAuth();
  const userId = user?._id;
  const canCreate = permissions.includes('*') || permissions.includes('purchase.create');
  const canUpdate = permissions.includes('*') || permissions.includes('purchase.update');
  const canApprove = permissions.includes('*') || permissions.includes('purchase.approve');
  const canExport = permissions.includes('*') || permissions.includes('purchase.export');
  const canReadApprovals = permissions.includes('*') || permissions.includes('approval.read');
  const canExecute = canCreate && canApprove;
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
            ...(search ? {} : { status: 'DRAFT,APPROVED,SENT,PARTIAL' }),
          });
        case 'grn':
          return purchaseApi.listGRNsPage({
            ...params,
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

  const goTab = (id: TabId) => {
    setTab(id);
    setPage(1);
    setSearch('');
    setSearchInput('');
  };

  const openGrnForPo = (poId: string) => {
    goTab('grn');
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
      setError('Material already on this PR - adjust quantity or remove the line first');
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

  const removePrLine = (materialId: string) => {
    setPrLines((lines) => lines.filter((l) => l.materialId !== materialId));
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

  const runSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const tabTitle =
    tab === 'pr' ? 'Requisitions'
      : tab === 'po' ? 'Purchase orders'
        : tab === 'grn' ? 'Goods receipts'
          : tab === 'rfq' ? 'RFQs'
            : tab === 'suppliers' ? 'Suppliers'
              : 'Purchase history';

  const tabHint =
    tab === 'pr' ? 'Create, submit, and approve requisitions before PO or RFQ.'
      : tab === 'po' ? 'Create from an approved PR, then approve, send, and receive.'
        : tab === 'grn' ? 'Receive against an open PO. Stock updates after incoming QC.'
          : tab === 'rfq' ? 'Send RFQs from approved PRs, record quotes, then select a winner.'
            : tab === 'suppliers' ? 'Vendor master used on POs and RFQs.'
              : 'Converted PRs with linked PO and GRN.';

  const listColSpan = tab === 'suppliers' ? 9 : tab === 'po' ? 6 : tab === 'history' ? 6 : tab === 'rfq' ? 5 : 5;

  return (
    <div className="purchase-page space-y-3">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Purchase"
        subtitle={(
          <>
            Store Keeper PR -&gt; dual approval -&gt; PO/RFQ -&gt; GRN -&gt; QC -&gt; stock.
            <Link to="/approvals" className="ml-2 text-[var(--erp-accent)]">Approvals -&gt;</Link>
            <Link to="/quality" className="ml-2 text-[var(--erp-accent)]">Quality -&gt;</Link>
            <Link to="/inventory" className="ml-2 text-[var(--erp-accent)]">Inventory -&gt;</Link>
          </>
        )}
        actions={(
          <div className="flex gap-2">
            {canExport && items.length > 0 && (
              <ErpButton variant="secondary" className={btnSm} onClick={() => {
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
                <Download size={13} className="mr-1 inline" /> Export CSV
              </ErpButton>
            )}
            <ErpButton variant="secondary" className={btnSm} disabled={isFetching} onClick={() => { refetch(); invalidate(); }}>
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              <span className="ml-1">Refresh</span>
            </ErpButton>
          </div>
        )}
      />

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--erp-border)] bg-[var(--erp-border)] sm:grid-cols-4">
        <StatTile
          icon={ClipboardList}
          label="PR pending"
          value={(stats?.prDraft ?? 0) + (stats?.prSubmitted ?? 0)}
          hint="Draft + submitted requisitions"
          highlight={(stats?.prDraft ?? 0) + (stats?.prSubmitted ?? 0) > 0 ? 'warn' : undefined}
          onClick={() => goTab('pr')}
        />
        <StatTile
          icon={ShoppingCart}
          label="Open POs"
          value={stats?.poOpen ?? '-'}
          onClick={() => goTab('po')}
        />
        <StatTile
          icon={Truck}
          label="GRN QC queue"
          value={stats?.grnPendingQc ?? '-'}
          highlight={(stats?.grnPendingQc ?? 0) > 0 ? 'accent' : undefined}
          onClick={() => goTab('grn')}
        />
        <StatTile
          icon={FileText}
          label="Open PO value"
          value={stats ? formatCurrency(stats.openPoValue) : '-'}
          onClick={() => goTab('po')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] px-3 py-2 text-[12px]">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-erp-text-muted">Flow</span>
        {RM_PURCHASE_FLOW.map((step, i) => (
          <span key={step.id} className="flex items-center gap-1">
            {i > 0 && <ArrowRight size={11} className="text-erp-text-muted" />}
            <span
              className={`rounded px-1.5 py-0.5 ${
                step.id === activeFlowStep || (activeFlowStep === 'grn' && step.id === 'qc')
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

      <TabShell
        tabs={(
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
            onChange={(id) => goTab(id as TabId)}
          />
        )}
      >
        {tab === 'pr' && canCreate && (
          <ComposeSection
            title="New purchase requisition"
            hint={canExecute
              ? 'Add lines, create the PR, then submit. Approval is L1 Purchase Manager then L2 Factory Admin.'
              : 'Add lines, create and submit. Purchase Manager and Factory Admin must approve before PO/RFQ.'}
          >
            {materialsError && (
              <p className="mb-2 text-[12px] text-red-600">Could not load materials. Check factory access and purchase permissions.</p>
            )}
            {!materialsError && materials.length === 0 && (
              <p className="mb-2 text-[12px] text-erp-text-muted">
                No materials in this factory - add them in{' '}
                <Link to="/inventory" className="text-[var(--erp-accent)]">Inventory</Link> first.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <label className={fieldLabel}>Material</label>
                <ErpSelect className="w-full !py-1.5 text-[12px]" value={prMaterialId} onChange={(e) => setPrMaterialId(e.target.value)}>
                  <option value="">Select...</option>
                  {materials.map((m: Material) => (
                    <option key={m._id} value={m._id}>{m.materialCode} - {m.name}</option>
                  ))}
                </ErpSelect>
              </div>
              <div className="w-28">
                <label className={fieldLabel}>Qty</label>
                <ErpInput className="!py-1.5 text-[12px]" type="number" min={1} value={prQty} onChange={(e) => setPrQty(e.target.value)} />
              </div>
              <ErpButton variant="secondary" className={btnSm} onClick={addPrLine}>Add line</ErpButton>
            </div>
            {prLines.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-md border border-[var(--erp-border)]">
                <ErpDataTable className="w-full text-[12px]">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="text-right">Qty</th>
                      <th>Unit</th>
                      <th className="text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {prLines.map((l) => {
                      const m = materials.find((x: Material) => x._id === l.materialId);
                      return (
                        <tr key={l.materialId}>
                          <td>
                            <p className="font-mono text-[12px] font-medium">{m?.materialCode || l.materialId}</p>
                            <p className="text-[12px] text-erp-text-muted">{m?.name}</p>
                          </td>
                          <td className="text-right">{l.requiredQty}</td>
                          <td>{unitLabel(l.unit)}</td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="rounded p-1 text-erp-text-muted hover:bg-[var(--erp-surface-muted)] hover:text-erp-text-primary"
                              onClick={() => removePrLine(l.materialId)}
                              aria-label="Remove line"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </ErpDataTable>
              </div>
            )}
            <div className="mt-3">
              <ErpButton className={btnSm} disabled={!prLines.length || createPR.isPending || materials.length === 0} onClick={() => createPR.mutate()}>
                {createPR.isPending ? 'Creating...' : `Create PR (${prLines.length} line${prLines.length === 1 ? '' : 's'})`}
              </ErpButton>
            </div>
          </ComposeSection>
        )}

        {tab === 'po' && canExecute && approvedPrs.length > 0 && (
          <ComposeSection
            title="Create PO from approved PR"
            hint="Only PRs still in APPROVED status appear here. Converted PRs are on History and Orders."
          >
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px]">
                <label className={fieldLabel}>PR</label>
                <ErpSelect className="w-full !py-1.5 text-[12px]" value={poPrId} onChange={(e) => setPoPrId(e.target.value)}>
                  <option value="">Select PR...</option>
                  {approvedPrs.map((pr: PurchaseRequisition) => (
                    <option key={pr._id} value={pr._id}>{pr.prNumber}</option>
                  ))}
                </ErpSelect>
              </div>
              <div className="min-w-[200px] flex-1">
                <label className={fieldLabel}>Supplier</label>
                <ErpSelect className="w-full !py-1.5 text-[12px]" value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                  <option value="">Select supplier...</option>
                  {suppliers.map((s: Supplier) => (
                    <option key={s._id} value={s._id}>{s.supplierCode} - {s.name}</option>
                  ))}
                </ErpSelect>
              </div>
              <ErpButton className={btnSm} disabled={!poPrId || !poSupplierId || workflow.isPending} onClick={() => workflow.mutate({ type: 'createPo', body: { prId: poPrId, supplierId: poSupplierId } })}>
                Create PO
              </ErpButton>
            </div>
          </ComposeSection>
        )}

        {tab === 'grn' && canReceive && (
          <ComposeSection
            title="Receive goods (GRN)"
            hint="Record quantities against an open PO, then submit incoming QC. Stock is not updated until QC passes."
          >
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[240px] flex-1">
                <label className={fieldLabel}>Open PO</label>
                <ErpSelect className="w-full !py-1.5 text-[12px]" value={grnPoId} onChange={(e) => { setGrnPoId(e.target.value); setGrnQtys({}); }}>
                  <option value="">Select PO...</option>
                  {openPos.map((po: PurchaseOrder) => (
                    <option key={po._id} value={po._id}>{po.poNumber} - {supplierLabel(po.supplierId)} ({statusLabel(po.status)})</option>
                  ))}
                </ErpSelect>
              </div>
              {grnPreview && grnPreview.lines.length > 0 && (
                <ErpButton
                  className={btnSm}
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
            {grnPreview && grnPreview.lines.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-md border border-[var(--erp-border)]">
                <ErpDataTable className="w-full text-[12px]">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="text-right">Remaining</th>
                      <th className="text-right">Receive qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grnPreview.lines.map((l) => {
                      const mid = materialKey(l.materialId);
                      return (
                        <tr key={mid}>
                          <td>
                            <p className="font-mono text-[12px] font-medium">{l.materialCode}</p>
                            <p className="text-[12px] text-erp-text-muted">{l.materialName}</p>
                          </td>
                          <td className="whitespace-nowrap text-right text-erp-text-muted">
                            {l.remainingQty} {unitLabel(l.unit)}
                          </td>
                          <td className="text-right">
                            <ErpInput
                              type="number"
                              min={0}
                              max={l.remainingQty}
                              className="ml-auto !w-24 !py-1 text-[12px]"
                              value={grnQtys[mid] ?? l.remainingQty}
                              onChange={(e) => setGrnQtys({ ...grnQtys, [mid]: Number(e.target.value) })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </ErpDataTable>
              </div>
            )}
          </ComposeSection>
        )}

        {tab === 'rfq' && canExecute && approvedPrs.length > 0 && (
          <ComposeSection
            title="RFQ and quotation"
            hint="Create an RFQ from an approved PR, send it, then record supplier quotes and select a winner to create a PO."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-[var(--erp-border)] p-3">
                <p className="mb-2 text-[12px] font-medium text-erp-text-primary">Create RFQ</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[140px] flex-1">
                    <label className={fieldLabel}>From PR</label>
                    <ErpSelect className="w-full !py-1.5 text-[12px]" value={rfqPrId} onChange={(e) => setRfqPrId(e.target.value)}>
                      <option value="">PR...</option>
                      {approvedPrs.map((pr: PurchaseRequisition) => (
                        <option key={pr._id} value={pr._id}>{pr.prNumber}</option>
                      ))}
                    </ErpSelect>
                  </div>
                  <div className="min-w-[140px] flex-1">
                    <label className={fieldLabel}>Supplier</label>
                    <ErpSelect className="w-full !py-1.5 text-[12px]" value={rfqSupplierIds[0] || ''} onChange={(e) => setRfqSupplierIds(e.target.value ? [e.target.value] : [])}>
                      <option value="">Supplier...</option>
                      {suppliers.map((s: Supplier) => (
                        <option key={s._id} value={s._id}>{s.name}</option>
                      ))}
                    </ErpSelect>
                  </div>
                  <ErpButton variant="secondary" className={btnSm} disabled={!rfqPrId || !rfqSupplierIds.length} onClick={() => workflow.mutate({ type: 'rfq', id: rfqPrId, supplierIds: rfqSupplierIds })}>
                    Create RFQ
                  </ErpButton>
                </div>
              </div>
              <div className="rounded-md border border-[var(--erp-border)] p-3">
                <p className="mb-2 text-[12px] font-medium text-erp-text-primary">Add quote</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[120px] flex-1">
                    <label className={fieldLabel}>RFQ</label>
                    <ErpSelect className="w-full !py-1.5 text-[12px]" value={quoteRfqId} onChange={(e) => setQuoteRfqId(e.target.value)}>
                      <option value="">Select...</option>
                      {(items as Rfq[]).filter((r: Rfq) => ['DRAFT', 'SENT'].includes(r.status)).map((r) => (
                        <option key={r._id} value={r._id}>{r.rfqNumber}</option>
                      ))}
                    </ErpSelect>
                  </div>
                  <div className="min-w-[120px] flex-1">
                    <label className={fieldLabel}>Supplier</label>
                    <ErpSelect className="w-full !py-1.5 text-[12px]" value={quoteSupplierId} onChange={(e) => setQuoteSupplierId(e.target.value)}>
                      <option value="">Select...</option>
                      {suppliers.map((s: Supplier) => (
                        <option key={s._id} value={s._id}>{s.name}</option>
                      ))}
                    </ErpSelect>
                  </div>
                  <div className="w-24">
                    <label className={fieldLabel}>Unit Rs</label>
                    <ErpInput className="!py-1.5 text-[12px]" type="number" value={quotePrice} onChange={(e) => setQuotePrice(e.target.value)} />
                  </div>
                  <ErpButton variant="secondary" className={btnSm} onClick={submitQuote}>Add quote</ErpButton>
                </div>
              </div>
            </div>
          </ComposeSection>
        )}

        {tab === 'suppliers' && canExecute && (
          <ComposeSection title="Add supplier" hint="Used when creating POs and RFQs.">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className={fieldLabel}>Code</label>
                <ErpInput className="!py-1.5 font-mono text-[12px]" value={supplierForm.supplierCode} onChange={(e) => setSupplierForm({ ...supplierForm, supplierCode: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Name</label>
                <ErpInput className="!py-1.5 text-[12px]" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabel}>Email</label>
                <ErpInput className="!py-1.5 text-[12px]" type="email" value={supplierForm.contactEmail} onChange={(e) => setSupplierForm({ ...supplierForm, contactEmail: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabel}>Lead days</label>
                <ErpInput className="!py-1.5 text-[12px]" type="number" value={supplierForm.leadTimeDays} onChange={(e) => setSupplierForm({ ...supplierForm, leadTimeDays: e.target.value })} />
              </div>
              <div className="flex items-end lg:col-span-5">
                <ErpButton className={btnSm} disabled={!supplierForm.supplierCode || !supplierForm.name || createSupplier.isPending} onClick={() => createSupplier.mutate()}>
                  {createSupplier.isPending ? 'Adding...' : 'Add supplier'}
                </ErpButton>
              </div>
            </div>
          </ComposeSection>
        )}

        <TabToolbar title={tabTitle} hint={tabHint}>
          <div className="relative min-w-[200px]">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-erp-text-muted" />
            <ErpInput
              className="!py-1.5 pl-8 text-[12px]"
              placeholder="Search..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            />
          </div>
          <ErpButton variant="secondary" className={btnSm} onClick={runSearch}>Search</ErpButton>
        </TabToolbar>

        {isLoading ? (
          <p className="p-6 text-[13px] text-erp-text-muted">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable className={`w-full text-[12px] ${tab === 'suppliers' ? 'min-w-[1100px]' : 'min-w-[880px]'}`}>
              <thead>
                <tr>
                  {tab === 'suppliers' ? (
                    <>
                      <th>Vendor ID</th>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Mobile</th>
                      <th>Email</th>
                      <th>GST</th>
                      <th>Material</th>
                      <th>Payment</th>
                      <th>Status</th>
                    </>
                  ) : tab === 'po' ? (
                    <>
                      <th>PO</th>
                      <th>Supplier</th>
                      <th className="text-right">Amount</th>
                      <th>Lines</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </>
                  ) : tab === 'history' ? (
                    <>
                      <th>PR</th>
                      <th>PO / supplier</th>
                      <th>GRN</th>
                      <th>Lines</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </>
                  ) : tab === 'rfq' ? (
                    <>
                      <th>RFQ</th>
                      <th>PR</th>
                      <th>Status</th>
                      <th>Quotes</th>
                      <th className="text-right">Actions</th>
                    </>
                  ) : tab === 'grn' ? (
                    <>
                      <th>GRN</th>
                      <th>PO</th>
                      <th>Lines</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </>
                  ) : (
                    <>
                      <th>PR</th>
                      <th>Source</th>
                      <th>Lines</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
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
                    <tr key={pr._id}>
                      <td className="whitespace-nowrap font-mono font-medium">
                        {pr.prNumber}
                        {(pr as PurchaseRequisition & { sourceType?: string }).sourceType === 'MRP' && (
                          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-sans font-medium text-amber-800">MRP</span>
                        )}
                      </td>
                      <td className="text-erp-text-muted">{prSourceLabel(pr as PurchaseRequisition & { sourceType?: string })}</td>
                      <td><LinesList lines={pr.lines} /></td>
                      <td>
                        <ErpStatusBadge status={pr.status} label={statusLabel(pr.status)} />
                        <p className="mt-1 max-w-[220px] text-[11px] leading-snug text-erp-text-muted">
                          {pr.status === 'SUBMITTED' && levelHint
                            ? levelHint
                            : workflowHint('pr', pr.status)}
                        </p>
                        {pr.status === 'SUBMITTED' && approval && (approval.currentLevel ?? 1) > 1 && (
                          <p className="mt-1 text-[11px] text-emerald-700">L1 done - waiting on Factory Admin</p>
                        )}
                      </td>
                      <td className="text-right">
                        <ActionStack>
                          {canUpdate && (pr.status === 'DRAFT' || pr.status === 'REJECTED') && (
                            <ErpButton className={btnSm} onClick={() => promptConfirm('Submit PR for approval?', 'Starts dual approval: Purchase Manager (L1) then Factory Admin (L2).', () => workflow.mutate({ type: 'submitPr', id: pr._id }))}>
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
                            <div className="flex justify-end gap-1.5">
                              <ErpButton
                                className={btnSm}
                                onClick={() => workflow.mutate({ type: 'approvePr', id: pr._id })}
                              >
                                {(approval?.currentLevel ?? 1) > 1 ? 'Approve L2' : 'Approve L1'}
                              </ErpButton>
                              <ErpButton variant="secondary" className={btnSm} onClick={() => setRejectPrId(pr._id)}>Reject</ErpButton>
                            </div>
                          )}
                          {canExecute && pr.status === 'APPROVED' && (
                            <ErpButton className={btnSm} onClick={() => { goTab('po'); setPoPrId(pr._id); }}>Create PO</ErpButton>
                          )}
                        </ActionStack>
                      </td>
                    </tr>
                  );
                })}

                {tab === 'history' && (items as PurchaseRequisition[]).map((pr) => {
                  const linkedPo = findPoForPr(posForPrLink, pr);
                  const linkedGrns = linkedPo ? findGrnsForPo(historyGrns, linkedPo._id) : [];
                  const latestGrn = linkedGrns[0];
                  return (
                    <tr key={pr._id}>
                      <td className="whitespace-nowrap font-mono font-medium">{pr.prNumber}</td>
                      <td>
                        {linkedPo ? (
                          <>
                            <p className="font-mono text-[12px] font-medium">{linkedPo.poNumber}</p>
                            <p className="text-[12px] text-erp-text-muted">{supplierLabel(linkedPo.supplierId)} · {formatCurrency(linkedPo.totalAmount)}</p>
                          </>
                        ) : (
                          <span className="text-erp-text-muted">PO not found</span>
                        )}
                      </td>
                      <td>
                        {latestGrn ? (
                          <>
                            <p className="font-mono text-[12px]">{latestGrn.grnNumber}</p>
                            <p className="text-[11px] text-erp-text-muted">{statusLabel(latestGrn.status)}</p>
                          </>
                        ) : '-'}
                      </td>
                      <td><LinesList lines={pr.lines} /></td>
                      <td>
                        <ErpStatusBadge
                          status={latestGrn?.status === 'COMPLETED' ? 'DELIVERED' : 'SHIPPED'}
                          label={latestGrn?.status === 'COMPLETED' ? 'Completed' : 'In history'}
                        />
                        <p className="mt-1 max-w-[220px] text-[11px] leading-snug text-erp-text-muted">
                          {historyPurchaseLabel(linkedPo, linkedGrns)}
                        </p>
                      </td>
                      <td className="text-right">
                        <ActionStack>
                          {linkedPo && (
                            <ErpButton className={btnSm} onClick={() => goToPo(linkedPo)}>View PO</ErpButton>
                          )}
                          {latestGrn?.status === 'COMPLETED' && (
                            <>
                              <TextLink to="/inventory?tab=stock">Inventory</TextLink>
                              <TextLink to="/warehouse/operations/put-away">Put away</TextLink>
                            </>
                          )}
                          {latestGrn?.status === 'PENDING_QC' && (
                            <TextLink to="/quality/inspections">QC -&gt;</TextLink>
                          )}
                        </ActionStack>
                      </td>
                    </tr>
                  );
                })}

                {tab === 'po' && (items as PurchaseOrder[]).map((po) => (
                  <tr key={po._id}>
                    <td className="whitespace-nowrap">
                      <p className="font-mono font-medium">{po.poNumber}</p>
                      {po.prId && <p className="text-[11px] text-erp-text-muted">PR {prNumber(po.prId)}</p>}
                    </td>
                    <td>{supplierLabel(po.supplierId)}</td>
                    <td className="whitespace-nowrap text-right font-medium">{formatCurrency(po.totalAmount)}</td>
                    <td><LinesList lines={po.lines} /></td>
                    <td>
                      <ErpStatusBadge status={po.status} label={statusLabel(po.status)} />
                      <p className="mt-1 max-w-[200px] text-[11px] leading-snug text-erp-text-muted">{workflowHint('po', po.status)}</p>
                    </td>
                    <td className="text-right">
                      <ActionStack>
                        {canApprove && po.status === 'DRAFT' && (
                          <ErpButton className={btnSm} onClick={() => workflow.mutate({ type: 'approvePo', id: po._id })}>Approve</ErpButton>
                        )}
                        {canExecute && po.status === 'APPROVED' && (
                          <ErpButton variant="secondary" className={btnSm} onClick={() => workflow.mutate({ type: 'sendPo', id: po._id })}>Send</ErpButton>
                        )}
                        {canReceive && ['APPROVED', 'SENT', 'PARTIAL'].includes(po.status) && (
                          <ErpButton variant="secondary" className={btnSm} onClick={() => openGrnForPo(po._id)}>Receive GRN</ErpButton>
                        )}
                      </ActionStack>
                    </td>
                  </tr>
                ))}

                {tab === 'grn' && (items as GoodsReceipt[]).map((grn) => {
                  const next = grnNextStep(grn.status);
                  return (
                    <tr key={grn._id}>
                      <td className="whitespace-nowrap font-mono font-medium">{grn.grnNumber}</td>
                      <td className="font-mono text-erp-text-muted">PO {poNumber(grn.poId)}</td>
                      <td className="text-[12px] text-erp-text-muted">{grnLineSummary(grn)}</td>
                      <td>
                        <ErpStatusBadge status={grn.status} label={statusLabel(grn.status)} />
                        <p className="mt-1 max-w-[220px] text-[11px] leading-snug text-erp-text-muted">{workflowHint('grn', grn.status)}</p>
                      </td>
                      <td className="text-right">
                        <ActionStack>
                          {canUpdate && grn.status === 'DRAFT' && (
                            <ErpButton
                              variant="secondary"
                              className={btnSm}
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
                            <TextLink to={next.path}>{next.label} -&gt;</TextLink>
                          )}
                          {grn.status === 'COMPLETED' && (
                            <>
                              <TextLink to="/inventory?tab=stock">View stock</TextLink>
                              <TextLink to="/warehouse/operations/put-away">Put away</TextLink>
                              <TextLink to="/production/orders">Production</TextLink>
                            </>
                          )}
                        </ActionStack>
                      </td>
                    </tr>
                  );
                })}

                {tab === 'rfq' && (items as Rfq[]).map((rfq) => (
                  <RfqRow key={rfq._id} rfq={rfq} canUpdate={canUpdate} canApprove={canApprove} onSend={() => workflow.mutate({ type: 'sendRfq', id: rfq._id })} onSelect={(id) => workflow.mutate({ type: 'selectQuote', id })} />
                ))}

                {tab === 'suppliers' && (items as Supplier[]).map((s) => (
                  <tr key={s._id}>
                    <td className="whitespace-nowrap font-mono">{s.supplierCode}</td>
                    <td className="font-medium">{s.name}</td>
                    <td className="text-erp-text-muted">{s.contactPerson || '-'}</td>
                    <td className="whitespace-nowrap font-mono">{s.phone || '-'}</td>
                    <td className="text-erp-text-muted">{s.contactEmail || '-'}</td>
                    <td className="whitespace-nowrap font-mono text-[11px]">{s.gstNumber || '-'}</td>
                    <td>{s.materialsSupplied || '-'}</td>
                    <td className="whitespace-nowrap">{s.paymentTerms || '-'}</td>
                    <td><ErpStatusBadge status={s.status || 'ACTIVE'} /></td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <EmptyRow colSpan={listColSpan}>
                    {tab === 'history'
                      ? 'No past purchases yet - converted PRs appear here after PO creation'
                      : 'No records'}
                  </EmptyRow>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}

        {meta && (
          <TablePager
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </TabShell>

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
    <tr>
      <td className="whitespace-nowrap font-mono font-medium">{rfq.rfqNumber}</td>
      <td className="font-mono text-erp-text-muted">PR {prNumber(rfq.prId)}</td>
      <td><ErpStatusBadge status={rfq.status} label={statusLabel(rfq.status)} /></td>
      <td>
        {quotes.length === 0 ? (
          <span className="text-erp-text-muted">No quotes yet</span>
        ) : (
          <ul className="space-y-1.5">
            {quotes.map((q: Quotation) => (
              <li key={q._id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px]">
                  {supplierLabel(q.supplierId)}
                  <span className="ml-1 font-medium">{formatCurrency(q.totalAmount)}</span>
                  {q.status === 'SELECTED' && <span className="ml-1 text-emerald-700">Selected</span>}
                </span>
                {canApprove && q.status === 'SUBMITTED' && (
                  <ErpButton className={btnSm} onClick={() => onSelect(q._id)}>Select -&gt; PO</ErpButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="text-right">
        {canUpdate && rfq.status === 'DRAFT' && (
          <ErpButton variant="secondary" className={btnSm} onClick={onSend}>Send</ErpButton>
        )}
      </td>
    </tr>
  );
}
