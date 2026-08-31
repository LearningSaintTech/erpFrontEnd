import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, FlaskConical, RefreshCw, Search, ShieldCheck, Shirt,
} from 'lucide-react';
import { qualityApi, warehouseApi } from '../../services/operations';
import { qualityAdminApi } from '../../services/admin';
import type {
  GoodsReceipt, GoodsReceiptRef, ProductionBatch, QualityDefect, QualityInspection, StorageBin, Warehouse,
} from '../../types/api';
import {
  ErpPageHeader, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  dispositionLabel, formatDateTime, grnLineSummary, incomingQcSuccessMessage, inspectionRefId,
  inspectionSummary, poNumberFromGrn, RM_INCOMING_QC_FLOW, resultLabel, statusLabel, typeLabel,
} from './qualityUtils';
import { putAwayPath } from '../inventory/inventoryUtils';

const PAGE_SIZE = 15;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const btnSm = '!px-2 !py-1 text-[10px]';

function binLabel(b: StorageBin) {
  return `${b.zoneCode}-${b.binCode}`;
}

function grnQty(grn: GoodsReceipt | GoodsReceiptRef) {
  return grn.lines?.reduce((s, l) => s + (l.receivedQty ?? 0), 0) || 0;
}

function batchQty(b: ProductionBatch) {
  return b.producedQuantity || b.plannedQuantity || 0;
}

export function QualityPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('quality.create');
  const canUpdate = permissions.includes('*') || permissions.includes('quality.update');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [rmBinId, setRmBinId] = useState('');
  const [fgBinId, setFgBinId] = useState('');
  const [autoDispatch, setAutoDispatch] = useState(false);

  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState({
    passedQuantity: '0',
    failedQuantity: '0',
    disposition: 'PASS' as 'PASS' | 'REWORK' | 'REJECT',
    storageBinId: '',
    autoDispatchReady: false,
  });
  const [defectForm, setDefectForm] = useState({
    categoryId: '', description: '', quantity: '1', severity: 'MINOR',
  });
  const [confirmAction, setConfirmAction] = useState<{ label: string; fn: () => void } | null>(null);
  const [postQcNext, setPostQcNext] = useState<{ materialId?: string; materialCode?: string; qty?: number } | null>(null);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['quality-stats'] });
    qc.invalidateQueries({ queryKey: ['quality-pending'] });
    qc.invalidateQueries({ queryKey: ['qc-queue'] });
    qc.invalidateQueries({ queryKey: ['quality-inspections'] });
    qc.invalidateQueries({ queryKey: ['grns'] });
    qc.invalidateQueries({ queryKey: ['purchase-list'] });
    qc.invalidateQueries({ queryKey: ['purchase-stats'] });
    qc.invalidateQueries({ queryKey: ['batches'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances-page'] });
    qc.invalidateQueries({ queryKey: ['inventory-stats'] });
    qc.invalidateQueries({ queryKey: ['dispatch-ready'] });
    qc.invalidateQueries({ queryKey: ['samples'] });
    qc.invalidateQueries({ queryKey: ['sample'] });
    qc.invalidateQueries({ queryKey: ['sample-stats'] });
  };

  const { data: stats } = useQuery({ queryKey: ['quality-stats'], queryFn: () => qualityApi.stats() });
  const { data: catalog } = useQuery({ queryKey: ['quality-catalog'], queryFn: () => qualityApi.catalog() });
  const { data: pending } = useQuery({ queryKey: ['quality-pending'], queryFn: () => qualityApi.pendingWork() });
  const { data: queue = [] } = useQuery({ queryKey: ['qc-queue'], queryFn: qualityApi.queue });

  const { data: inspectionsPage, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['quality-inspections', page, search, statusFilter, typeFilter],
    queryFn: () => qualityApi.listPage({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      status: statusFilter || undefined,
      inspectionType: typeFilter || undefined,
    }),
  });
  const inspections = inspectionsPage?.items ?? [];
  const meta = inspectionsPage?.meta;

  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => warehouseApi.list() });
  const rmWh = warehouses.find((w: Warehouse) => w.type === 'RAW_MATERIAL') || warehouses[0];
  const fgWh = warehouses.find((w: Warehouse) => w.type === 'FINISHED_GOODS') || warehouses[0];

  const { data: rmBins = [] } = useQuery({
    queryKey: ['bins', rmWh?._id, 'qc-rm'],
    queryFn: () => warehouseApi.listBins(rmWh!._id),
    enabled: !!rmWh?._id,
  });
  const { data: fgBins = [] } = useQuery({
    queryKey: ['bins', fgWh?._id, 'qc-fg'],
    queryFn: () => warehouseApi.listBins(fgWh!._id),
    enabled: !!fgWh?._id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['defect-categories'],
    queryFn: qualityAdminApi.listDefectCategories,
  });

  const activeInspection = completeId
    ? [...queue, ...inspections].find((i) => i._id === completeId)
    : undefined;

  const { data: defects = [], refetch: refetchDefects } = useQuery({
    queryKey: ['inspection-defects', completeId],
    queryFn: () => qualityApi.listDefects(completeId!),
    enabled: !!completeId,
  });

  const createIncoming = useMutation({
    mutationFn: (grnId: string) => qualityApi.createIncoming(grnId),
    onSuccess: (insp) => {
      showSuccess(`Inspection ${insp.inspectionNumber} created`);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const createInProcess = useMutation({
    mutationFn: (batchId: string) => qualityApi.createInProcess(batchId),
    onSuccess: (insp) => {
      showSuccess(`In-process inspection ${insp.inspectionNumber} created`);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const createFinal = useMutation({
    mutationFn: ({ batchId, qty }: { batchId: string; qty: number }) =>
      qualityApi.createFinal(batchId, {
        storageBinId: fgBinId || undefined,
        autoDispatchReady: autoDispatch,
      }).then((insp) => {
        openComplete(insp, qty);
        return insp;
      }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => setError(e.message),
  });

  const startMut = useMutation({
    mutationFn: (id: string) => qualityApi.start(id),
    onSuccess: (insp) => {
      showSuccess(`Started ${insp.inspectionNumber}`);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const recordDefect = useMutation({
    mutationFn: () => qualityApi.recordDefect(completeId!, {
      categoryId: defectForm.categoryId || undefined,
      description: defectForm.description || undefined,
      quantity: Number(defectForm.quantity) || 1,
      severity: defectForm.severity,
    }),
    onSuccess: () => {
      setDefectForm({ categoryId: '', description: '', quantity: '1', severity: 'MINOR' });
      refetchDefects();
      showSuccess('Defect recorded');
    },
    onError: (e: Error) => setError(e.message),
  });

  const completeMut = useMutation({
    mutationFn: () => {
      const passed = Number(completeForm.passedQuantity) || 0;
      const failed = Number(completeForm.failedQuantity) || 0;
      const disposition = completeForm.disposition;
      let result: string = disposition;
      if (disposition === 'PASS' && failed > 0 && passed > 0) result = 'PARTIAL';
      else if (disposition === 'PASS' && failed === 0) result = 'PASS';
      else if (disposition === 'REJECT') result = 'FAIL';

      const body: Parameters<typeof qualityApi.complete>[1] = {
        passedQuantity: passed,
        failedQuantity: failed,
        disposition,
        result,
      };

      if (activeInspection?.inspectionType === 'INCOMING') {
        body.storageBinId = completeForm.storageBinId || rmBinId || undefined;
      }
      if (activeInspection?.inspectionType === 'FINAL') {
        body.storageBinId = completeForm.storageBinId || fgBinId || undefined;
        body.autoDispatchReady = completeForm.autoDispatchReady;
      }

      return qualityApi.complete(completeId!, body);
    },
    onSuccess: (insp) => {
      setCompleteId(null);
      if (activeInspection?.inspectionType === 'INCOMING') {
        const refId = inspectionRefId(activeInspection);
        const grn = pendingGrns.find((g) => g._id === refId);
        const firstLine = grn?.lines?.[0];
        const mat = firstLine?.materialId;
        const materialId = typeof mat === 'object' && mat && '_id' in mat ? (mat as { _id: string })._id : typeof mat === 'string' ? mat : undefined;
        const materialCode = typeof mat === 'object' && mat && 'materialCode' in mat ? (mat as { materialCode?: string }).materialCode : undefined;
        const qty = Number(completeForm.passedQuantity) || grnQty(grn || { lines: [] });
        setPostQcNext({ materialId, materialCode, qty });
        showSuccess(incomingQcSuccessMessage());
      } else if (activeInspection?.inspectionType === 'SAMPLING' || activeInspection?.referenceType === 'SAMPLE') {
        const sampleId = inspectionRefId(activeInspection);
        showSuccess(insp.result === 'FAIL' || insp.disposition === 'REJECT'
          ? 'Sample QC failed — sampling / manager can request a revision'
          : 'Sample QC passed — next is fit trial or buyer approval');
        if (sampleId) {
          /* keep user on quality; they can jump to the sample */
        }
      } else {
        showSuccess(`Inspection ${insp.inspectionNumber} completed`);
      }
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const openComplete = (insp: QualityInspection, defaultQty?: number) => {
    let qty = defaultQty ?? 0;
    if (!qty && insp.inspectionType === 'INCOMING') {
      const refId = inspectionRefId(insp);
      const grn = pendingGrns.find((g) => g._id === refId);
      if (grn) qty = grnQty(grn);
    }
    if (!qty && (insp.inspectionType === 'SAMPLING' || insp.referenceType === 'SAMPLE')) qty = 1;
    setCompleteId(insp._id);
    setCompleteForm({
      passedQuantity: String(qty),
      failedQuantity: '0',
      disposition: 'PASS',
      storageBinId: insp.inspectionType === 'INCOMING' ? rmBinId : fgBinId,
      autoDispatchReady: autoDispatch,
    });
  };

  const runIncomingQc = async (grn: GoodsReceipt | GoodsReceiptRef) => {
    try {
      let insp: QualityInspection | undefined;
      const linked = grn.qcInspectionId;
      if (linked && typeof linked === 'object' && '_id' in linked) {
        insp = queue.find((q) => q._id === linked._id) || { _id: linked._id, inspectionNumber: linked.inspectionNumber || '', inspectionType: 'INCOMING', status: linked.status || 'PENDING' };
      }
      if (!insp) {
        insp = queue.find((q) => inspectionRefId(q) === grn._id && q.inspectionType === 'INCOMING');
      }
      if (!insp) {
        insp = await createIncoming.mutateAsync(grn._id);
      }
      if (insp.status === 'PENDING') {
        insp = await startMut.mutateAsync(insp._id);
      }
      openComplete(insp, grnQty(grn));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Incoming QC failed');
    }
  };

  const pendingGrns = pending?.pendingGrns ?? [];
  const inProgressBatches = pending?.inProgressBatches ?? [];
  const completedBatches = pending?.completedBatches ?? [];
  const pendingSamples = pending?.pendingSamples ?? [];

  const kpiCards = [
    { label: 'Pending QC', value: stats?.pending ?? 0, icon: ClipboardCheck },
    { label: 'In progress', value: stats?.inProgress ?? 0, icon: FlaskConical },
    { label: 'First-pass yield', value: `${stats?.firstPassYield ?? 0}%`, icon: CheckCircle2 },
    { label: 'Open CAPA', value: stats?.openCapa ?? 0, icon: AlertTriangle, link: '/quality/capa' },
    { label: 'Defects logged', value: stats?.defectsLogged ?? 0, icon: ShieldCheck },
    { label: 'GRNs waiting', value: stats?.pendingGrns ?? pendingGrns.length, icon: ClipboardCheck },
    { label: 'Sample QC', value: stats?.pendingSampleQc ?? pendingSamples.length, icon: Shirt },
  ];

  return (
    <div>
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      {postQcNext && (
        <ErpCard className="mb-4 border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h3 className="mb-2 text-sm font-medium text-emerald-800">Incoming QC complete — stock on dock</h3>
          <p className="mb-3 text-xs text-erp-text-muted">
            {postQcNext.qty ?? 0} units posted to unallocated dock
            {postQcNext.materialCode ? ` (${postQcNext.materialCode})` : ''}.
            Optional: put away to a bin, or reserve/issue from dock for samples or production.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/inventory">
              <ErpButton variant="secondary" className={btnSm}>View inventory</ErpButton>
            </Link>
            <Link to={putAwayPath(postQcNext.materialId, postQcNext.materialCode)}>
              <ErpButton className={btnSm}>Put away →</ErpButton>
            </Link>
            <Link to="/samples">
              <ErpButton variant="secondary" className={btnSm}>Samples</ErpButton>
            </Link>
            <Link to="/production/orders">
              <ErpButton variant="secondary" className={btnSm}>Production</ErpButton>
            </Link>
            <ErpButton variant="secondary" className={btnSm} onClick={() => setPostQcNext(null)}>Dismiss</ErpButton>
          </div>
        </ErpCard>
      )}

      <ErpPageHeader
        title="Quality Control"
        subtitle={(
          <>
            Incoming GRN QC, sample garments after stitching, and production in-process / final QC.
            <Link to="/samples" className="ml-2 text-[var(--erp-accent)]">Samples →</Link>
            <Link to="/purchase" className="ml-2 text-[var(--erp-accent)]">Purchase →</Link>
            <Link to="/inventory" className="ml-2 text-[var(--erp-accent)]">Inventory →</Link>
            <Link to="/warehouse/operations/put-away" className="ml-2 text-[var(--erp-accent)]">Put away →</Link>
          </>
        )}
        actions={(
          <ErpButton variant="secondary" onClick={() => { refetch(); invalidate(); }} disabled={isFetching}>
            <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </ErpButton>
        )}
      />

      <ErpCard className="mb-4 !p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Incoming material QC (purchase GRN)</p>
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          {RM_INCOMING_QC_FLOW.map((step, i) => (
            <span key={step.id} className="flex items-center gap-1">
              {i > 0 && <ArrowRight size={10} className="text-erp-text-muted" />}
              <span className="rounded px-1.5 py-0.5 text-erp-text-muted" title={step.detail}>{step.label}</span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-erp-text-muted">
          After Purchase submits GRN for QC, an inspection is created automatically. Pass accepted qty here — stock is not updated until you complete incoming QC.
        </p>
      </ErpCard>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {kpiCards.map(({ label, value, icon: Icon, link }) => (
          <ErpCard key={label} className="p-3">
            {link ? (
              <Link to={link} className="block hover:opacity-90">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-erp-text-muted">{label}</span>
                  <Icon className="h-3.5 w-3.5 text-erp-text-muted" />
                </div>
                <p className="mt-1 text-lg font-semibold">{value}</p>
              </Link>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-erp-text-muted">{label}</span>
                  <Icon className="h-3.5 w-3.5 text-erp-text-muted" />
                </div>
                <p className="mt-1 text-lg font-semibold">{value}</p>
              </>
            )}
          </ErpCard>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-4 rounded-lg border border-erp-border/60 bg-erp-surface/40 p-3 text-sm">
        <label className="flex flex-col gap-0.5">
          <span className={fieldLabel}>RM receive bin (optional)</span>
          <p className="mb-0.5 text-[9px] text-erp-text-muted">Leave empty for unallocated dock; or receipt straight to bin</p>
          <ErpSelect value={rmBinId} onChange={(e) => setRmBinId(e.target.value)} className="min-w-[140px]">
            <option value="">Unallocated dock</option>
            {rmBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
          </ErpSelect>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={fieldLabel}>FG bin (final QC)</span>
          <ErpSelect value={fgBinId} onChange={(e) => setFgBinId(e.target.value)} className="min-w-[140px]">
            <option value="">Default warehouse</option>
            {fgBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
          </ErpSelect>
        </label>
        <label className="flex items-end gap-2 pb-1">
          <input
            type="checkbox"
            checked={autoDispatch}
            onChange={(e) => setAutoDispatch(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs text-erp-text-muted">Auto mark dispatch-ready after final QC</span>
        </label>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <ErpCard className="p-4">
          <h3 className="mb-3 text-sm font-medium">Sample QC</h3>
          <p className="mb-2 text-[10px] text-erp-text-muted">After stitching, inspect the garment. Pass → fit trial or buyer review.</p>
          {pendingSamples.map((s) => {
            const design = s.designId && typeof s.designId === 'object'
              ? [s.designId.designCode, s.designId.title].filter(Boolean).join(' — ')
              : '';
            const insp = s.qcInspectionId && typeof s.qcInspectionId === 'object' ? s.qcInspectionId : null;
            const queueInsp = insp
              ? queue.find((q) => q._id === insp._id)
              : queue.find((q) => q.referenceType === 'SAMPLE' && inspectionRefId(q) === s._id);
            return (
              <div key={s._id} className="mb-2 border-b border-erp-border/50 pb-2 text-sm last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs">{s.sampleCode}</span>
                    {design && <p className="text-[10px] text-erp-text-muted">{design}</p>}
                    {insp?.inspectionNumber && (
                      <p className="text-[10px] text-erp-text-muted">{insp.inspectionNumber}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Link to={`/samples?sampleId=${s._id}`}>
                      <ErpButton variant="secondary" className={btnSm}>Sample</ErpButton>
                    </Link>
                    {canUpdate && queueInsp && (
                      <ErpButton className={btnSm} onClick={() => openComplete(queueInsp, 1)}>
                        Inspect
                      </ErpButton>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {pendingSamples.length === 0 && <p className="text-sm text-erp-text-muted">No samples waiting for QC</p>}
        </ErpCard>

        <ErpCard className="p-4">
          <h3 className="mb-3 text-sm font-medium">Incoming QC (GRN)</h3>
          {pendingGrns.map((grn) => {
            const linkedInsp = grn.qcInspectionId;
            const inspLabel = linkedInsp && typeof linkedInsp === 'object' ? linkedInsp.inspectionNumber : undefined;
            return (
            <div key={grn._id} className="mb-3 border-b border-erp-border/50 pb-2 text-sm last:border-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{grn.grnNumber}</span>
                {canUpdate && (
                  <ErpButton
                    className={btnSm}
                    disabled={createIncoming.isPending || startMut.isPending}
                    onClick={() => runIncomingQc(grn)}
                  >
                    {inspLabel ? 'Complete QC' : 'Inspect & complete'}
                  </ErpButton>
                )}
                {canCreate && !canUpdate && (
                  <ErpButton
                    variant="secondary"
                    className={btnSm}
                    disabled={createIncoming.isPending}
                    onClick={() => createIncoming.mutate(grn._id)}
                  >
                    Create inspection
                  </ErpButton>
                )}
              </div>
              <p className="text-xs text-erp-text-muted">
                PO {poNumberFromGrn(grn)} · Qty {grnQty(grn)}
                {inspLabel && <span className="ml-1">· {inspLabel}</span>}
              </p>
              <p className="mt-0.5 text-[10px] text-erp-text-muted">{grnLineSummary(grn)}</p>
            </div>
          );})}
          {pendingGrns.length === 0 && (
            <p className="text-sm text-erp-text-muted">
              No GRNs pending QC — receive goods in <Link to="/purchase" className="text-[var(--erp-accent)]">Purchase → Receipts</Link> and submit for QC.
            </p>
          )}
        </ErpCard>

        <ErpCard className="p-4">
          <h3 className="mb-3 text-sm font-medium">In-process QC</h3>
          {inProgressBatches.map((b) => (
            <div key={b._id} className="mb-3 border-b border-erp-border/50 pb-2 text-sm last:border-0">
              <p className="font-mono text-xs">{b.batchNumber} · {b.currentStage}</p>
              <p className="text-xs text-erp-text-muted">Planned {b.plannedQuantity ?? '—'}</p>
              {canCreate && (
                <div className="mt-1 flex flex-wrap gap-1">
                  <ErpButton
                    variant="secondary"
                    className={btnSm}
                    disabled={createInProcess.isPending}
                    onClick={() => createInProcess.mutate(b._id)}
                  >
                    Create inspection
                  </ErpButton>
                  {canUpdate && (
                    <ErpButton
                      variant="secondary"
                      className={btnSm}
                      onClick={() => createInProcess.mutateAsync(b._id).then((insp) => openComplete(insp, batchQty(b)))}
                    >
                      Quick complete
                    </ErpButton>
                  )}
                </div>
              )}
            </div>
          ))}
          {inProgressBatches.length === 0 && <p className="text-sm text-erp-text-muted">No in-progress batches</p>}
        </ErpCard>

        <ErpCard className="p-4">
          <h3 className="mb-3 text-sm font-medium">Final QC (batch)</h3>
          {completedBatches.map((b) => (
            <div key={b._id} className="mb-2 flex items-center justify-between gap-2 text-sm">
              <div>
                <span className="font-mono text-xs">{b.batchNumber}</span>
                <p className="text-xs text-erp-text-muted">Produced {batchQty(b)}</p>
              </div>
              {canCreate && (
                <ErpButton
                  className={btnSm}
                  disabled={createFinal.isPending}
                  onClick={() => createFinal.mutate({ batchId: b._id, qty: batchQty(b) })}
                >
                  Final QC
                </ErpButton>
              )}
            </div>
          ))}
          {completedBatches.length === 0 && <p className="text-sm text-erp-text-muted">No batches awaiting final QC</p>}
        </ErpCard>
      </div>

      <ErpCard className="mb-6 p-4">
        <h3 className="mb-3 text-sm font-medium">Active queue ({queue.length})</h3>
        {queue.length === 0 ? (
          <p className="text-sm text-erp-text-muted">No inspections in queue</p>
        ) : (
          <ErpDataTable>
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q._id}>
                  <td className="font-mono text-xs">{q.inspectionNumber}</td>
                  <td>
                    {typeLabel(q.inspectionType)}
                    {(q.inspectionType === 'SAMPLING' || q.referenceType === 'SAMPLE') && inspectionRefId(q) && (
                      <Link to={`/samples?sampleId=${inspectionRefId(q)}`} className="ml-1 text-[10px] text-[var(--erp-accent)]">
                        Sample
                      </Link>
                    )}
                  </td>
                  <td><ErpStatusBadge status={q.status} label={statusLabel(q.status)} /></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      {canUpdate && q.status === 'PENDING' && (
                        <ErpButton variant="secondary" className={btnSm} onClick={() => startMut.mutate(q._id)}>
                          Start
                        </ErpButton>
                      )}
                      {canUpdate && ['PENDING', 'IN_PROGRESS'].includes(q.status) && (
                        <ErpButton className={btnSm} onClick={() => openComplete(q)}>
                          Complete
                        </ErpButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        )}
      </ErpCard>

      <ErpCard className="p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <span className={fieldLabel}>Search inspections</span>
            <div className="flex gap-2">
              <ErpInput
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Number or reference…"
                onKeyDown={(e) => e.key === 'Enter' && (setSearch(searchInput), setPage(1))}
              />
              <ErpButton variant="secondary" onClick={() => { setSearch(searchInput); setPage(1); }}>
                <Search className="h-3.5 w-3.5" />
              </ErpButton>
            </div>
          </div>
          <label>
            <span className={fieldLabel}>Status</span>
            <ErpSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {(catalog?.inspectionTypes ? ['PENDING', 'IN_PROGRESS', 'COMPLETED'] : []).map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </ErpSelect>
          </label>
          <label>
            <span className={fieldLabel}>Type</span>
            <ErpSelect value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {(catalog?.inspectionTypes ?? ['INCOMING', 'IN_PROCESS', 'FINAL']).map((t) => (
                <option key={t} value={t}>{typeLabel(t)}</option>
              ))}
            </ErpSelect>
          </label>
        </div>

        <ErpDataTable>
          <thead>
            <tr>
              <th>Number</th>
              <th>Type</th>
              <th>Status</th>
              <th>Result</th>
              <th>Pass / Fail</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-8 text-center text-erp-text-muted">Loading…</td></tr>
            ) : inspections.map((i) => (
              <tr key={i._id}>
                <td className="font-mono text-xs">{i.inspectionNumber}</td>
                <td>{inspectionSummary(i)}</td>
                <td><ErpStatusBadge status={i.status} label={statusLabel(i.status)} /></td>
                <td>{resultLabel(i.result)}</td>
                <td className="text-xs">
                  {i.passedQuantity ?? '—'} / {i.failedQuantity ?? '—'}
                  {i.disposition && <span className="ml-1 text-erp-text-muted">({dispositionLabel(i.disposition)})</span>}
                </td>
                <td className="text-xs text-erp-text-muted">{formatDateTime(i.completedAt)}</td>
              </tr>
            ))}
            {!isLoading && inspections.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-erp-text-muted">No inspections found</td></tr>
            )}
          </tbody>
        </ErpDataTable>

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-erp-text-muted">
            <span>Page {meta.page} of {meta.totalPages} · {meta.total} total</span>
            <div className="flex gap-2">
              <ErpButton variant="secondary" className={btnSm} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </ErpButton>
              <ErpButton variant="secondary" className={btnSm} disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </ErpButton>
            </div>
          </div>
        )}
      </ErpCard>

      {completeId && activeInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <ErpCard className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-5">
            <h3 className="mb-1 text-base font-semibold">Complete inspection</h3>
            <p className="mb-4 text-xs text-erp-text-muted">
              {activeInspection.inspectionNumber} · {typeLabel(activeInspection.inspectionType)}
              {(activeInspection.inspectionType === 'SAMPLING' || activeInspection.referenceType === 'SAMPLE') && (
                <>
                  {' · '}
                  <Link to={`/samples?sampleId=${inspectionRefId(activeInspection)}`} className="text-[var(--erp-accent)]">
                    Open sample
                  </Link>
                </>
              )}
            </p>
            {(activeInspection.inspectionType === 'SAMPLING' || activeInspection.referenceType === 'SAMPLE') && (
              <p className="mb-3 text-[10px] text-erp-text-muted">
                One garment. PASS moves the sample to fit trial (fit samples) or buyer approval. REJECT marks QC failed.
              </p>
            )}

            <div className="mb-4 grid grid-cols-2 gap-3">
              <label>
                <span className={fieldLabel}>Passed qty</span>
                <ErpInput
                  type="number"
                  min={0}
                  value={completeForm.passedQuantity}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, passedQuantity: e.target.value }))}
                />
              </label>
              <label>
                <span className={fieldLabel}>Failed qty</span>
                <ErpInput
                  type="number"
                  min={0}
                  value={completeForm.failedQuantity}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, failedQuantity: e.target.value }))}
                />
              </label>
              <label className="col-span-2">
                <span className={fieldLabel}>Disposition</span>
                <ErpSelect
                  value={completeForm.disposition}
                  onChange={(e) => setCompleteForm((f) => ({
                    ...f,
                    disposition: e.target.value as 'PASS' | 'REWORK' | 'REJECT',
                  }))}
                >
                  {(catalog?.dispositions ?? ['PASS', 'REWORK', 'REJECT']).map((d) => (
                    <option key={d} value={d}>{dispositionLabel(d)}</option>
                  ))}
                </ErpSelect>
              </label>

              {activeInspection.inspectionType === 'INCOMING' && (
                <label className="col-span-2">
                  <span className={fieldLabel}>RM storage bin</span>
                  <ErpSelect
                    value={completeForm.storageBinId}
                    onChange={(e) => setCompleteForm((f) => ({ ...f, storageBinId: e.target.value }))}
                  >
                    <option value="">Unallocated dock (default)</option>
                    {rmBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
                  </ErpSelect>
                  <p className="mt-1 text-[9px] text-erp-text-muted">
                    Passed qty posts on complete. Leave dock empty to put away later in Warehouse.
                  </p>
                </label>
              )}

              {activeInspection.inspectionType === 'FINAL' && (
                <>
                  <label className="col-span-2">
                    <span className={fieldLabel}>FG storage bin</span>
                    <ErpSelect
                      value={completeForm.storageBinId}
                      onChange={(e) => setCompleteForm((f) => ({ ...f, storageBinId: e.target.value }))}
                    >
                      <option value="">Default warehouse</option>
                      {fgBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
                    </ErpSelect>
                  </label>
                  <label className="col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={completeForm.autoDispatchReady}
                      onChange={(e) => setCompleteForm((f) => ({ ...f, autoDispatchReady: e.target.checked }))}
                    />
                    <span className="text-xs">Mark dispatch-ready on pass</span>
                  </label>
                </>
              )}
            </div>

            {canUpdate && (
              <div className="mb-4 rounded border border-erp-border/60 p-3">
                <h4 className="mb-2 text-xs font-medium">Defects ({defects.length})</h4>
                {defects.length > 0 && (
                  <ul className="mb-2 space-y-1 text-xs">
                    {defects.map((d: QualityDefect) => (
                      <li key={d._id} className="flex justify-between text-erp-text-muted">
                        <span>{d.description || 'Defect'} × {d.quantity}</span>
                        <span>{d.severity}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2">
                    <span className={fieldLabel}>Category</span>
                    <ErpSelect
                      value={defectForm.categoryId}
                      onChange={(e) => setDefectForm((f) => ({ ...f, categoryId: e.target.value }))}
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>{c.code} — {c.name}</option>
                      ))}
                    </ErpSelect>
                  </label>
                  <label className="col-span-2">
                    <span className={fieldLabel}>Description</span>
                    <ErpInput
                      value={defectForm.description}
                      onChange={(e) => setDefectForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className={fieldLabel}>Qty</span>
                    <ErpInput
                      type="number"
                      min={1}
                      value={defectForm.quantity}
                      onChange={(e) => setDefectForm((f) => ({ ...f, quantity: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className={fieldLabel}>Severity</span>
                    <ErpSelect
                      value={defectForm.severity}
                      onChange={(e) => setDefectForm((f) => ({ ...f, severity: e.target.value }))}
                    >
                      {(catalog?.defectSeverities ?? ['MINOR', 'MAJOR', 'CRITICAL']).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </ErpSelect>
                  </label>
                </div>
                <ErpButton
                  variant="secondary"
                  className={`mt-2 ${btnSm}`}
                  disabled={recordDefect.isPending}
                  onClick={() => recordDefect.mutate()}
                >
                  Add defect
                </ErpButton>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setCompleteId(null)}>Cancel</ErpButton>
              {canUpdate && (
                <ErpButton
                  disabled={completeMut.isPending}
                  onClick={() => setConfirmAction({
                    label: 'Complete this inspection and apply disposition?',
                    fn: () => { completeMut.mutate(); setConfirmAction(null); },
                  })}
                >
                  Complete inspection
                </ErpButton>
              )}
            </div>
          </ErpCard>
        </div>
      )}

      {confirmAction && (
        <ConfirmDialog
          open={!!confirmAction}
          title="Confirm"
          message={confirmAction.label}
          loading={completeMut.isPending}
          onConfirm={confirmAction.fn}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
