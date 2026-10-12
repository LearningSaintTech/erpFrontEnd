import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, BookTemplate, CheckCircle2, ClipboardCheck, Eye, Factory, PackageCheck, Play, RefreshCw, ShieldCheck, Shirt,
} from 'lucide-react';
import { qualityApi, warehouseApi } from '../../services/operations';
import type {
  GoodsReceiptRef, ProductionBatch, QualityInspection, QualityPendingWork, Warehouse,
} from '../../types/api';
import {
  Badge, Button, EmptyRow, ErpDataTable, ErpSelect, FilterBar, IconButton, InfoBanner, KpiGrid, PageHeader,
  RowActionsMenu, SearchInput, Section, StatTile, StatusBadge, TablePager, TableSkeleton, Tabs, toast,
} from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  formatDateTime, grnLineSummary, incomingQcSuccessMessage, inspectionRefId, inspectionSummary, poNumberFromGrn, typeLabel,
} from './qualityUtils';
import { putAwayPath } from '../inventory/inventoryUtils';
import { CompleteInspectionDrawer, type CompleteInit, type IncomingLineForm } from './CompleteInspectionDrawer';
import { InspectionDetailDrawer } from './InspectionDetailDrawer';
import { useDebouncedValue } from '../production/useProductionActions';
import { QueryErrorRow } from '../production/QueryErrorRow';

const PAGE_SIZE = 15;
/** Batches reach QC from the shop floor — poll so new work shows up without a manual refresh. */
const LIVE_REFRESH_MS = 15_000;

type TabId = 'incoming' | 'inprocess' | 'final' | 'samples' | 'queue' | 'history';
const TAB_IDS: TabId[] = ['incoming', 'inprocess', 'final', 'samples', 'queue', 'history'];

/** Remembered QC defaults (per viewer). */
const PREF = { rmBin: 'erp-qc-rm-bin', fgBin: 'erp-qc-fg-bin', autoDispatch: 'erp-qc-auto-dispatch' };
function readPref(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function grnQty(grn: GoodsReceiptRef) {
  return grn.lines?.reduce((s, l) => s + (l.receivedQty ?? 0), 0) || 0;
}

/** In-process QC lot = good pieces still in the batch. */
function goodQty(b: ProductionBatch) {
  const rejected = (b as ProductionBatch & { rejectedQuantity?: number }).rejectedQuantity || 0;
  return Math.max(0, (b.plannedQuantity || 0) - rejected);
}

/** Final QC lot = pieces produced (planned − in-process rejects); legacy batches fall back to planned. */
function batchQty(b: ProductionBatch) {
  return b.producedQuantity || goodQty(b);
}

function grnLineForms(grn?: GoodsReceiptRef): IncomingLineForm[] {
  return (grn?.lines || [])
    .filter((l) => (l.receivedQty ?? 0) > 0)
    .map((l) => {
      const mat = l.materialId;
      const matObj = typeof mat === 'object' && mat ? mat : undefined;
      const received = l.receivedQty ?? 0;
      return {
        materialId: matObj?._id || (typeof mat === 'string' ? mat : ''),
        materialCode: matObj?.materialCode,
        name: matObj?.name,
        unit: l.unit || matObj?.unit,
        receivedQty: received,
        accepted: String(received),
        rejected: '0',
      };
    });
}

const stage = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '—');

export function QualityPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('quality.create');
  const canUpdate = permissions.includes('*') || permissions.includes('quality.update');

  const paramTab = searchParams.get('tab') as TabId | null;
  const [chosenTab, setChosenTab] = useState<TabId | null>(paramTab && TAB_IDS.includes(paramTab) ? paramTab : null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [completeInit, setCompleteInit] = useState<CompleteInit | null>(null);
  const [detail, setDetail] = useState<QualityInspection | null>(null);
  const [postQcNext, setPostQcNext] = useState<{ materialId?: string; materialCode?: string; qty?: number } | null>(null);

  const invalidate = () => {
    [
      'quality-stats', 'quality-pending', 'qc-queue', 'quality-inspections', 'quality-inspection', 'grns', 'purchase-list',
      'purchase-stats', 'batches', 'batch-board', 'production-list', 'production-stats', 'production-batch', 'batch-inspections',
      'inventory-balances', 'inventory-balances-page', 'inventory-stats', 'dispatch-ready', 'samples', 'sample', 'sample-stats',
    ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const statsQ = useQuery({ queryKey: ['quality-stats'], queryFn: () => qualityApi.stats(), refetchInterval: LIVE_REFRESH_MS });
  const stats = statsQ.data;
  const { data: catalog } = useQuery({ queryKey: ['quality-catalog'], queryFn: () => qualityApi.catalog() });
  const pendingQ = useQuery({
    queryKey: ['quality-pending'],
    refetchInterval: LIVE_REFRESH_MS,
    queryFn: async () => {
      const data = await qualityApi.pendingWork();
      qc.invalidateQueries({ queryKey: ['qc-queue'] });
      return data;
    },
  });
  const pending = pendingQ.data;
  const queueQ = useQuery({ queryKey: ['qc-queue'], queryFn: qualityApi.queue, refetchInterval: LIVE_REFRESH_MS });
  const queue = queueQ.data ?? [];

  const pendingGrns = pending?.pendingGrns ?? [];
  const inProgressBatches = pending?.inProgressBatches ?? [];
  const completedBatches = pending?.completedBatches ?? [];
  const pendingSamples = pending?.pendingSamples ?? [];

  // Open the first tab that has work waiting, unless the user picked one.
  const autoTab: TabId = pendingGrns.length ? 'incoming'
    : completedBatches.length ? 'final'
      : inProgressBatches.length ? 'inprocess'
        : pendingSamples.length ? 'samples'
          : queue.length ? 'queue' : 'incoming';
  const tab: TabId = chosenTab ?? autoTab;
  const setTab = (id: TabId) => {
    setChosenTab(id);
    setPage(1);
    if (searchParams.get('tab')) {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
    }
  };

  const historyQ = useQuery({
    queryKey: ['quality-inspections', page, search, statusFilter, typeFilter],
    queryFn: () => qualityApi.listPage({
      page, limit: PAGE_SIZE, search: search || undefined, status: statusFilter || undefined, inspectionType: typeFilter || undefined,
    }),
    enabled: tab === 'history',
    placeholderData: (prev) => prev,
  });
  const inspections = historyQ.data?.items ?? [];
  const meta = historyQ.data?.meta;

  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => warehouseApi.list() });
  const rmWh = warehouses.find((w: Warehouse) => w.type === 'RAW_MATERIAL') || warehouses[0];
  const fgWh = warehouses.find((w: Warehouse) => w.type === 'FINISHED_GOODS') || warehouses[0];
  const { data: rmBins = [] } = useQuery({ queryKey: ['bins', rmWh?._id, 'qc-rm'], queryFn: () => warehouseApi.listBins(rmWh!._id), enabled: !!rmWh?._id });
  const { data: fgBins = [] } = useQuery({ queryKey: ['bins', fgWh?._id, 'qc-fg'], queryFn: () => warehouseApi.listBins(fgWh!._id), enabled: !!fgWh?._id });

  const createIncoming = useMutation({ mutationFn: (grnId: string) => qualityApi.createIncoming(grnId) });
  const createInProcess = useMutation({ mutationFn: (batchId: string) => qualityApi.createInProcess(batchId) });
  const createFinal = useMutation({
    mutationFn: (batchId: string) => qualityApi.createFinal(batchId, {
      storageBinId: readPref(PREF.fgBin) || undefined,
      autoDispatchReady: readPref(PREF.autoDispatch) === '1',
    }),
  });
  const startMut = useMutation({ mutationFn: (id: string) => qualityApi.start(id) });
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const openComplete = (insp: QualityInspection, defaultQty?: number) => {
    let qty = defaultQty ?? 0;
    let lines: IncomingLineForm[] = [];
    const refId = inspectionRefId(insp);
    if (insp.inspectionType === 'INCOMING') {
      const grn = pendingGrns.find((g) => g._id === refId);
      lines = grnLineForms(grn);
      if (!qty && grn) qty = grnQty(grn);
    }
    if (!qty && insp.inspectionType === 'FINAL') {
      const batch = completedBatches.find((b) => b._id === refId);
      if (batch) qty = batchQty(batch);
    }
    if (!qty && insp.inspectionType === 'IN_PROCESS') {
      const batch = inProgressBatches.find((b) => b._id === refId);
      if (batch) qty = goodQty(batch);
    }
    if (!qty && (insp.inspectionType === 'SAMPLING' || insp.referenceType === 'SAMPLE')) qty = 1;
    // Freeze the auto-picked tab so the list doesn't jump once this queue empties.
    setChosenTab((c) => c ?? tab);
    setDetail(null);
    setCompleteInit({
      inspection: insp,
      qty,
      base: ['FINAL', 'IN_PROCESS'].includes(insp.inspectionType) && qty > 0 ? qty : undefined,
      lines,
      storageBinId: readPref(insp.inspectionType === 'INCOMING' ? PREF.rmBin : PREF.fgBin),
      autoDispatchReady: readPref(PREF.autoDispatch) === '1',
    });
  };

  /** Wraps a multi-step "get inspection ready, then open the form" flow with a row spinner + toast on failure. */
  const withRow = async (rowId: string, fn: () => Promise<void>) => {
    setBusyRow(rowId);
    try { await fn(); } catch { /* mutation errors already toast */ } finally { setBusyRow(null); }
  };

  const runIncomingQc = (grn: GoodsReceiptRef) => withRow(grn._id, async () => {
    let insp: QualityInspection | undefined;
    const linked = grn.qcInspectionId;
    if (linked && typeof linked === 'object' && linked._id) {
      insp = queue.find((q) => q._id === linked._id) || {
        _id: linked._id, inspectionNumber: linked.inspectionNumber || '', inspectionType: 'INCOMING', status: linked.status || 'PENDING',
      };
    }
    if (!insp) insp = queue.find((q) => inspectionRefId(q) === grn._id && q.inspectionType === 'INCOMING');
    if (!insp) insp = await createIncoming.mutateAsync(grn._id);
    if (insp.status === 'PENDING') insp = await startMut.mutateAsync(insp._id);
    invalidate();
    openComplete(insp, grnQty(grn));
  });

  type PendingSample = NonNullable<QualityPendingWork['pendingSamples']>[number];
  const sampleInspection = (s: PendingSample): QualityInspection | undefined => {
    const linked = s.qcInspectionId;
    if (linked && typeof linked === 'object' && linked._id) {
      return queue.find((q) => q._id === linked._id) || {
        _id: linked._id, inspectionNumber: linked.inspectionNumber || '', inspectionType: 'SAMPLING', status: linked.status || 'PENDING', referenceType: 'SAMPLE', referenceId: s._id,
      };
    }
    return queue.find((q) => q.referenceType === 'SAMPLE' && inspectionRefId(q) === s._id);
  };
  const runSampleQc = (s: PendingSample) => withRow(s._id, async () => {
    let insp = sampleInspection(s);
    if (!insp) {
      toast.warning('Inspection not ready yet', { description: 'Refresh, or open the sample to check its status.' });
      return;
    }
    if (insp.status === 'PENDING') insp = await startMut.mutateAsync(insp._id);
    openComplete(insp, 1);
  });

  const openBatchInspection = (b: ProductionBatch, type: 'IN_PROCESS' | 'FINAL') =>
    queue.find((q) => q.inspectionType === type && inspectionRefId(q) === b._id && q.status !== 'COMPLETED');

  const runInProcess = (b: ProductionBatch, completeAfter: boolean) => withRow(b._id, async () => {
    const existing = openBatchInspection(b, 'IN_PROCESS');
    const insp = existing ?? await createInProcess.mutateAsync(b._id);
    invalidate();
    if (completeAfter) openComplete(insp, goodQty(b));
    else toast.success(`In-process inspection ${insp.inspectionNumber} created`);
  });

  const runFinal = (b: ProductionBatch) => withRow(b._id, async () => {
    const insp = openBatchInspection(b, 'FINAL') ?? await createFinal.mutateAsync(b._id);
    invalidate();
    openComplete(insp, batchQty(b));
  });

  const startOnly = (q: QualityInspection) => withRow(q._id, async () => {
    const insp = await startMut.mutateAsync(q._id);
    toast.success(`Started ${insp.inspectionNumber}`);
    invalidate();
    if (detail?._id === q._id) setDetail(insp);
  });

  const onCompleted = (insp: QualityInspection, init: CompleteInit, lines: IncomingLineForm[]) => {
    const type = init.inspection.inspectionType;
    setCompleteInit(null);
    if (type === 'INCOMING') {
      const firstAccepted = lines.find((l) => (Number(l.accepted) || 0) > 0) || lines[0];
      const qty = lines.reduce((sum, l) => sum + (Number(l.accepted) || 0), 0);
      setPostQcNext({ materialId: firstAccepted?.materialId, materialCode: firstAccepted?.materialCode, qty });
      toast.success(incomingQcSuccessMessage());
    } else if (type === 'SAMPLING' || init.inspection.referenceType === 'SAMPLE') {
      toast.success(insp.result === 'FAIL' || insp.disposition === 'REJECT' ? 'Sample QC failed' : 'Sample QC passed', {
        description: insp.result === 'FAIL' || insp.disposition === 'REJECT'
          ? 'Sampling or the manager can request a revision.'
          : 'Next is fit trial or buyer approval.',
      });
    } else {
      toast.success(`Inspection ${insp.inspectionNumber} completed`);
    }
    invalidate();
  };

  const historyFilters = !!(searchInput || statusFilter || typeFilter);
  const clearHistory = () => { setSearchInput(''); setStatusFilter(''); setTypeFilter(''); setPage(1); };
  const refresh = () => { statsQ.refetch(); pendingQ.refetch(); queueQ.refetch(); if (tab === 'history') historyQ.refetch(); };
  const pendingLoading = pendingQ.isLoading;

  return (
    <>
      <PageHeader
        title="Quality control"
        description="Inspect incoming material, samples and production batches."
        secondaryActions={(
          <>
            <IconButton aria-label="Refresh" loading={pendingQ.isFetching || queueQ.isFetching} onClick={refresh}><RefreshCw size={16} /></IconButton>
            <Button variant="secondary" icon={<ShieldCheck size={16} />} onClick={() => navigate('/quality/capa')}>CAPA</Button>
            <Button variant="secondary" icon={<BookTemplate size={16} />} onClick={() => navigate('/quality/templates')}>Templates</Button>
          </>
        )}
      />

      {postQcNext && (
        <InfoBanner
          inset={false}
          tone="success"
          className="mb-4"
          title="Incoming QC complete — stock is on the dock"
          action={(
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate(putAwayPath(postQcNext.materialId, postQcNext.materialCode))}>Put away</Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/inventory')}>View inventory</Button>
              <Button size="sm" variant="ghost" onClick={() => setPostQcNext(null)}>Dismiss</Button>
            </div>
          )}
        >
          {postQcNext.qty ?? 0} units{postQcNext.materialCode ? ` of ${postQcNext.materialCode}` : ''} were posted. Put them away to a bin now, or reserve and issue straight from the dock.
        </InfoBanner>
      )}

      <KpiGrid cols={6} className="mb-4">
        <StatTile
          icon={PackageCheck} label="GRNs waiting" value={stats?.pendingGrns ?? pendingGrns.length}
          highlight={pendingGrns.length > 0 ? 'warn' : undefined} onClick={() => setTab('incoming')} active={tab === 'incoming'}
        />
        <StatTile
          icon={Factory} label="Final QC due" value={completedBatches.length} hint="Batches off the line"
          highlight={completedBatches.length > 0 ? 'warn' : undefined} onClick={() => setTab('final')} active={tab === 'final'}
        />
        <StatTile
          icon={ClipboardCheck} label="In queue" value={(stats?.pending ?? 0) + (stats?.inProgress ?? 0)}
          hint={`${stats?.inProgress ?? 0} in progress`} onClick={() => setTab('queue')} active={tab === 'queue'}
        />
        <StatTile icon={Shirt} label="Sample QC" value={stats?.pendingSampleQc ?? pendingSamples.length} onClick={() => setTab('samples')} active={tab === 'samples'} />
        <StatTile
          icon={CheckCircle2} label="Pass rate" value={`${stats?.firstPassYield ?? 0}%`}
          hint={`First pass · ${stats?.defectsLogged ?? 0} defects`} onClick={() => setTab('history')} active={tab === 'history'}
        />
        <StatTile
          icon={AlertTriangle} label="Open CAPA" value={stats?.openCapa ?? 0}
          highlight={(stats?.openCapa ?? 0) > 0 ? 'warn' : undefined} onClick={() => navigate('/quality/capa')}
        />
      </KpiGrid>

      <Section flush>
        <div className="px-3">
          <Tabs
            ariaLabel="Inspection queues"
            tabs={[
              { id: 'incoming', label: 'Incoming', count: pendingGrns.length },
              { id: 'inprocess', label: 'In-process', count: inProgressBatches.length },
              { id: 'final', label: 'Final', count: completedBatches.length },
              { id: 'samples', label: 'Samples', count: pendingSamples.length },
              { id: 'queue', label: 'Open inspections', count: queue.length },
              { id: 'history', label: 'History' },
            ]}
            active={tab}
            onChange={(id) => setTab(id as TabId)}
          />
        </div>

        {tab === 'incoming' && (
          <>
            <InfoBanner tone="info" title="How incoming QC works" dismissKey="quality-incoming-how">
              Purchase records the GRN with the supplier invoice. Inspect each line here: accepted quantity is posted to the unallocated dock (or a bin you choose), rejected quantity stays open on the payment for a replacement delivery. Put stock away from Warehouse afterwards.
            </InfoBanner>
            <ErpDataTable className="mt-3 min-w-[760px]">
              <thead>
                <tr><th>GRN</th><th>Payment</th><th>Materials</th><th className="erp-num">Qty</th><th>Inspection</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {pendingLoading ? <TableSkeleton asRows rows={4} columns={6} /> : pendingQ.isError ? <QueryErrorRow colSpan={6} error={pendingQ.error} onRetry={() => pendingQ.refetch()} /> : pendingGrns.length === 0 ? (
                  <EmptyRow colSpan={6} title="No goods receipts waiting" icon={PackageCheck}>
                    GRNs appear here when Purchase submits them for QC. <Link to="/purchase" className="font-medium text-[var(--erp-accent)]">Go to Purchase</Link>
                  </EmptyRow>
                ) : pendingGrns.map((grn) => {
                  const linked = grn.qcInspectionId;
                  const inspLabel = linked && typeof linked === 'object' ? linked.inspectionNumber : undefined;
                  return (
                    <tr key={grn._id}>
                      <td className="erp-cell-primary whitespace-nowrap font-mono">{grn.grnNumber}</td>
                      <td className="font-mono text-erp-text-muted">{poNumberFromGrn(grn)}</td>
                      <td className="max-w-[320px] truncate text-erp-text-muted" title={grnLineSummary(grn)}>{grnLineSummary(grn)}</td>
                      <td className="erp-num">{grnQty(grn).toLocaleString()}</td>
                      <td className="font-mono text-erp-text-muted">{inspLabel || '—'}</td>
                      <td className="erp-cell-actions">
                        <div className="flex justify-end">
                          {canUpdate ? (
                            <Button size="sm" loading={busyRow === grn._id} icon={<ClipboardCheck size={14} />} onClick={() => runIncomingQc(grn)}>Inspect</Button>
                          ) : canCreate ? (
                            <Button
                              size="sm" variant="secondary" loading={busyRow === grn._id}
                              onClick={() => withRow(grn._id, async () => {
                                const insp = await createIncoming.mutateAsync(grn._id);
                                toast.success(`Inspection ${insp.inspectionNumber} created`);
                                invalidate();
                              })}
                            >
                              Create inspection
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ErpDataTable>
          </>
        )}

        {tab === 'inprocess' && (
          <ErpDataTable className="min-w-[640px]">
            <thead>
              <tr><th>Batch</th><th>Stage</th><th className="erp-num">Planned</th><th className="erp-num">Good</th><th>Inspection</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {pendingLoading ? <TableSkeleton asRows rows={4} columns={6} /> : pendingQ.isError ? <QueryErrorRow colSpan={6} error={pendingQ.error} onRetry={() => pendingQ.refetch()} /> : inProgressBatches.length === 0 ? (
                <EmptyRow colSpan={6} title="No batches on the line" icon={Factory}>Running batches appear here for stage inspections.</EmptyRow>
              ) : inProgressBatches.map((b) => {
                const existing = openBatchInspection(b, 'IN_PROCESS');
                return (
                  <tr key={b._id}>
                    <td className="erp-cell-primary whitespace-nowrap font-mono">{b.batchNumber}</td>
                    <td>{stage(b.currentStage)}</td>
                    <td className="erp-num">{b.plannedQuantity ?? '—'}</td>
                    <td className="erp-num">{goodQty(b)}</td>
                    <td>{existing ? <span className="font-mono text-erp-text-muted">{existing.inspectionNumber}</span> : <span className="text-erp-text-muted">—</span>}</td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {(existing ? canUpdate : canCreate && canUpdate) && (
                          <Button size="sm" loading={busyRow === b._id} icon={<ClipboardCheck size={14} />} onClick={() => runInProcess(b, true)}>
                            {existing ? 'Complete' : 'Inspect'}
                          </Button>
                        )}
                        <RowActionsMenu
                          label={`Actions for ${b.batchNumber}`}
                          items={[
                            { label: 'Create inspection only', icon: Play, hidden: !canCreate || !!existing, onSelect: () => runInProcess(b, false) },
                            { label: 'Open in Production', icon: Eye, onSelect: () => navigate('/production/orders?tab=board') },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
        )}

        {tab === 'final' && (
          <ErpDataTable>
            <thead>
              <tr><th>Batch</th><th className="erp-num">Pieces to inspect</th><th>Inspection</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {pendingLoading ? <TableSkeleton asRows rows={4} columns={4} /> : pendingQ.isError ? <QueryErrorRow colSpan={4} error={pendingQ.error} onRetry={() => pendingQ.refetch()} /> : completedBatches.length === 0 ? (
                <EmptyRow colSpan={4} title="No batches waiting for final QC" icon={Factory}>Batches show up here when they finish the last line stage.</EmptyRow>
              ) : completedBatches.map((b) => {
                const existing = openBatchInspection(b, 'FINAL');
                return (
                  <tr key={b._id}>
                    <td className="erp-cell-primary whitespace-nowrap font-mono">{b.batchNumber}</td>
                    <td className="erp-num">{batchQty(b)}</td>
                    <td>{existing ? <span className="font-mono text-erp-text-muted">{existing.inspectionNumber}</span> : <span className="text-erp-text-muted">—</span>}</td>
                    <td className="erp-cell-actions">
                      <div className="flex justify-end">
                        {(existing ? canUpdate : canCreate) && (
                          <Button size="sm" loading={busyRow === b._id} icon={<ClipboardCheck size={14} />} onClick={() => runFinal(b)}>Final QC</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
        )}

        {tab === 'samples' && (
          <ErpDataTable className="min-w-[640px]">
            <thead>
              <tr><th>Sample</th><th>Design</th><th>Inspection</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {pendingLoading ? <TableSkeleton asRows rows={3} columns={4} /> : pendingQ.isError ? <QueryErrorRow colSpan={4} error={pendingQ.error} onRetry={() => pendingQ.refetch()} /> : pendingSamples.length === 0 ? (
                <EmptyRow colSpan={4} title="No samples waiting for QC" icon={Shirt}>Samples arrive here after stitching.</EmptyRow>
              ) : pendingSamples.map((s) => {
                const design = s.designId && typeof s.designId === 'object' ? [s.designId.designCode, s.designId.title].filter(Boolean).join(' — ') : '';
                const insp = sampleInspection(s);
                return (
                  <tr key={s._id}>
                    <td className="erp-cell-primary whitespace-nowrap font-mono">{s.sampleCode}</td>
                    <td className="text-erp-text-muted">{design || '—'}</td>
                    <td className="font-mono text-erp-text-muted">{insp?.inspectionNumber || '—'}</td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && insp && (
                          <Button size="sm" loading={busyRow === s._id} icon={<ClipboardCheck size={14} />} onClick={() => runSampleQc(s)}>Inspect</Button>
                        )}
                        <RowActionsMenu label={`Actions for ${s.sampleCode}`} items={[{ label: 'Open sample', icon: Eye, onSelect: () => navigate(`/samples?sampleId=${s._id}`) }]} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
        )}

        {tab === 'queue' && (
          <ErpDataTable className="min-w-[640px]">
            <thead>
              <tr><th>Inspection</th><th>Type</th><th>Status</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {queueQ.isLoading ? <TableSkeleton asRows rows={4} columns={4} /> : queueQ.isError ? <QueryErrorRow colSpan={4} error={queueQ.error} onRetry={() => queueQ.refetch()} /> : queue.length === 0 ? (
                <EmptyRow colSpan={4} title="No open inspections" icon={ClipboardCheck}>Inspections you create appear here until they are completed.</EmptyRow>
              ) : queue.map((q) => (
                <tr key={q._id} className={`erp-row-clickable${detail?._id === q._id ? ' erp-row-selected' : ''}`} onClick={() => setDetail(q)}>
                  <td className="erp-cell-primary whitespace-nowrap font-mono">{q.inspectionNumber}</td>
                  <td>{inspectionSummary(q)}</td>
                  <td><StatusBadge status={q.status} /></td>
                  <td className="erp-cell-actions">
                    <div className="flex items-center justify-end gap-1">
                      {canUpdate && ['PENDING', 'IN_PROGRESS'].includes(q.status) && (
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); openComplete(q); }}>Complete</Button>
                      )}
                      <RowActionsMenu
                        label={`Actions for ${q.inspectionNumber}`}
                        items={[
                          { label: 'View details', icon: Eye, onSelect: () => setDetail(q) },
                          { label: 'Mark started', icon: Play, hidden: !(canUpdate && q.status === 'PENDING'), onSelect: () => startOnly(q) },
                          { label: 'Open sample', icon: Shirt, hidden: !(q.inspectionType === 'SAMPLING' || q.referenceType === 'SAMPLE'), onSelect: () => navigate(`/samples?sampleId=${inspectionRefId(q)}`) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        )}

        {tab === 'history' && (
          <>
            <FilterBar
              search={<SearchInput inputSize="sm" value={searchInput} onChange={(v) => { setSearchInput(v); setPage(1); }} placeholder="Search inspection number…" />}
              filters={(
                <>
                  <ErpSelect inputSize="sm" aria-label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                    <option value="">All statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="COMPLETED">Completed</option>
                  </ErpSelect>
                  <ErpSelect inputSize="sm" aria-label="Type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                    <option value="">All types</option>
                    {(catalog?.inspectionTypes ?? ['INCOMING', 'IN_PROCESS', 'FINAL', 'SAMPLING']).map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
                  </ErpSelect>
                </>
              )}
              onClear={historyFilters ? clearHistory : undefined}
            />
            <ErpDataTable className="min-w-[800px]">
              <thead>
                <tr><th>Inspection</th><th>Type</th><th>Status</th><th>Result</th><th className="erp-num">Passed</th><th className="erp-num">Failed</th><th>Completed</th></tr>
              </thead>
              <tbody>
                {historyQ.isLoading ? <TableSkeleton asRows rows={6} columns={7} /> : historyQ.isError ? <QueryErrorRow colSpan={7} error={historyQ.error} onRetry={() => historyQ.refetch()} /> : inspections.length === 0 ? (
                  <EmptyRow
                    colSpan={7}
                    title={historyFilters ? 'No inspections match these filters' : 'No inspections yet'}
                    action={historyFilters ? <Button size="sm" variant="secondary" onClick={clearHistory}>Clear filters</Button> : undefined}
                  />
                ) : inspections.map((i) => (
                  <tr key={i._id} className={`erp-row-clickable${detail?._id === i._id ? ' erp-row-selected' : ''}`} onClick={() => setDetail(i)}>
                    <td className="erp-cell-primary whitespace-nowrap font-mono">{i.inspectionNumber}</td>
                    <td>{inspectionSummary(i)}</td>
                    <td><StatusBadge status={i.status} /></td>
                    <td>{i.result ? <StatusBadge status={i.result} /> : <span className="text-erp-text-muted">—</span>}</td>
                    <td className="erp-num">{i.passedQuantity ?? '—'}</td>
                    <td className="erp-num">{i.failedQuantity ? <span className="text-[var(--erp-danger-text)]">{i.failedQuantity}</span> : (i.failedQuantity ?? '—')}</td>
                    <td className="whitespace-nowrap text-erp-text-muted">
                      {formatDateTime(i.completedAt)}
                      {i.disposition === 'REWORK' && <Badge tone="warning" className="ml-2">Rework</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
            {meta && (
              <TablePager page={page} totalPages={meta.totalPages} total={meta.total} pageSize={PAGE_SIZE} itemLabel="inspections" onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
            )}
          </>
        )}
      </Section>

      <CompleteInspectionDrawer
        init={completeInit}
        onClose={() => setCompleteInit(null)}
        onCompleted={onCompleted}
        rmBins={rmBins}
        fgBins={fgBins}
        dispositions={catalog?.dispositions}
        severities={catalog?.defectSeverities}
        canUpdate={canUpdate}
        onRememberDefaults={(d) => {
          if (d.rmBin !== undefined) writePref(PREF.rmBin, d.rmBin);
          if (d.fgBin !== undefined) writePref(PREF.fgBin, d.fgBin);
          if (d.autoDispatch !== undefined) writePref(PREF.autoDispatch, d.autoDispatch ? '1' : '');
        }}
      />
      <InspectionDetailDrawer
        inspection={detail}
        onClose={() => setDetail(null)}
        canUpdate={canUpdate}
        starting={busyRow === detail?._id}
        onStart={startOnly}
        onComplete={(i) => openComplete(i)}
      />
    </>
  );
}
