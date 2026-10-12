import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, CalendarPlus, ClipboardList, Cpu, Hourglass, Layers, Plus, RefreshCw, TrendingUp,
} from 'lucide-react';
import { productionApi } from '../../services/operations';
import type { ProductionBatch, ProductionOrder, ProductionSchedule } from '../../types/api';
import {
  Badge, Button, EmptyRow, ErpDataTable, ErpSelect, FilterBar, IconButton, KpiGrid, PageHeader, SearchInput,
  Section, StatTile, StatusBadge, TablePager, TableSkeleton, Tabs,
} from '../../components/erp';
import { ApprovalsHint } from '../../components/ApprovalsHint';
import {
  BATCH_STATUSES, ORDER_STATUSES, PRIORITIES, batchGoodQty, batchOrderLabel, formatCost, formatDate, formatDateTime,
  humanStatus, isOverdue, orderLabel, priorityLabel, progressPct, skuLabel, stageLabel, stageNeedsQc,
} from './productionUtils';
import { useDebouncedValue, useProductionActions, useProductionPerms } from './useProductionActions';
import {
  ActionCell, batchMenuItems, batchPrimaryAction, orderMenuItems, orderPrimaryAction, type BatchHandlers, type OrderHandlers,
} from './orderActions';
import {
  AssignResourcesModal, CompleteStageModal, CreateBatchModal, OrderFormDrawer, ScheduleFormDrawer,
} from './ProductionForms';
import { BatchDetailDrawer, OrderDetailDrawer, ProgressBar } from './ProductionDrawers';
import { BatchBoard } from './BatchBoard';
import { QueryErrorRow } from './QueryErrorRow';

const PAGE_SIZE = 15;
/** Shop-floor views poll while open (window-focus refetch alone misses other users' changes on a wall tablet). */
const LIVE_REFRESH_MS = 15_000;
type TabId = 'orders' | 'batches' | 'board' | 'schedules';
const TAB_IDS: TabId[] = ['orders', 'batches', 'board', 'schedules'];
const TAB_KEY = 'erp-production-tab';

function initialTab(param: string | null): TabId {
  if (param && TAB_IDS.includes(param as TabId)) return param as TabId;
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (saved && TAB_IDS.includes(saved as TabId)) return saved as TabId;
  } catch { /* storage unavailable */ }
  return 'orders';
}

export function ProductionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const perms = useProductionPerms();
  const actions = useProductionActions();

  const [tab, setTabState] = useState<TabId>(() => (searchParams.get('filter') === 'overdue' ? 'orders' : initialTab(searchParams.get('tab'))));
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  // ?filter=overdue — the dashboard's "Overdue orders" card lands on the filtered list.
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('filter') === 'overdue');
  const [batchStatusFilter, setBatchStatusFilter] = useState('');

  const [creatingOrder, setCreatingOrder] = useState(false);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [batchFor, setBatchFor] = useState<ProductionOrder | null>(null);
  const [completeBatch, setCompleteBatch] = useState<ProductionBatch | null>(null);
  const [assignBatch, setAssignBatch] = useState<ProductionBatch | null>(null);
  const [openOrder, setOpenOrder] = useState<ProductionOrder | null>(null);
  const [openBatch, setOpenBatch] = useState<ProductionBatch | null>(null);

  const setTab = (id: TabId) => {
    setTabState(id);
    setPage(1);
    try { localStorage.setItem(TAB_KEY, id); } catch { /* ignore */ }
    if (searchParams.get('tab')) {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
    }
  };

  // Other roles (operators, QC) move batches too — poll so KPIs and the board stay current without a manual refresh.
  const statsQ = useQuery({ queryKey: ['production-stats'], queryFn: () => productionApi.stats(), refetchInterval: LIVE_REFRESH_MS });
  const stats = statsQ.data;
  // Fallback stage list for batches created before stage snapshots existed.
  const { data: currentStages = [] } = useQuery({ queryKey: ['production-stages'], queryFn: () => productionApi.listStages() });

  const listQ = useQuery({
    queryKey: ['production-list', tab, page, search, statusFilter, priorityFilter, batchStatusFilter, overdueOnly],
    queryFn: async () => {
      const params = { page, limit: PAGE_SIZE, search: search || undefined };
      if (tab === 'orders') {
        return productionApi.listOrdersPage({
          ...params, status: statusFilter || undefined, priority: priorityFilter || undefined, overdue: overdueOnly ? 'true' : undefined,
        });
      }
      if (tab === 'batches') return productionApi.listBatchesPage({ ...params, status: batchStatusFilter || undefined });
      return productionApi.listSchedulesPage(params);
    },
    enabled: tab !== 'board',
    placeholderData: (prev) => prev,
    refetchInterval: LIVE_REFRESH_MS,
  });
  const boardQ = useQuery({ queryKey: ['batch-board'], queryFn: () => productionApi.batchBoard(), enabled: tab === 'board', refetchInterval: LIVE_REFRESH_MS });

  const items = listQ.data?.items ?? [];
  const meta = listQ.data?.meta;
  const loading = listQ.isLoading;

  const orderHandlers: OrderHandlers = { actions, perms, navigate, onNewBatch: setBatchFor, onOpen: setOpenOrder };
  const batchHandlers: BatchHandlers = {
    actions, perms, navigate, onComplete: setCompleteBatch, onAssign: setAssignBatch, onOpen: setOpenBatch, fallbackStages: currentStages,
  };

  const filtersActive = tab === 'orders' ? !!(statusFilter || priorityFilter || searchInput || overdueOnly) : tab === 'batches' ? !!(batchStatusFilter || searchInput) : !!searchInput;
  const clearFilters = () => { setSearchInput(''); setStatusFilter(''); setPriorityFilter(''); setBatchStatusFilter(''); setOverdueOnly(false); setPage(1); };

  const goOrders = (status: string) => { setTab('orders'); setStatusFilter(status); setPriorityFilter(''); };

  const refresh = () => { listQ.refetch(); statsQ.refetch(); if (tab === 'board') boardQ.refetch(); };
  const running = (stats?.batchesInProgress ?? 0) + (stats?.batchesRework ?? 0);

  return (
    <>
      <PageHeader
        title="Production"
        description="Plan production orders, run batches through the line and track output."
        secondaryActions={(
          <>
            <IconButton aria-label="Refresh" onClick={refresh} loading={listQ.isFetching || boardQ.isFetching}><RefreshCw size={16} /></IconButton>
            <Button variant="secondary" icon={<Cpu size={16} />} onClick={() => navigate('/production/machines')}>Machines</Button>
            {tab === 'schedules' && perms.canUpdate && (
              <Button variant="secondary" icon={<CalendarPlus size={16} />} onClick={() => setCreatingSchedule(true)}>New schedule slot</Button>
            )}
          </>
        )}
        primaryAction={perms.canCreate ? (
          <Button icon={<Plus size={16} />} onClick={() => setCreatingOrder(true)}>New production order</Button>
        ) : undefined}
      />

      {/* Planning numbers are for planners; operators go straight to the board. */}
      {(perms.canCreate || perms.canUpdate || perms.canApprove) && (
      <KpiGrid cols={6} className="mb-4">
        <StatTile
          icon={Layers}
          label="On the line"
          value={running}
          hint={stats?.batchesCreated ? `${stats.batchesCreated} not started` : 'Running batches'}
          onClick={() => setTab('board')}
          active={tab === 'board'}
        />
        <StatTile
          icon={Hourglass}
          label="To approve"
          value={stats?.ordersApprovalPending ?? 0}
          highlight={(stats?.ordersApprovalPending ?? 0) > 0 ? 'warn' : undefined}
          onClick={() => goOrders('APPROVAL_PENDING')}
          active={tab === 'orders' && statusFilter === 'APPROVAL_PENDING'}
        />
        <StatTile
          icon={AlertTriangle}
          label="Overdue"
          value={stats?.overdueOrders ?? 0}
          hint="Past delivery"
          highlight={(stats?.overdueOrders ?? 0) > 0 ? 'warn' : undefined}
          active={tab === 'orders' && overdueOnly}
          onClick={() => { setTab('orders'); setStatusFilter(''); setOverdueOnly((v) => !v); setPage(1); }}
        />
        <StatTile
          icon={ClipboardList}
          label="Active orders"
          value={(stats?.ordersApproved ?? 0) + (stats?.ordersInProgress ?? 0)}
          hint={`${stats?.ordersInProgress ?? 0} in production`}
          onClick={() => goOrders('IN_PROGRESS')}
          active={tab === 'orders' && statusFilter === 'IN_PROGRESS'}
        />
        <StatTile
          icon={ClipboardList}
          label="To plan"
          value={(stats?.ordersCreated ?? 0) + (stats?.ordersMrpDone ?? 0) + (stats?.ordersReserved ?? 0)}
          hint="MRP / reserve / submit"
        />
        <StatTile icon={TrendingUp} label="Fulfilment" value={`${stats?.fulfillmentPct ?? 0}%`} hint="QC-passed vs plan" />
      </KpiGrid>
      )}

      <Section flush>
        <div className="px-3">
          <Tabs
            ariaLabel="Production views"
            tabs={[
              { id: 'orders', label: 'Orders', count: stats?.ordersTotal },
              { id: 'batches', label: 'Batches', count: stats?.batchesTotal },
              { id: 'board', label: 'Batch board', count: running || null },
              { id: 'schedules', label: 'Schedules', count: stats?.plannedSchedules },
            ]}
            active={tab}
            onChange={(id) => setTab(id as TabId)}
          />
        </div>

        {tab !== 'board' && (
          <FilterBar
            search={(
              <SearchInput
                value={searchInput}
                onChange={(v) => { setSearchInput(v); setPage(1); }}
                placeholder={tab === 'orders' ? 'Search order or SKU…' : tab === 'batches' ? 'Search batch number…' : 'Search…'}
                inputSize="sm"
              />
            )}
            filters={tab === 'orders' ? (
              <>
                <ErpSelect inputSize="sm" aria-label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All statuses</option>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
                </ErpSelect>
                <ErpSelect inputSize="sm" aria-label="Priority" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
                  <option value="">All priorities</option>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
                </ErpSelect>
                {overdueOnly && (
                  <Button size="sm" variant="secondary" aria-label="Remove overdue filter" onClick={() => { setOverdueOnly(false); setPage(1); }}>
                    Overdue only ✕
                  </Button>
                )}
              </>
            ) : tab === 'batches' ? (
              <ErpSelect inputSize="sm" aria-label="Status" value={batchStatusFilter} onChange={(e) => { setBatchStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                {BATCH_STATUSES.map((s) => <option key={s} value={s}>{humanStatus(s)}</option>)}
              </ErpSelect>
            ) : undefined}
            onClear={filtersActive ? clearFilters : undefined}
          />
        )}

        {tab === 'orders' && (
          <>
            <ErpDataTable className="min-w-[960px]">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>SKU</th>
                  <th className="w-44">Progress</th>
                  <th>Priority</th>
                  <th>Delivery</th>
                  <th className="erp-num">Std cost</th>
                  <th className="erp-num">Actual cost</th>
                  <th>Status</th>
                  <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? <TableSkeleton asRows rows={6} columns={9} /> : listQ.isError ? <QueryErrorRow colSpan={9} error={listQ.error} onRetry={() => listQ.refetch()} /> : (items as ProductionOrder[]).length === 0 ? (
                  <EmptyRow
                    colSpan={9}
                    title={filtersActive ? 'No orders match these filters' : 'No production orders yet'}
                    action={filtersActive
                      ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button>
                      : perms.canCreate ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreatingOrder(true)}>New production order</Button> : undefined}
                  >
                    {filtersActive ? undefined : 'Create an order for a SKU to plan materials and start batches.'}
                  </EmptyRow>
                ) : (items as ProductionOrder[]).map((o) => {
                  const pct = progressPct(o);
                  const overdue = isOverdue(o);
                  return (
                    <tr key={o._id} className={`erp-row-clickable${openOrder?._id === o._id ? ' erp-row-selected' : ''}`} onClick={() => setOpenOrder(o)}>
                      <td className="erp-cell-primary">
                        <span className="font-mono">{o.orderNumber}</span>
                        {o.suggestedPrId && <Badge tone="warning" className="ml-2">Shortage PR</Badge>}
                      </td>
                      <td className="max-w-[220px] truncate" title={typeof o.skuId === 'object' ? o.skuId?.name : undefined}>{skuLabel(o.skuId)}</td>
                      <td>
                        <div className="erp-tabular mb-1 text-[13px]">
                          {(o.passedQuantity || 0).toLocaleString()} / {o.plannedQuantity.toLocaleString()}
                          <span className="ml-1 text-erp-text-muted">({pct}%)</span>
                        </div>
                        <ProgressBar pct={pct} />
                      </td>
                      <td>
                        {['HIGH', 'URGENT'].includes(o.priority ?? '')
                          ? <Badge tone={o.priority === 'URGENT' ? 'danger' : 'warning'}>{priorityLabel(o.priority)}</Badge>
                          : <span className="text-erp-text-muted">{priorityLabel(o.priority)}</span>}
                      </td>
                      <td className={overdue ? 'font-medium text-[var(--erp-danger-text)]' : ''}>
                        {formatDate(o.deliveryDate)}{overdue && <span className="ml-1 text-xs">overdue</span>}
                      </td>
                      <td className="erp-num">{formatCost(o.standardMaterialCost)}</td>
                      <td className="erp-num">{formatCost(o.actualMaterialCost)}</td>
                      <td>
                        {o.status === 'APPROVAL_PENDING' && !perms.canApprove
                          ? <ApprovalsHint label="Pending approval" />
                          : <StatusBadge status={o.status} />}
                      </td>
                      <td className="erp-cell-actions">
                        <ActionCell
                          primary={orderPrimaryAction(o, orderHandlers)}
                          items={orderMenuItems(o, orderHandlers, { includeView: true })}
                          busy={actions.pendingId === o._id}
                          label={`Actions for ${o.orderNumber}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ErpDataTable>
            {meta && <TablePager page={page} totalPages={meta.totalPages} total={meta.total} pageSize={PAGE_SIZE} itemLabel="orders" onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />}
          </>
        )}

        {tab === 'batches' && (
          <>
            <ErpDataTable className="min-w-[860px]">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Order</th>
                  <th>Stage</th>
                  <th className="erp-num">Planned</th>
                  <th className="erp-num">Good</th>
                  <th className="erp-num">Issued cost</th>
                  <th>Status</th>
                  <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? <TableSkeleton asRows rows={6} columns={8} /> : listQ.isError ? <QueryErrorRow colSpan={8} error={listQ.error} onRetry={() => listQ.refetch()} /> : (items as ProductionBatch[]).length === 0 ? (
                  <EmptyRow
                    colSpan={8}
                    title={filtersActive ? 'No batches match these filters' : 'No batches yet'}
                    action={filtersActive ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button> : undefined}
                  >
                    {filtersActive ? undefined : 'Batches are created from approved orders.'}
                  </EmptyRow>
                ) : (items as ProductionBatch[]).map((b) => (
                  <tr key={b._id} className={`erp-row-clickable${openBatch?._id === b._id ? ' erp-row-selected' : ''}`} onClick={() => setOpenBatch(b)}>
                    <td className="erp-cell-primary font-mono">{b.batchNumber}</td>
                    <td className="font-mono text-erp-text-muted">{batchOrderLabel(b)}</td>
                    <td>
                      {b.status === 'COMPLETED' || b.status === 'CANCELLED' ? <span className="text-erp-text-muted">—</span> : stageLabel(b.currentStage)}
                      {stageNeedsQc(b) && ['IN_PROGRESS', 'REWORK'].includes(b.status) && <Badge tone="warning" className="ml-2">QC needed</Badge>}
                    </td>
                    <td className="erp-num">{b.plannedQuantity ?? '—'}</td>
                    <td className="erp-num">
                      {batchGoodQty(b)}
                      {(b.rejectedQuantity || 0) > 0 && <span className="ml-1 text-xs text-erp-text-muted" title="Rejected by in-process QC">(−{b.rejectedQuantity})</span>}
                    </td>
                    <td className="erp-num">{formatCost(b.actualMaterialCost)}</td>
                    <td>
                      <StatusBadge status={b.status} label={b.status === 'CANCELLED' && b.closedReason === 'ALL_PIECES_REJECTED' ? 'All rejected' : undefined} />
                    </td>
                    <td className="erp-cell-actions">
                      <ActionCell
                        primary={batchPrimaryAction(b, batchHandlers)}
                        items={batchMenuItems(b, batchHandlers, { includeView: true })}
                        busy={actions.pendingId === b._id}
                        label={`Actions for ${b.batchNumber}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
            {meta && <TablePager page={page} totalPages={meta.totalPages} total={meta.total} pageSize={PAGE_SIZE} itemLabel="batches" onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />}
          </>
        )}

        {tab === 'board' && (
          <div className="p-3">
            <BatchBoard board={boardQ.data} isLoading={boardQ.isLoading} handlers={batchHandlers} onOpen={setOpenBatch} />
          </div>
        )}

        {tab === 'schedules' && (
          <>
            <ErpDataTable className="min-w-[640px]">
              <thead>
                <tr><th>Order</th><th>Batch</th><th>Start</th><th>End</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading ? <TableSkeleton asRows rows={4} columns={5} /> : listQ.isError ? <QueryErrorRow colSpan={5} error={listQ.error} onRetry={() => listQ.refetch()} /> : (items as ProductionSchedule[]).length === 0 ? (
                  <EmptyRow
                    colSpan={5}
                    title="No schedule slots"
                    action={perms.canUpdate ? <Button size="sm" icon={<CalendarPlus size={14} />} onClick={() => setCreatingSchedule(true)}>New schedule slot</Button> : undefined}
                  >
                    Reserve line time for orders to plan capacity.
                  </EmptyRow>
                ) : (items as ProductionSchedule[]).map((s) => (
                  <tr key={s._id}>
                    <td className="erp-cell-primary font-mono">{orderLabel(s.productionOrderId)}</td>
                    <td className="font-mono">{s.batchId && typeof s.batchId !== 'string' ? s.batchId.batchNumber : '—'}</td>
                    <td>{formatDateTime(s.plannedStart)}</td>
                    <td>{formatDateTime(s.plannedEnd)}</td>
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
            {meta && <TablePager page={page} totalPages={meta.totalPages} total={meta.total} pageSize={PAGE_SIZE} itemLabel="slots" onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />}
          </>
        )}
      </Section>

      <OrderFormDrawer open={creatingOrder} onClose={() => setCreatingOrder(false)} onCreated={(o) => { setTab('orders'); setOpenOrder(o); }} />
      <ScheduleFormDrawer open={creatingSchedule} onClose={() => setCreatingSchedule(false)} />
      <CreateBatchModal order={batchFor} onClose={() => setBatchFor(null)} />
      <CompleteStageModal batch={completeBatch} onClose={() => setCompleteBatch(null)} fallbackStages={currentStages} />
      <AssignResourcesModal batch={assignBatch} onClose={() => setAssignBatch(null)} />
      <OrderDetailDrawer order={openOrder} onClose={() => setOpenOrder(null)} handlers={orderHandlers} onOpenBatch={(b) => { setOpenOrder(null); setOpenBatch(b); }} />
      <BatchDetailDrawer batch={openBatch} onClose={() => setOpenBatch(null)} handlers={batchHandlers} />
    </>
  );
}
