import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Calendar, ClipboardList, Factory, Layers, RefreshCw, Search, TrendingUp,
} from 'lucide-react';
import { productionApi } from '../../services/operations';
import { skuApi, inventoryApi } from '../../services/manufacturing';
import { machineApi, usersApi } from '../../services/admin';
import type { Material, ProductionBatch, ProductionOrder, ProductionSchedule } from '../../types/api';
import {
  ErpPageHeader, ErpStatusBadge, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpTabs,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { ApprovalsHint } from '../../components/ApprovalsHint';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { CommentPrompt } from '../approvals/components/CommentPrompt';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  batchOrderLabel, formatDate, formatDateTime, isOverdue, orderLabel, priorityLabel,
  progressPct, skuLabel, statusLabel, workflowHint, formatCost,
} from './productionUtils';

const PAGE_SIZE = 15;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const btnSm = '!px-2 !py-1 text-[10px]';

type TabId = 'orders' | 'batches' | 'board' | 'schedules';

export function ProductionPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('production.create');
  const canUpdate = permissions.includes('*') || permissions.includes('production.update');
  const canBatch = permissions.includes('*') || permissions.includes('batch.create');
  const canBatchUpdate = permissions.includes('*') || permissions.includes('batch.update');
  const canApprove = permissions.includes('*') || permissions.includes('production.approve');

  const [tab, setTab] = useState<TabId>('orders');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [orderForm, setOrderForm] = useState({ skuId: '', plannedQuantity: '10', priority: 'NORMAL', deliveryDate: '' });
  const [batchQty, setBatchQty] = useState('5');
  const [assignBatchId, setAssignBatchId] = useState<string | null>(null);
  const [assignMachineId, setAssignMachineId] = useState('');
  const [assignWorkerId, setAssignWorkerId] = useState('');
  const [scrapBatchId, setScrapBatchId] = useState<string | null>(null);
  const [scrapMaterialId, setScrapMaterialId] = useState('');
  const [scrapQty, setScrapQty] = useState('');
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; fn: () => void } | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    productionOrderId: '', plannedStart: '', plannedEnd: '', machineId: '', shiftId: '',
  });

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['production-stats'] });
    qc.invalidateQueries({ queryKey: ['production-list'] });
    qc.invalidateQueries({ queryKey: ['batch-board'] });
    qc.invalidateQueries({ queryKey: ['production-schedules'] });
    qc.invalidateQueries({ queryKey: ['batches'] });
    qc.invalidateQueries({ queryKey: ['production-orders'] });
    qc.invalidateQueries({ queryKey: ['qc-queue'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances'] });
    qc.invalidateQueries({ queryKey: ['inventory-stats'] });
    qc.invalidateQueries({ queryKey: ['warehouse-stats'] });
  };

  const { data: stats } = useQuery({ queryKey: ['production-stats'], queryFn: () => productionApi.stats() });

  const { data: skus = [] } = useQuery({
    queryKey: ['skus-prod'],
    queryFn: () => skuApi.listPage({ limit: 200 }).then((r) => r.items),
  });
  const { data: materials = [] } = useQuery({
    queryKey: ['materials-prod'],
    queryFn: () => inventoryApi.listMaterialsPage({ limit: 200 }).then((r) => r.items),
  });
  const { data: machines = [] } = useQuery({ queryKey: ['machines'], queryFn: () => machineApi.list() });
  const { data: shifts = [] } = useQuery({ queryKey: ['shifts'], queryFn: () => machineApi.listShifts() });
  const { data: users = [] } = useQuery({ queryKey: ['users-prod'], queryFn: () => usersApi.list() });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['production-list', tab, page, search, statusFilter, batchStatusFilter],
    queryFn: async () => {
      const params = { page, limit: PAGE_SIZE, search: search || undefined };
      if (tab === 'orders') {
        return productionApi.listOrdersPage({ ...params, status: statusFilter || undefined });
      }
      if (tab === 'batches') {
        return productionApi.listBatchesPage({ ...params, status: batchStatusFilter || undefined });
      }
      if (tab === 'schedules') {
        return productionApi.listSchedulesPage(params);
      }
      return { items: [], meta: undefined };
    },
    enabled: tab !== 'board',
  });

  const { data: board } = useQuery({
    queryKey: ['batch-board'],
    queryFn: () => productionApi.batchBoard(),
    enabled: tab === 'board',
  });

  const { data: scheduleOrders = [] } = useQuery({
    queryKey: ['production-orders-pick'],
    queryFn: () => productionApi.listOrdersPage({ limit: 100 }).then((r) => r.items),
    enabled: tab === 'schedules',
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  const workflow = useMutation({
    mutationFn: async (payload: {
      skuId?: string; orderId?: string; batchId?: string; step: string;
      comments?: string; scrapMaterialId?: string; scrapQuantity?: number; qty?: number;
    }) => {
      const { skuId, orderId, batchId, step, comments, scrapMaterialId, scrapQuantity, qty } = payload;
      switch (step) {
        case 'create':
          return productionApi.createOrder({
            skuId,
            plannedQuantity: Number(orderForm.plannedQuantity) || 10,
            priority: orderForm.priority,
            deliveryDate: orderForm.deliveryDate || undefined,
          });
        case 'mrp': return productionApi.runMrp(orderId!);
        case 'reserve': return productionApi.reserve(orderId!);
        case 'submit-approval': return productionApi.submitApproval(orderId!);
        case 'approve': return productionApi.approve(orderId!);
        case 'reject': return productionApi.reject(orderId!, comments);
        case 'cancel': return productionApi.cancel(orderId!);
        case 'batch': return productionApi.createBatch(orderId!, { plannedQuantity: qty ?? (Number(batchQty) || 5) });
        case 'start': return productionApi.startBatch(batchId!);
        case 'rollback': return productionApi.rollbackStage(batchId!);
        case 'assign':
          return productionApi.assignResources(batchId!, {
            machineId: assignMachineId || undefined,
            workerIds: assignWorkerId ? [assignWorkerId] : undefined,
          });
        case 'stage':
          return productionApi.completeStage(batchId!, {
            scrapMaterialId,
            scrapQuantity,
            scrapUnit: materials.find((m: Material) => m._id === scrapMaterialId)?.unit,
            wasteType: 'PRODUCTION_SCRAP',
          });
        default: throw new Error('Unknown step');
      }
    },
    onSuccess: (_, vars) => {
      setError('');
      setScrapBatchId(null);
      setScrapQty('');
      setScrapMaterialId('');
      setAssignBatchId(null);
      setRejectOrderId(null);
      if (vars.step === 'create') {
        setOrderForm((f) => ({ ...f, skuId: '' }));
        showSuccess('Production order created');
      } else {
        showSuccess('Updated successfully');
      }
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const createSchedule = useMutation({
    mutationFn: () => productionApi.createSchedule({
      productionOrderId: scheduleForm.productionOrderId,
      plannedStart: scheduleForm.plannedStart,
      plannedEnd: scheduleForm.plannedEnd,
      machineId: scheduleForm.machineId || undefined,
      shiftId: scheduleForm.shiftId || undefined,
      status: 'PLANNED',
    }),
    onSuccess: () => {
      setScheduleForm({ productionOrderId: '', plannedStart: '', plannedEnd: '', machineId: '', shiftId: '' });
      showSuccess('Schedule created');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const orderActions = (o: ProductionOrder) => (
    <div className="flex flex-wrap gap-1">
      {o.status === 'CREATED' && canUpdate && (
        <ErpButton className={btnSm} variant="secondary" onClick={() => workflow.mutate({ orderId: o._id, step: 'mrp' })}>MRP</ErpButton>
      )}
      {o.status === 'MRP_DONE' && canUpdate && (
        <>
          <ErpButton className={btnSm} variant="secondary" onClick={() => workflow.mutate({ orderId: o._id, step: 'reserve' })}>Reserve</ErpButton>
          <Link to="/purchase" className="text-[10px] text-[var(--erp-accent)]">Purchase</Link>
        </>
      )}
      {o.status === 'MATERIAL_RESERVED' && canUpdate && (
        <ErpButton className={btnSm} onClick={() => workflow.mutate({ orderId: o._id, step: 'submit-approval' })}>Submit</ErpButton>
      )}
      {o.status === 'APPROVAL_PENDING' && canApprove && (
        <>
          <ErpButton className={btnSm} onClick={() => workflow.mutate({ orderId: o._id, step: 'approve' })}>Approve</ErpButton>
          <ErpButton className={btnSm} variant="secondary" onClick={() => setRejectOrderId(o._id)}>Reject</ErpButton>
        </>
      )}
      {['APPROVED', 'IN_PROGRESS'].includes(o.status) && canBatch && (
        <ErpButton className={btnSm} variant="secondary" onClick={() => workflow.mutate({ orderId: o._id, step: 'batch', qty: Number(batchQty) || o.plannedQuantity })}>Batch</ErpButton>
      )}
      {!['COMPLETED', 'CANCELLED'].includes(o.status) && canUpdate && (
        <ErpButton className={btnSm} variant="secondary" onClick={() => setConfirmAction({
          label: `Cancel order ${o.orderNumber}?`,
          fn: () => workflow.mutate({ orderId: o._id, step: 'cancel' }),
        })}
        >Cancel</ErpButton>
      )}
    </div>
  );

  const batchActions = (b: ProductionBatch) => (
    <div className="flex flex-wrap gap-1">
      {b.status === 'CREATED' && canBatchUpdate && (
        <>
          <ErpButton className={btnSm} variant="secondary" onClick={() => workflow.mutate({ batchId: b._id, step: 'start' })}>Start</ErpButton>
          <ErpButton className={btnSm} variant="secondary" onClick={() => setAssignBatchId(assignBatchId === b._id ? null : b._id)}>Assign</ErpButton>
        </>
      )}
      {['IN_PROGRESS', 'REWORK'].includes(b.status) && b.currentStage !== 'COMPLETED' && canBatchUpdate && (
        <>
          {scrapBatchId === b._id ? (
            <div className="flex flex-wrap items-center gap-1">
              <ErpSelect value={scrapMaterialId} onChange={(e) => setScrapMaterialId(e.target.value)} className="w-28 text-xs">
                <option value="">No scrap</option>
                {materials.map((m: Material) => <option key={m._id} value={m._id}>{m.materialCode}</option>)}
              </ErpSelect>
              <ErpInput type="number" placeholder="Qty" value={scrapQty} onChange={(e) => setScrapQty(e.target.value)} className="w-16" />
              <ErpButton className={btnSm} onClick={() => workflow.mutate({
                batchId: b._id, step: 'stage',
                scrapMaterialId: scrapMaterialId || undefined,
                scrapQuantity: scrapQty ? Number(scrapQty) : undefined,
              })}
              >Done</ErpButton>
              <ErpButton className={btnSm} variant="secondary" onClick={() => setScrapBatchId(null)}>×</ErpButton>
            </div>
          ) : (
            <>
              <ErpButton className={btnSm} onClick={() => setScrapBatchId(b._id)}>Complete {b.currentStage}</ErpButton>
              <ErpButton className={btnSm} variant="secondary" onClick={() => setConfirmAction({
                label: `Rollback ${b.batchNumber} from ${b.currentStage}?`,
                fn: () => workflow.mutate({ batchId: b._id, step: 'rollback' }),
              })}
              >Rollback</ErpButton>
            </>
          )}
        </>
      )}
      {b.status === 'COMPLETED' && (
        <Link to="/quality" className="text-[10px] text-erp-accent hover:underline">QC →</Link>
      )}
    </div>
  );

  return (
    <div>
      <AlertBanner message={error} onDismiss={() => setError('')} />
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess('')} />}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.label ?? 'Confirm'}
        message="Continue with this action?"
        confirmLabel="Yes"
        loading={workflow.isPending}
        onConfirm={() => { confirmAction?.fn(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
      <CommentPrompt
        open={!!rejectOrderId}
        title="Reject production order"
        message="Reason for rejection (min 3 characters)"
        required
        minLength={3}
        confirmLabel="Reject"
        loading={workflow.isPending}
        onConfirm={(comments) => {
          if (rejectOrderId) workflow.mutate({ orderId: rejectOrderId, step: 'reject', comments });
        }}
        onCancel={() => setRejectOrderId(null)}
      />

      <ErpPageHeader
        title="Production"
        subtitle={(
          <>
            MRP creates PRs for shortages → purchase/GRN/QC → reserve → issue → batches → final QC → FG dispatch.
            <Link to="/purchase" className="ml-2 text-[var(--erp-accent)]">Purchase →</Link>
            <Link to="/warehouse/operations/put-away" className="ml-2 text-[var(--erp-accent)]">Put away →</Link>
          </>
        )}
        actions={(
          <div className="flex gap-2">
            <Link to="/production/machines">
              <ErpButton variant="secondary" className={btnSm}>Machines →</ErpButton>
            </Link>
            <ErpButton variant="secondary" className={btnSm} onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 inline h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </ErpButton>
          </div>
        )}
      />

      {stats && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ErpCard className="p-3">
            <div className="flex items-center gap-2 text-erp-text-muted">
              <ClipboardList className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wide">Active orders</span>
            </div>
            <p className="mt-1 text-xl font-semibold">{(stats.ordersApproved ?? 0) + (stats.ordersInProgress ?? 0)}</p>
          </ErpCard>
          <ErpCard className="p-3">
            <div className="flex items-center gap-2 text-erp-text-muted">
              <Layers className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wide">Batches running</span>
            </div>
            <p className="mt-1 text-xl font-semibold">{stats.batchesInProgress}</p>
          </ErpCard>
          <ErpCard className="p-3">
            <div className="flex items-center gap-2 text-erp-text-muted">
              <Factory className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wide">Pending approval</span>
            </div>
            <p className="mt-1 text-xl font-semibold">{stats.ordersApprovalPending}</p>
          </ErpCard>
          <ErpCard className="p-3">
            <div className="flex items-center gap-2 text-erp-text-muted">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] uppercase tracking-wide">Overdue</span>
            </div>
            <p className="mt-1 text-xl font-semibold text-amber-600">{stats.overdueOrders}</p>
          </ErpCard>
          <ErpCard className="p-3">
            <div className="flex items-center gap-2 text-erp-text-muted">
              <TrendingUp className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wide">Fulfillment</span>
            </div>
            <p className="mt-1 text-xl font-semibold">{stats.fulfillmentPct}%</p>
          </ErpCard>
        </div>
      )}

      <div className="mb-4">
        <ErpTabs
          tabs={[
            { id: 'orders', label: `Orders${stats ? ` (${stats.ordersTotal})` : ''}` },
            { id: 'batches', label: `Batches${stats ? ` (${stats.batchesTotal})` : ''}` },
            { id: 'board', label: 'Board' },
            { id: 'schedules', label: `Schedules${stats ? ` (${stats.plannedSchedules})` : ''}` },
          ]}
          active={tab}
          onChange={(id) => { setTab(id as TabId); setPage(1); }}
        />
      </div>

      {tab === 'orders' && canCreate && (
        <ErpCard className="mb-4 p-4">
          <h3 className="mb-3 text-sm font-medium">New production order</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <label className={fieldLabel}>SKU</label>
              <ErpSelect value={orderForm.skuId} onChange={(e) => setOrderForm({ ...orderForm, skuId: e.target.value })}>
                <option value="">Select SKU…</option>
                {skus.map((s) => <option key={s._id} value={s._id}>{s.skuCode}</option>)}
              </ErpSelect>
            </div>
            <div>
              <label className={fieldLabel}>Qty</label>
              <ErpInput type="number" min={1} value={orderForm.plannedQuantity} onChange={(e) => setOrderForm({ ...orderForm, plannedQuantity: e.target.value })} className="w-20" />
            </div>
            <div>
              <label className={fieldLabel}>Priority</label>
              <ErpSelect value={orderForm.priority} onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value })} className="w-28">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </ErpSelect>
            </div>
            <div>
              <label className={fieldLabel}>Delivery</label>
              <ErpInput type="date" value={orderForm.deliveryDate} onChange={(e) => setOrderForm({ ...orderForm, deliveryDate: e.target.value })} />
            </div>
            <ErpButton
              disabled={!orderForm.skuId || workflow.isPending}
              onClick={() => workflow.mutate({ skuId: orderForm.skuId, step: 'create' })}
            >
              Create order
            </ErpButton>
          </div>
          <p className="mt-2 text-[10px] text-erp-text-muted">
            Flow: MRP (auto-creates purchase PRs for shortages) → receive via GRN/QC → reserve → approval → batches.
          </p>
        </ErpCard>
      )}

      {tab !== 'board' && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-erp-text-muted" />
            <ErpInput
              className="pl-8"
              placeholder="Search…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
            />
          </div>
          <ErpButton variant="secondary" onClick={() => { setSearch(searchInput); setPage(1); }}>Search</ErpButton>
          {tab === 'orders' && (
            <ErpSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-40">
              <option value="">All statuses</option>
              {['CREATED', 'MRP_DONE', 'MATERIAL_RESERVED', 'APPROVAL_PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </ErpSelect>
          )}
          {tab === 'batches' && (
            <>
              <ErpSelect value={batchStatusFilter} onChange={(e) => { setBatchStatusFilter(e.target.value); setPage(1); }} className="w-36">
                <option value="">All statuses</option>
                {['CREATED', 'IN_PROGRESS', 'REWORK', 'COMPLETED'].map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </ErpSelect>
              <label className="text-[10px] text-erp-text-muted">
                Batch qty
                <ErpInput type="number" min={1} value={batchQty} onChange={(e) => setBatchQty(e.target.value)} className="ml-1 w-14 inline-block" />
              </label>
            </>
          )}
        </div>
      )}

      {tab === 'orders' && (
        <ErpCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[900px] text-[11px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-left">Delivery</th>
                  <th className="px-3 py-2 text-left">Std / Actual</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="px-3 py-6 text-center text-erp-text-muted">Loading…</td></tr>}
                {!isLoading && (items as ProductionOrder[]).map((o) => (
                  <tr key={o._id} className="border-t border-[var(--erp-border)]">
                    <td className="px-3 py-2">
                      <span className="font-mono">{o.orderNumber}</span>
                      {isOverdue(o) && <span className="ml-1 text-[10px] text-amber-600">overdue</span>}
                      <p className="text-[10px] text-erp-text-muted">{workflowHint(o.status)}</p>
                    </td>
                    <td className="px-3 py-2">{skuLabel(o.skuId)}</td>
                    <td className="px-3 py-2">{o.producedQuantity || 0} / {o.plannedQuantity} ({progressPct(o)}%)</td>
                    <td className="px-3 py-2">{priorityLabel(o.priority)}</td>
                    <td className="px-3 py-2">{formatDate(o.deliveryDate)}</td>
                    <td className="px-3 py-2">
                      <p className="text-[10px] text-erp-text-muted">Std {formatCost(o.standardMaterialCost)}</p>
                      <p className="text-[11px]">Act {formatCost(o.actualMaterialCost)}</p>
                    </td>
                    <td className="px-3 py-2">
                      {o.status === 'APPROVAL_PENDING' && !canApprove
                        ? <ApprovalsHint label="Pending approval" />
                        : <ErpStatusBadge status={o.status} label={statusLabel(o.status)} />}
                    </td>
                    <td className="px-3 py-2 text-right">{orderActions(o)}</td>
                  </tr>
                ))}
                {!isLoading && items.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-erp-text-muted">No production orders</td></tr>
                )}
              </tbody>
            </ErpDataTable>
          </div>
          {meta && meta.totalPages > 0 && (
            <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-erp-text-muted">
              <span>{meta.page}/{meta.totalPages} · {meta.total}</span>
              <div className="flex gap-1">
                <ErpButton className={btnSm} variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</ErpButton>
                <ErpButton className={btnSm} variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
              </div>
            </div>
          )}
        </ErpCard>
      )}

      {tab === 'batches' && (
        <ErpCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[800px] text-[11px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Batch</th>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Stage</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">Issued cost</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={7} className="px-3 py-6 text-center">Loading…</td></tr>}
                {!isLoading && (items as ProductionBatch[]).map((b) => (
                  <tr key={b._id} className="border-t border-[var(--erp-border)]">
                    <td className="px-3 py-2 font-mono">{b.batchNumber}</td>
                    <td className="px-3 py-2">{batchOrderLabel(b)}</td>
                    <td className="px-3 py-2">{b.currentStage}</td>
                    <td className="px-3 py-2">{b.plannedQuantity ?? '—'}</td>
                    <td className="px-3 py-2">{formatCost(b.actualMaterialCost)}</td>
                    <td className="px-3 py-2"><ErpStatusBadge status={b.status} label={statusLabel(b.status)} /></td>
                    <td className="px-3 py-2 text-right">
                      {batchActions(b)}
                      {assignBatchId === b._id && (
                        <div className="mt-2 flex flex-wrap justify-end gap-1 border-t pt-2">
                          <ErpSelect value={assignMachineId} onChange={(e) => setAssignMachineId(e.target.value)} className="w-28 text-[10px]">
                            <option value="">Machine</option>
                            {machines.map((m) => <option key={m._id} value={m._id}>{m.machineCode}</option>)}
                          </ErpSelect>
                          <ErpSelect value={assignWorkerId} onChange={(e) => setAssignWorkerId(e.target.value)} className="w-28 text-[10px]">
                            <option value="">Worker</option>
                            {users.map((u) => <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>)}
                          </ErpSelect>
                          <ErpButton className={btnSm} onClick={() => workflow.mutate({ batchId: b._id, step: 'assign' })}>Save</ErpButton>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!isLoading && items.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-erp-text-muted">No batches</td></tr>
                )}
              </tbody>
            </ErpDataTable>
          </div>
          {meta && meta.totalPages > 0 && (
            <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-erp-text-muted">
              <span>{meta.page}/{meta.totalPages}</span>
              <div className="flex gap-1">
                <ErpButton className={btnSm} variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</ErpButton>
                <ErpButton className={btnSm} variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
              </div>
            </div>
          )}
        </ErpCard>
      )}

      {tab === 'board' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {board && Object.entries(board).map(([stage, stageBatches]) => (
            <ErpCard key={stage} className="p-3">
              <h3 className="mb-2 text-sm font-medium">{stage}</h3>
              <ul className="space-y-2">
                {(stageBatches || []).map((b: import('../../types/api').ProductionBatch) => (
                  <li key={b._id} className="rounded border border-erp-border px-2 py-1.5 text-xs">
                    <span className="font-mono">{b.batchNumber}</span>
                    <span className="ml-2 text-erp-text-muted">{batchOrderLabel(b)}</span>
                    <div className="mt-0.5"><ErpStatusBadge status={b.status} /></div>
                  </li>
                ))}
                {(!stageBatches || stageBatches.length === 0) && (
                  <li className="text-[10px] text-erp-text-muted">No batches</li>
                )}
              </ul>
            </ErpCard>
          ))}
          {!board && <p className="text-erp-text-muted">Loading board…</p>}
        </div>
      )}

      {tab === 'schedules' && (
        <>
          {canUpdate && (
            <ErpCard className="mb-4 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4" /> New schedule slot
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[160px]">
                  <label className={fieldLabel}>Order</label>
                  <ErpSelect value={scheduleForm.productionOrderId} onChange={(e) => setScheduleForm({ ...scheduleForm, productionOrderId: e.target.value })}>
                    <option value="">Select order…</option>
                    {scheduleOrders.map((o: ProductionOrder) => (
                      <option key={o._id} value={o._id}>{o.orderNumber} · {skuLabel(o.skuId)}</option>
                    ))}
                  </ErpSelect>
                </div>
                <div>
                  <label className={fieldLabel}>Start</label>
                  <ErpInput type="datetime-local" value={scheduleForm.plannedStart} onChange={(e) => setScheduleForm({ ...scheduleForm, plannedStart: e.target.value })} />
                </div>
                <div>
                  <label className={fieldLabel}>End</label>
                  <ErpInput type="datetime-local" value={scheduleForm.plannedEnd} onChange={(e) => setScheduleForm({ ...scheduleForm, plannedEnd: e.target.value })} />
                </div>
                <div>
                  <label className={fieldLabel}>Machine</label>
                  <ErpSelect value={scheduleForm.machineId} onChange={(e) => setScheduleForm({ ...scheduleForm, machineId: e.target.value })} className="w-32">
                    <option value="">Optional</option>
                    {machines.map((m) => <option key={m._id} value={m._id}>{m.machineCode}</option>)}
                  </ErpSelect>
                </div>
                <ErpButton
                  disabled={!scheduleForm.productionOrderId || !scheduleForm.plannedStart || !scheduleForm.plannedEnd || createSchedule.isPending}
                  onClick={() => createSchedule.mutate()}
                >
                  Add schedule
                </ErpButton>
              </div>
            </ErpCard>
          )}
          <ErpCard className="overflow-hidden p-0">
            <ErpDataTable className="w-full text-[11px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Batch</th>
                  <th className="px-3 py-2 text-left">Start</th>
                  <th className="px-3 py-2 text-left">End</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={5} className="px-3 py-6 text-center">Loading…</td></tr>}
                {!isLoading && (items as ProductionSchedule[]).map((s) => (
                  <tr key={s._id} className="border-t border-[var(--erp-border)]">
                    <td className="px-3 py-2 font-mono">{orderLabel(s.productionOrderId)}</td>
                    <td className="px-3 py-2">
                      {s.batchId && typeof s.batchId !== 'string' ? s.batchId.batchNumber : '—'}
                    </td>
                    <td className="px-3 py-2">{formatDateTime(s.plannedStart)}</td>
                    <td className="px-3 py-2">{formatDateTime(s.plannedEnd)}</td>
                    <td className="px-3 py-2"><ErpStatusBadge status={s.status} /></td>
                  </tr>
                ))}
                {!isLoading && items.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-erp-text-muted">No schedules</td></tr>
                )}
              </tbody>
            </ErpDataTable>
            {meta && meta.totalPages > 0 && (
              <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-erp-text-muted">
                <span>{meta.page}/{meta.totalPages}</span>
                <div className="flex gap-1">
                  <ErpButton className={btnSm} variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</ErpButton>
                  <ErpButton className={btnSm} variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
                </div>
              </div>
            )}
          </ErpCard>
        </>
      )}
    </div>
  );
}
