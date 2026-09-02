import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, FlaskConical, RefreshCw, Search, ShieldCheck, Shirt, X,
} from 'lucide-react';
import { qualityApi, warehouseApi } from '../../services/operations';
import { qualityAdminApi } from '../../services/admin';
import type {
  GoodsReceiptRef, ProductionBatch, QualityDefect, QualityInspection, QualityPendingWork, StorageBin, Warehouse,
} from '../../types/api';
import {
  ActionStack, EmptyRow, ErpButton, ErpDataTable, ErpInput, ErpPageHeader, ErpSelect, ErpStatusBadge,
  ErpTabs, InfoBanner, StatTile, TabShell, TabToolbar, TablePager, TextLink, btnSm, fieldLabel,
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

type TabId = 'incoming' | 'samples' | 'inprocess' | 'final' | 'queue' | 'history';

function binLabel(b: StorageBin) {
  return `${b.zoneCode}-${b.binCode}`;
}

function grnQty(grn: GoodsReceiptRef) {
  return grn.lines?.reduce((s, l) => s + (l.receivedQty ?? 0), 0) || 0;
}

function batchQty(b: ProductionBatch) {
  return b.producedQuantity || b.plannedQuantity || 0;
}

export function QualityPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('quality.create');
  const canUpdate = permissions.includes('*') || permissions.includes('quality.update');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<TabId>('incoming');
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
  const { data: pending } = useQuery({
    queryKey: ['quality-pending'],
    queryFn: async () => {
      const data = await qualityApi.pendingWork();
      qc.invalidateQueries({ queryKey: ['qc-queue'] });
      return data;
    },
  });
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
        const qty = Number(completeForm.passedQuantity) || (grn ? grnQty(grn) : 0);
        setPostQcNext({ materialId, materialCode, qty });
        showSuccess(incomingQcSuccessMessage());
      } else if (activeInspection?.inspectionType === 'SAMPLING' || activeInspection?.referenceType === 'SAMPLE') {
        showSuccess(insp.result === 'FAIL' || insp.disposition === 'REJECT'
          ? 'Sample QC failed - sampling / manager can request a revision'
          : 'Sample QC passed - next is fit trial or buyer approval');
      } else {
        showSuccess(`Inspection ${insp.inspectionNumber} completed`);
      }
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const pendingGrns = pending?.pendingGrns ?? [];
  const inProgressBatches = pending?.inProgressBatches ?? [];
  const completedBatches = pending?.completedBatches ?? [];
  const pendingSamples = pending?.pendingSamples ?? [];

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

  const runIncomingQc = async (grn: GoodsReceiptRef) => {
    try {
      let insp: QualityInspection | undefined;
      const linked = grn.qcInspectionId;
      if (linked && typeof linked === 'object' && linked._id) {
        insp = queue.find((q) => q._id === linked._id) || {
          _id: linked._id,
          inspectionNumber: linked.inspectionNumber || '',
          inspectionType: 'INCOMING',
          status: linked.status || 'PENDING',
        };
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

  type PendingSample = NonNullable<QualityPendingWork['pendingSamples']>[number];

  const runSampleQc = async (s: PendingSample) => {
    try {
      const linked = s.qcInspectionId;
      let insp: QualityInspection | undefined;
      if (linked && typeof linked === 'object' && linked._id) {
        insp = queue.find((q) => q._id === linked._id) || {
          _id: linked._id,
          inspectionNumber: linked.inspectionNumber || '',
          inspectionType: 'SAMPLING',
          status: linked.status || 'PENDING',
          referenceType: 'SAMPLE',
          referenceId: s._id,
        };
      }
      if (!insp) {
        insp = queue.find((q) => q.referenceType === 'SAMPLE' && inspectionRefId(q) === s._id);
      }
      if (!insp) {
        setError('Inspection not ready yet - refresh or open the sample');
        return;
      }
      if (insp.status === 'PENDING') {
        insp = await startMut.mutateAsync(insp._id);
      }
      openComplete(insp, 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sample QC failed');
    }
  };

  const tabMeta: Record<TabId, { title: string; hint: string }> = {
    incoming: { title: 'Incoming QC', hint: 'Purchase GRNs waiting for inspection. Passed qty receipts to dock or an RM bin.' },
    samples: { title: 'Sample QC', hint: 'After stitching, inspect the garment. Pass moves it to fit trial or buyer review.' },
    inprocess: { title: 'In-process QC', hint: 'Create or complete inspections on batches currently on the floor.' },
    final: { title: 'Final QC', hint: 'Inspect completed batches. Optionally mark dispatch-ready on pass.' },
    queue: { title: 'Active queue', hint: 'Inspections already created - start or complete them here.' },
    history: { title: 'Inspection history', hint: 'Search and filter completed and in-progress inspections.' },
  };

  return (
    <div className="space-y-3">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      {postQcNext && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <h3 className="text-sm font-semibold text-emerald-800">Incoming QC complete - stock on dock</h3>
          <p className="mt-1 text-[12px] text-erp-text-muted">
            {postQcNext.qty ?? 0} units posted to unallocated dock
            {postQcNext.materialCode ? ` (${postQcNext.materialCode})` : ''}.
            Optional: put away to a bin, or reserve/issue from dock.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/inventory"><ErpButton variant="secondary" className={btnSm}>View inventory</ErpButton></Link>
            <Link to={putAwayPath(postQcNext.materialId, postQcNext.materialCode)}>
              <ErpButton className={btnSm}>Put away -&gt;</ErpButton>
            </Link>
            <Link to="/samples"><ErpButton variant="secondary" className={btnSm}>Samples</ErpButton></Link>
            <Link to="/production/orders"><ErpButton variant="secondary" className={btnSm}>Production</ErpButton></Link>
            <ErpButton variant="secondary" className={btnSm} onClick={() => setPostQcNext(null)}>Dismiss</ErpButton>
          </div>
        </div>
      )}

      <ErpPageHeader
        title="Quality Control"
        subtitle={(
          <>
            Incoming GRN QC, sample garments after stitching, and production in-process / final QC.
            <Link to="/samples" className="ml-2 text-[var(--erp-accent)]">Samples -&gt;</Link>
            <Link to="/purchase" className="ml-2 text-[var(--erp-accent)]">Purchase -&gt;</Link>
            <Link to="/inventory" className="ml-2 text-[var(--erp-accent)]">Inventory -&gt;</Link>
            <Link to="/quality/capa" className="ml-2 text-[var(--erp-accent)]">CAPA -&gt;</Link>
            <Link to="/quality/templates" className="ml-2 text-[var(--erp-accent)]">Templates -&gt;</Link>
          </>
        )}
        actions={(
          <ErpButton variant="secondary" className={btnSm} onClick={() => { refetch(); invalidate(); }} disabled={isFetching}>
            <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </ErpButton>
        )}
      />

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--erp-border)] bg-[var(--erp-border)] sm:grid-cols-4 xl:grid-cols-7">
        <StatTile icon={ClipboardCheck} label="Pending QC" value={stats?.pending ?? 0} onClick={() => setTab('queue')} highlight={(stats?.pending ?? 0) > 0 ? 'warn' : undefined} />
        <StatTile icon={FlaskConical} label="In progress" value={stats?.inProgress ?? 0} onClick={() => setTab('queue')} />
        <StatTile icon={CheckCircle2} label="First-pass yield" value={`${stats?.firstPassYield ?? 0}%`} onClick={() => setTab('history')} />
        <StatTile icon={AlertTriangle} label="Open CAPA" value={stats?.openCapa ?? 0} highlight={(stats?.openCapa ?? 0) > 0 ? 'warn' : undefined} onClick={() => navigate('/quality/capa')} />
        <StatTile icon={ShieldCheck} label="Defects logged" value={stats?.defectsLogged ?? 0} onClick={() => setTab('history')} />
        <StatTile icon={ClipboardCheck} label="GRNs waiting" value={stats?.pendingGrns ?? pendingGrns.length} highlight={pendingGrns.length > 0 ? 'accent' : undefined} onClick={() => setTab('incoming')} />
        <StatTile icon={Shirt} label="Sample QC" value={stats?.pendingSampleQc ?? pendingSamples.length} onClick={() => setTab('samples')} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] px-3 py-2 text-[12px]">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-erp-text-muted">Incoming flow</span>
        {RM_INCOMING_QC_FLOW.map((step, i) => (
          <span key={step.id} className="flex items-center gap-1">
            {i > 0 && <ArrowRight size={11} className="text-erp-text-muted" />}
            <span
              className={`rounded px-1.5 py-0.5 ${tab === 'incoming' && step.id === 'inspect' ? 'bg-[var(--erp-accent-muted)] font-medium' : 'text-erp-text-muted'}`}
              title={step.detail}
            >
              {step.label}
            </span>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] px-4 py-3">
        <div>
          <label className={fieldLabel}>RM receive bin</label>
          <ErpSelect value={rmBinId} onChange={(e) => setRmBinId(e.target.value)} className="min-w-[160px] !py-1.5 text-[12px]">
            <option value="">Unallocated dock</option>
            {rmBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
          </ErpSelect>
        </div>
        <div>
          <label className={fieldLabel}>FG bin (final QC)</label>
          <ErpSelect value={fgBinId} onChange={(e) => setFgBinId(e.target.value)} className="min-w-[160px] !py-1.5 text-[12px]">
            <option value="">Default warehouse</option>
            {fgBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
          </ErpSelect>
        </div>
        <label className="mb-1.5 flex items-center gap-2 text-[12px] text-erp-text-muted">
          <input type="checkbox" checked={autoDispatch} onChange={(e) => setAutoDispatch(e.target.checked)} className="rounded" />
          Auto mark dispatch-ready after final QC
        </label>
      </div>

      <TabShell
        tabs={(
          <ErpTabs
            tabs={[
              { id: 'incoming', label: `Incoming (${pendingGrns.length})` },
              { id: 'samples', label: `Samples (${pendingSamples.length})` },
              { id: 'inprocess', label: `In-process (${inProgressBatches.length})` },
              { id: 'final', label: `Final (${completedBatches.length})` },
              { id: 'queue', label: `Queue (${queue.length})` },
              { id: 'history', label: 'History' },
            ]}
            active={tab}
            onChange={(id) => setTab(id as TabId)}
          />
        )}
      >
        <TabToolbar title={tabMeta[tab].title} hint={tabMeta[tab].hint}>
          {tab === 'history' && (
            <>
              <div className="relative min-w-[180px]">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-erp-text-muted" />
                <ErpInput
                  className="!py-1.5 pl-8 text-[12px]"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Number or reference..."
                  onKeyDown={(e) => e.key === 'Enter' && (setSearch(searchInput), setPage(1))}
                />
              </div>
              <ErpButton variant="secondary" className={btnSm} onClick={() => { setSearch(searchInput); setPage(1); }}>Search</ErpButton>
              <div className="w-36">
                <label className={fieldLabel}>Status</label>
                <ErpSelect className="!py-1.5 text-[12px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All</option>
                  {['PENDING', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </ErpSelect>
              </div>
              <div className="w-36">
                <label className={fieldLabel}>Type</label>
                <ErpSelect className="!py-1.5 text-[12px]" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                  <option value="">All</option>
                  {(catalog?.inspectionTypes ?? ['INCOMING', 'IN_PROCESS', 'FINAL', 'SAMPLING']).map((t) => (
                    <option key={t} value={t}>{typeLabel(t)}</option>
                  ))}
                </ErpSelect>
              </div>
            </>
          )}
        </TabToolbar>

        {tab === 'incoming' && (
          <div>
            {pendingGrns.length === 0 ? (
              <InfoBanner>
                No GRNs pending QC. Receive goods in <Link to="/purchase" className="font-medium text-[var(--erp-accent)]">Purchase -&gt; Receipts</Link> and submit for QC.
              </InfoBanner>
            ) : null}
            <div className="overflow-x-auto">
              <ErpDataTable className="w-full min-w-[720px] text-[12px]">
                <thead>
                  <tr>
                    <th>GRN</th>
                    <th>PO</th>
                    <th>Lines</th>
                    <th className="text-right">Qty</th>
                    <th>Inspection</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingGrns.map((grn) => {
                    const linkedInsp = grn.qcInspectionId;
                    const inspLabel = linkedInsp && typeof linkedInsp === 'object' ? linkedInsp.inspectionNumber : undefined;
                    return (
                      <tr key={grn._id}>
                        <td className="whitespace-nowrap font-mono font-medium">{grn.grnNumber}</td>
                        <td className="font-mono text-erp-text-muted">{poNumberFromGrn(grn)}</td>
                        <td className="text-erp-text-muted">{grnLineSummary(grn)}</td>
                        <td className="text-right">{grnQty(grn)}</td>
                        <td className="font-mono text-[11px] text-erp-text-muted">{inspLabel || '-'}</td>
                        <td className="text-right">
                          <ActionStack>
                            {canUpdate && (
                              <ErpButton
                                className={btnSm}
                                disabled={createIncoming.isPending || startMut.isPending}
                                onClick={() => runIncomingQc(grn)}
                              >
                                {inspLabel ? 'Complete QC' : 'Inspect and complete'}
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
                          </ActionStack>
                        </td>
                      </tr>
                    );
                  })}
                  {pendingGrns.length === 0 && (
                    <EmptyRow colSpan={6}>No incoming GRNs waiting</EmptyRow>
                  )}
                </tbody>
              </ErpDataTable>
            </div>
          </div>
        )}

        {tab === 'samples' && (
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[640px] text-[12px]">
              <thead>
                <tr>
                  <th>Sample</th>
                  <th>Design</th>
                  <th>Inspection</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingSamples.map((s) => {
                  const design = s.designId && typeof s.designId === 'object'
                    ? [s.designId.designCode, s.designId.title].filter(Boolean).join(' - ')
                    : '';
                  const insp = s.qcInspectionId && typeof s.qcInspectionId === 'object' ? s.qcInspectionId : null;
                  const canInspect = canUpdate && !!(
                    insp?._id
                    || queue.find((q) => q.referenceType === 'SAMPLE' && inspectionRefId(q) === s._id)
                  );
                  return (
                    <tr key={s._id}>
                      <td className="whitespace-nowrap font-mono font-medium">{s.sampleCode}</td>
                      <td className="text-erp-text-muted">{design || '-'}</td>
                      <td className="font-mono text-[11px] text-erp-text-muted">{insp?.inspectionNumber || '-'}</td>
                      <td className="text-right">
                        <ActionStack>
                          <TextLink to={`/samples?sampleId=${s._id}`}>Open sample</TextLink>
                          {canInspect && (
                            <ErpButton
                              className={btnSm}
                              disabled={startMut.isPending}
                              onClick={() => runSampleQc(s)}
                            >
                              Inspect
                            </ErpButton>
                          )}
                        </ActionStack>
                      </td>
                    </tr>
                  );
                })}
                {pendingSamples.length === 0 && (
                  <EmptyRow colSpan={4}>No samples waiting for QC</EmptyRow>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}

        {tab === 'inprocess' && (
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[640px] text-[12px]">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Stage</th>
                  <th className="text-right">Planned</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inProgressBatches.map((b) => (
                  <tr key={b._id}>
                    <td className="whitespace-nowrap font-mono font-medium">{b.batchNumber}</td>
                    <td>{b.currentStage || '-'}</td>
                    <td className="text-right">{b.plannedQuantity ?? '-'}</td>
                    <td className="text-right">
                      {canCreate && (
                        <div className="flex flex-wrap justify-end gap-1.5">
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
                              className={btnSm}
                              onClick={() => createInProcess.mutateAsync(b._id).then((insp) => openComplete(insp, batchQty(b)))}
                            >
                              Quick complete
                            </ErpButton>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {inProgressBatches.length === 0 && (
                  <EmptyRow colSpan={4}>No in-progress batches</EmptyRow>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}

        {tab === 'final' && (
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[560px] text-[12px]">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th className="text-right">Produced</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {completedBatches.map((b) => (
                  <tr key={b._id}>
                    <td className="whitespace-nowrap font-mono font-medium">{b.batchNumber}</td>
                    <td className="text-right">{batchQty(b)}</td>
                    <td className="text-right">
                      {canCreate && (
                        <ErpButton
                          className={btnSm}
                          disabled={createFinal.isPending}
                          onClick={() => createFinal.mutate({ batchId: b._id, qty: batchQty(b) })}
                        >
                          Final QC
                        </ErpButton>
                      )}
                    </td>
                  </tr>
                ))}
                {completedBatches.length === 0 && (
                  <EmptyRow colSpan={3}>No batches awaiting final QC</EmptyRow>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}

        {tab === 'queue' && (
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[640px] text-[12px]">
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
                    <td className="whitespace-nowrap font-mono font-medium">{q.inspectionNumber}</td>
                    <td>
                      {typeLabel(q.inspectionType)}
                      {(q.inspectionType === 'SAMPLING' || q.referenceType === 'SAMPLE') && inspectionRefId(q) && (
                        <TextLink to={`/samples?sampleId=${inspectionRefId(q)}`}> Sample</TextLink>
                      )}
                    </td>
                    <td><ErpStatusBadge status={q.status} label={statusLabel(q.status)} /></td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {canUpdate && q.status === 'PENDING' && (
                          <ErpButton variant="secondary" className={btnSm} onClick={() => startMut.mutate(q._id)}>Start</ErpButton>
                        )}
                        {canUpdate && ['PENDING', 'IN_PROGRESS'].includes(q.status) && (
                          <ErpButton className={btnSm} onClick={() => openComplete(q)}>Complete</ErpButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <EmptyRow colSpan={4}>No inspections in queue</EmptyRow>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}

        {tab === 'history' && (
          <div>
            <div className="overflow-x-auto">
              <ErpDataTable className="w-full min-w-[800px] text-[12px]">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Result</th>
                    <th className="text-right">Pass / Fail</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <EmptyRow colSpan={6}>Loading...</EmptyRow>
                  ) : inspections.map((i) => (
                    <tr key={i._id}>
                      <td className="whitespace-nowrap font-mono font-medium">{i.inspectionNumber}</td>
                      <td>{inspectionSummary(i)}</td>
                      <td><ErpStatusBadge status={i.status} label={statusLabel(i.status)} /></td>
                      <td>{resultLabel(i.result)}</td>
                      <td className="text-right">
                        {i.passedQuantity ?? '-'} / {i.failedQuantity ?? '-'}
                        {i.disposition && <span className="ml-1 text-[11px] text-erp-text-muted">({dispositionLabel(i.disposition)})</span>}
                      </td>
                      <td className="whitespace-nowrap text-erp-text-muted">{formatDateTime(i.completedAt)}</td>
                    </tr>
                  ))}
                  {!isLoading && inspections.length === 0 && (
                    <EmptyRow colSpan={6}>No inspections found</EmptyRow>
                  )}
                </tbody>
              </ErpDataTable>
            </div>
            {meta && (
              <TablePager
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                onPrev={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
              />
            )}
          </div>
        )}
      </TabShell>

      {completeId && activeInspection && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/45 p-4" onClick={() => setCompleteId(null)} role="presentation">
          <div
            className="my-auto w-full max-w-lg rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface,var(--erp-header-bg,#fff))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between border-b border-[var(--erp-border)] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-erp-text-primary">Complete inspection</h3>
                <p className="mt-0.5 text-[12px] text-erp-text-muted">
                  {activeInspection.inspectionNumber} · {typeLabel(activeInspection.inspectionType)}
                  {(activeInspection.inspectionType === 'SAMPLING' || activeInspection.referenceType === 'SAMPLE') && (
                    <>
                      {' · '}
                      <Link to={`/samples?sampleId=${inspectionRefId(activeInspection)}`} className="text-[var(--erp-accent)]">Open sample</Link>
                    </>
                  )}
                </p>
              </div>
              <button type="button" className="rounded p-1 text-erp-text-muted hover:bg-[var(--erp-surface-muted)]" onClick={() => setCompleteId(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              {(activeInspection.inspectionType === 'SAMPLING' || activeInspection.referenceType === 'SAMPLE') && (
                <p className="mb-3 text-[12px] text-erp-text-muted">
                  One garment. PASS moves the sample to fit trial (fit samples) or buyer approval. REJECT marks QC failed.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabel}>Passed qty</label>
                  <ErpInput type="number" min={0} className="!py-1.5 text-[12px]" value={completeForm.passedQuantity} onChange={(e) => setCompleteForm((f) => ({ ...f, passedQuantity: e.target.value }))} />
                </div>
                <div>
                  <label className={fieldLabel}>Failed qty</label>
                  <ErpInput type="number" min={0} className="!py-1.5 text-[12px]" value={completeForm.failedQuantity} onChange={(e) => setCompleteForm((f) => ({ ...f, failedQuantity: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={fieldLabel}>Disposition</label>
                  <ErpSelect className="!py-1.5 text-[12px]" value={completeForm.disposition} onChange={(e) => setCompleteForm((f) => ({ ...f, disposition: e.target.value as 'PASS' | 'REWORK' | 'REJECT' }))}>
                    {(catalog?.dispositions ?? ['PASS', 'REWORK', 'REJECT']).map((d) => (
                      <option key={d} value={d}>{dispositionLabel(d)}</option>
                    ))}
                  </ErpSelect>
                </div>
                {activeInspection.inspectionType === 'INCOMING' && (
                  <div className="col-span-2">
                    <label className={fieldLabel}>RM storage bin</label>
                    <ErpSelect className="!py-1.5 text-[12px]" value={completeForm.storageBinId} onChange={(e) => setCompleteForm((f) => ({ ...f, storageBinId: e.target.value }))}>
                      <option value="">Unallocated dock (default)</option>
                      {rmBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
                    </ErpSelect>
                    <p className="mt-1 text-[11px] text-erp-text-muted">Passed qty posts on complete. Leave dock empty to put away later in Warehouse.</p>
                  </div>
                )}
                {activeInspection.inspectionType === 'FINAL' && (
                  <>
                    <div className="col-span-2">
                      <label className={fieldLabel}>FG storage bin</label>
                      <ErpSelect className="!py-1.5 text-[12px]" value={completeForm.storageBinId} onChange={(e) => setCompleteForm((f) => ({ ...f, storageBinId: e.target.value }))}>
                        <option value="">Default warehouse</option>
                        {fgBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
                      </ErpSelect>
                    </div>
                    <label className="col-span-2 flex items-center gap-2 text-[12px]">
                      <input type="checkbox" checked={completeForm.autoDispatchReady} onChange={(e) => setCompleteForm((f) => ({ ...f, autoDispatchReady: e.target.checked }))} />
                      Mark dispatch-ready on pass
                    </label>
                  </>
                )}
              </div>

              {canUpdate && (
                <div className="mt-4 rounded-md border border-[var(--erp-border)] p-3">
                  <h4 className="mb-2 text-[12px] font-semibold">Defects ({defects.length})</h4>
                  {defects.length > 0 && (
                    <ul className="mb-3 space-y-1 text-[12px]">
                      {defects.map((d: QualityDefect) => (
                        <li key={d._id} className="flex justify-between text-erp-text-muted">
                          <span>{d.description || 'Defect'} x {d.quantity}</span>
                          <span>{d.severity}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className={fieldLabel}>Category</label>
                      <ErpSelect className="!py-1.5 text-[12px]" value={defectForm.categoryId} onChange={(e) => setDefectForm((f) => ({ ...f, categoryId: e.target.value }))}>
                        <option value="">Uncategorized</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>{c.code} - {c.name}</option>
                        ))}
                      </ErpSelect>
                    </div>
                    <div className="col-span-2">
                      <label className={fieldLabel}>Description</label>
                      <ErpInput className="!py-1.5 text-[12px]" value={defectForm.description} onChange={(e) => setDefectForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Qty</label>
                      <ErpInput type="number" min={1} className="!py-1.5 text-[12px]" value={defectForm.quantity} onChange={(e) => setDefectForm((f) => ({ ...f, quantity: e.target.value }))} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Severity</label>
                      <ErpSelect className="!py-1.5 text-[12px]" value={defectForm.severity} onChange={(e) => setDefectForm((f) => ({ ...f, severity: e.target.value }))}>
                        {(catalog?.defectSeverities ?? ['MINOR', 'MAJOR', 'CRITICAL']).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </ErpSelect>
                    </div>
                  </div>
                  <ErpButton variant="secondary" className={`mt-2 ${btnSm}`} disabled={recordDefect.isPending} onClick={() => recordDefect.mutate()}>
                    Add defect
                  </ErpButton>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--erp-border)] px-4 py-3">
              <ErpButton variant="secondary" className={btnSm} onClick={() => setCompleteId(null)}>Cancel</ErpButton>
              {canUpdate && (
                <ErpButton
                  className={btnSm}
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
          </div>
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
