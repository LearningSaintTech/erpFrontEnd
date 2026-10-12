import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { productionApi } from '../../services/operations';
import type { ProductionBatch, ProductionOrder } from '../../types/api';
import {
  Badge, Button, DescriptionList, Drawer, DropdownMenu, EmptyState, ErpDataTable, InfoBanner, Section, Skeleton,
  StatusBadge, StepFlow, type Step,
} from '../../components/erp';
import {
  ORDER_FLOW, batchGoodQty, batchStages, finalQcDone, formatCost, formatDate, formatDateTime, isOverdue,
  personName, priorityLabel, progressPct, refName, remainingToBatch, skuLabel, stageLabel, stageNeedsQc,
  workflowHint, type OrderMrp,
} from './productionUtils';
import {
  batchMenuItems, batchPrimaryAction, orderMenuItems, orderPrimaryAction, type BatchHandlers, type OrderHandlers,
  type PrimaryAction,
} from './orderActions';

function PrimaryButton({ action, busy, large }: { action: PrimaryAction | null; busy?: boolean; large?: boolean }) {
  if (!action) return null;
  const Icon = action.icon;
  return (
    <Button
      variant={action.variant ?? 'primary'}
      loading={busy}
      disabled={action.disabled}
      icon={Icon ? <Icon size={16} /> : undefined}
      className={large ? '!min-h-11 w-full sm:w-auto' : ''}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

export function ProgressBar({ pct, className = '' }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-[var(--erp-border)] ${className}`} aria-hidden="true">
      <div className="h-full rounded-full bg-[var(--erp-accent)]" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ─────────────────────────────── Order detail ─────────────────────────────── */

export function OrderDetailDrawer({ order: row, onClose, handlers, onOpenBatch }: {
  order: ProductionOrder | null;
  onClose: () => void;
  handlers: OrderHandlers;
  onOpenBatch: (b: ProductionBatch) => void;
}) {
  const id = row?._id;
  const detailQ = useQuery({ queryKey: ['production-order', id], queryFn: () => productionApi.getOrder(id!), enabled: !!id, refetchInterval: 15_000 });
  const batchesQ = useQuery({
    queryKey: ['order-batches', id],
    queryFn: () => productionApi.listBatchesPage({ productionOrderId: id, limit: 50 }).then((r) => r.items),
    enabled: !!id,
  });
  if (!row) return null;
  // List rows carry remainingToBatch / runningBatches; the detail call carries populated refs.
  const batches = batchesQ.data ?? [];
  // Mirror the API's batchable-quantity rule from this order's own batches so the drawer stays current.
  const live = batchesQ.data ? batches.filter((b) => b.status !== 'CANCELLED') : null;
  const merged: ProductionOrder = { ...row, ...(detailQ.data ?? {}) };
  const o: ProductionOrder = {
    ...merged,
    remainingToBatch: live
      ? Math.max(0, merged.plannedQuantity - live.reduce((s, b) => s + (b.plannedQuantity || 0) - (b.rejectedQuantity || 0) - (b.finalRejectedQuantity || 0), 0))
      : row.remainingToBatch,
    runningBatches: live ? live.filter((b) => ['IN_PROGRESS', 'REWORK'].includes(b.status)).length : row.runningBatches,
  };
  const mrp = o.mrpId && typeof o.mrpId === 'object' ? (o.mrpId as OrderMrp) : null;
  const primary = orderPrimaryAction(o, handlers);
  const pct = progressPct(o);
  const cancelled = o.status === 'CANCELLED';

  const flowSteps: Step[] = ORDER_FLOW.map((s) => ({
    id: s.id,
    label: s.label,
    description: s.id === 'APPROVED' && o.approvedAt ? formatDate(o.approvedAt) : undefined,
  }));

  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={o.orderNumber}
      description={`${skuLabel(o.skuId)} · ${o.plannedQuantity.toLocaleString()} pcs`}
      headerExtra={(
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={o.status} />
          {['HIGH', 'URGENT'].includes(o.priority ?? '') && <Badge tone={o.priority === 'URGENT' ? 'danger' : 'warning'}>{priorityLabel(o.priority)} priority</Badge>}
          {isOverdue(o) && <Badge tone="danger">Overdue</Badge>}
        </div>
      )}
      footer={(
        <>
          <DropdownMenu items={orderMenuItems(o, handlers)} label="More order actions" size="md" />
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <PrimaryButton action={primary} busy={handlers.actions.pendingId === o._id} />
        </>
      )}
    >
      <div className="space-y-5">
        {cancelled ? (
          <InfoBanner inset={false} tone="danger" title="Order cancelled">
            {o.rejectionComments ? `Reason: ${o.rejectionComments}` : 'No further work can be done on this order.'}
          </InfoBanner>
        ) : (
          <>
            <StepFlow steps={flowSteps} current={o.status} size="sm" />
            {o.rejectionComments && o.status === 'CREATED' && (
              <InfoBanner inset={false} tone="warn" title="Returned by approver">{o.rejectionComments}</InfoBanner>
            )}
            {o.status !== 'COMPLETED' && (
              <InfoBanner inset={false} tone="info">
                <span><strong>Next step:</strong> {workflowHint(o.status)}.</span>
              </InfoBanner>
            )}
          </>
        )}

        <div>
          <div className="mb-1 flex items-baseline justify-between text-[13px]">
            <span className="text-erp-text-muted">Passed final QC</span>
            <span className="erp-tabular font-medium">{(o.passedQuantity || 0).toLocaleString()} / {o.plannedQuantity.toLocaleString()} ({pct}%)</span>
          </div>
          <ProgressBar pct={pct} />
        </div>

        <DescriptionList
          columns={3}
          items={[
            { label: 'Produced', value: (o.producedQuantity || 0).toLocaleString() },
            { label: 'Rejected', value: (o.rejectedQuantity || 0).toLocaleString() },
            { label: 'Left to batch', value: remainingToBatch(o).toLocaleString(), hidden: cancelled },
            { label: 'Delivery', value: formatDate(o.deliveryDate) },
            { label: 'Priority', value: priorityLabel(o.priority) },
            { label: 'BOM', value: refName(o.bomId, 'bomCode') || '—' },
            { label: 'Standard material cost', value: formatCost(o.standardMaterialCost) },
            { label: 'Actual material cost', value: formatCost(o.actualMaterialCost) },
            { label: 'Design', value: refName(o.designId, 'designCode', 'title') || '—' },
          ]}
        />

        <Section title={`Batches (${batches.length})`} flush>
          {batchesQ.isLoading ? (
            <div className="p-4"><Skeleton width="60%" /></div>
          ) : batches.length === 0 ? (
            <EmptyState compact title="No batches yet" description={['APPROVED', 'IN_PROGRESS'].includes(o.status) ? 'Create a batch to start work on the line.' : 'Batches can be created once the order is approved.'} />
          ) : (
            <ErpDataTable>
              <thead><tr><th>Batch</th><th>Stage</th><th className="erp-num">Qty</th><th>Status</th></tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b._id} className="erp-row-clickable" onClick={() => onOpenBatch(b)}>
                    <td className="erp-cell-primary font-mono">{b.batchNumber}</td>
                    <td>{stageLabel(b.currentStage)}</td>
                    <td className="erp-num">{b.plannedQuantity ?? '—'}</td>
                    <td><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          )}
        </Section>

        <Section
          title="Materials"
          description={mrp ? (mrp.hasShortage ? 'Some materials are short — purchase requisitions were raised.' : 'All materials are available.') : undefined}
          flush
        >
          {mrp?.lines?.length ? (
            <ErpDataTable>
              <thead>
                <tr><th>Material</th><th className="erp-num">Required</th><th className="erp-num">Available</th><th className="erp-num">Short</th><th className="erp-num">On order</th></tr>
              </thead>
              <tbody>
                {mrp.lines.map((l, i) => {
                  const short = l.shortageQty || 0;
                  return (
                    <tr key={i}>
                      <td>
                        <span className="font-mono">{refName(l.materialId, 'materialCode') || (typeof l.materialId === 'string' ? l.materialId.slice(-6) : '—')}</span>
                        {refName(l.materialId, 'name') && <span className="ml-1 text-erp-text-muted">{refName(l.materialId, 'name')}</span>}
                      </td>
                      <td className="erp-num">{(l.requiredQty ?? 0).toLocaleString()} {l.unit}</td>
                      <td className="erp-num">{(l.availableQty ?? 0).toLocaleString()}</td>
                      <td className={`erp-num ${short > 0 ? 'font-medium text-[var(--erp-danger-text)]' : ''}`}>{short > 0 ? short.toLocaleString() : '—'}</td>
                      <td className="erp-num">{l.onOrderQty ? l.onOrderQty.toLocaleString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </ErpDataTable>
          ) : (
            <EmptyState
              compact
              title={o.status === 'CREATED' ? 'Materials not planned yet' : 'Material plan not available'}
              description={o.status === 'CREATED' ? 'Run MRP to check stock and raise purchase requests for shortages.' : undefined}
            />
          )}
        </Section>
      </div>
    </Drawer>
  );
}

/* ─────────────────────────────── Batch detail ─────────────────────────────── */

export function BatchDetailDrawer({ batch: row, onClose, handlers }: {
  batch: ProductionBatch | null;
  onClose: () => void;
  handlers: BatchHandlers;
}) {
  const id = row?._id;
  const detailQ = useQuery({ queryKey: ['production-batch', id], queryFn: () => productionApi.getBatch(id!), enabled: !!id, refetchInterval: 15_000 });
  if (!row) return null;
  // The detail endpoint embeds material refs and QC results — planners/operators have no
  // inventory or quality read rights, so separate lookups would 403 and show nothing.
  const b: ProductionBatch = { ...row, ...(detailQ.data ?? {}) };
  const stages = batchStages(b, handlers.fallbackStages);
  const history = b.stageHistory ?? [];
  const primary = batchPrimaryAction(b, handlers);
  const needsQc = stageNeedsQc(b) && b.status !== 'CREATED';
  const order = typeof b.productionOrderId === 'object' ? b.productionOrderId : undefined;
  const inspections = detailQ.data?.inspections ?? [];

  const current = b.status === 'COMPLETED' ? 'COMPLETED' : b.currentStage;
  const steps: Step[] = stages.map((s) => {
    const h = [...history].reverse().find((x) => x.stage === s);
    const qcOk = b.stageQcPassed?.[s];
    let description: string | undefined;
    if (h?.completedAt) description = `Done ${formatDateTime(h.completedAt)}`;
    else if (h?.startedAt && s === b.currentStage) description = `Started ${formatDateTime(h.startedAt)}`;
    if (qcOk) description = description ? `${description} · QC passed` : 'QC passed';
    return {
      id: s,
      label: stageLabel(s),
      description,
      state: b.status === 'COMPLETED' ? 'done' : b.status === 'CANCELLED' && s === b.currentStage ? 'blocked' : undefined,
    };
  });

  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={b.batchNumber}
      description={`${order?.orderNumber ? `Order ${order.orderNumber}` : ''}${order?.skuId && typeof order.skuId === 'object' ? ` · ${skuLabel(order.skuId)}` : ''}`}
      headerExtra={(
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={b.status} />
          {b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && <Badge tone="info" dot={false}>At {stageLabel(b.currentStage)}</Badge>}
          {needsQc && <Badge tone="warning">QC needed</Badge>}
        </div>
      )}
      footer={(
        <>
          <DropdownMenu items={batchMenuItems(b, handlers)} label="More batch actions" size="md" />
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>
      )}
    >
      <div className="space-y-5">
        {b.status === 'CANCELLED' && b.closedReason === 'ALL_PIECES_REJECTED' && (
          <InfoBanner inset={false} tone="danger">All pieces were rejected by in-process QC, so the batch was closed.</InfoBanner>
        )}
        {needsQc && (
          <InfoBanner inset={false} tone="warn" icon={<AlertTriangle size={16} className="mt-0.5 shrink-0" />}>
            {stageLabel(b.currentStage)} needs a passed in-process inspection before it can be completed.
          </InfoBanner>
        )}
        {primary && (
          <div className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] p-3">
            <p className="mb-2 text-[13px] text-erp-text-muted">Next on the line</p>
            <PrimaryButton action={primary} busy={handlers.actions.pendingId === b._id} large />
          </div>
        )}
        {b.status === 'COMPLETED' && finalQcDone(b) && (
          <InfoBanner inset={false} tone="success" icon={<CheckCircle2 size={16} className="mt-0.5 shrink-0" />}>
            Final QC: {b.passedQuantity || 0} passed, {b.finalRejectedQuantity || 0} rejected.
          </InfoBanner>
        )}

        <div className="grid gap-5 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <div>
            <h4 className="mb-3 text-sm font-semibold">Stages</h4>
            <StepFlow steps={steps} current={current} orientation="vertical" size="sm" />
          </div>
          <div className="space-y-5">
            <DescriptionList
              columns={2}
              items={[
                { label: 'Planned', value: `${b.plannedQuantity ?? 0} pcs` },
                { label: 'Good pieces', value: `${batchGoodQty(b)} pcs` },
                { label: 'Rejected in process', value: b.rejectedQuantity || 0 },
                { label: 'Final QC passed', value: finalQcDone(b) ? b.passedQuantity || 0 : '—' },
                { label: 'Machine', value: refName(b.machineId, 'machineCode', 'name') || 'Not assigned' },
                { label: 'Shift', value: refName(b.shiftId, 'name') || '—' },
                { label: 'Workers', value: b.workerIds?.length ? b.workerIds.map(personName).join(', ') : 'Not assigned', full: true },
                { label: 'Issued material cost', value: formatCost(b.actualMaterialCost) },
                { label: 'Created', value: formatDate(b.createdAt) },
              ]}
            />

            <Section title="QC results" flush>
              {inspections.length === 0 ? (
                <EmptyState compact title="No inspections yet" />
              ) : (
                <ErpDataTable>
                  <thead><tr><th>Inspection</th><th>Stage</th><th>Result</th><th className="erp-num">Pass / fail</th></tr></thead>
                  <tbody>
                    {inspections.map((i) => (
                      <tr key={i._id}>
                        <td className="font-mono">{i.inspectionNumber}</td>
                        <td>{i.inspectionType === 'FINAL' ? 'Final' : stageLabel(i.stageAtInspection)}</td>
                        <td>{i.result ? <StatusBadge status={i.result} /> : <StatusBadge status={i.status} />}</td>
                        <td className="erp-num">{i.passedQuantity ?? '—'} / {i.failedQuantity ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </ErpDataTable>
              )}
            </Section>

            {!!b.issuedMaterials?.length && (
              <Section title="Issued materials" flush>
                <ErpDataTable>
                  <thead><tr><th>Material</th><th className="erp-num">Qty</th><th className="erp-num">Cost</th></tr></thead>
                  <tbody>
                    {b.issuedMaterials.map((m, i) => {
                      const mat = typeof m.materialId === 'object' ? m.materialId : undefined;
                      return (
                        <tr key={i}>
                          <td>{mat ? <><span className="font-mono">{mat.materialCode}</span> <span className="text-erp-text-muted">{mat.name}</span></> : String(m.materialId ?? '').slice(-6)}</td>
                          <td className="erp-num">{(m.quantity ?? 0).toLocaleString()} {m.unit}</td>
                          <td className="erp-num">{formatCost(m.extendedCost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </ErpDataTable>
              </Section>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
