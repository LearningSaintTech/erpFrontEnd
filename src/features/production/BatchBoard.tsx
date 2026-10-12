import { useEffect, useRef, useState } from 'react';
import type { BatchBoard as BatchBoardData } from '../../types/api.extended';
import type { ProductionBatch, ProductionOrder } from '../../types/api';
import { Badge, Button, DropdownMenu, EmptyState, Skeleton, StatusBadge } from '../../components/erp';
import { batchGoodQty, finalQcDone, formatDate, stageLabel, stageNeedsQc } from './productionUtils';
import { batchMenuItems, batchPrimaryAction, type BatchHandlers } from './orderActions';
import { Layers } from 'lucide-react';

function BoardCard({ b, handlers, onOpen, moved }: { b: ProductionBatch; handlers: BatchHandlers; onOpen: (b: ProductionBatch) => void; moved: boolean }) {
  const order = typeof b.productionOrderId === 'object' ? (b.productionOrderId as ProductionOrder) : undefined;
  const primary = batchPrimaryAction(b, handlers);
  const Icon = primary?.icon;
  const needsQc = stageNeedsQc(b) && b.status !== 'CREATED';
  const due = order?.deliveryDate && new Date(order.deliveryDate) < new Date() && b.status !== 'COMPLETED';
  return (
    <li data-batch-id={b._id}>
      {/* The whole card opens details on click; keyboard/AT users get the batch-number button
          (a role="button" card would nest the action buttons inside another button). */}
      <div
        onClick={() => onOpen(b)}
        className={`cursor-pointer rounded-lg border bg-[var(--erp-surface)] p-3 shadow-erp-xs transition-colors hover:border-[var(--erp-border-strong)] ${moved ? 'border-[var(--erp-accent)] ring-2 ring-[var(--erp-accent)]/30' : 'border-[var(--erp-border)]'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen(b); }}
              className="block max-w-full truncate text-left font-mono text-sm font-semibold text-erp-text-primary hover:text-[var(--erp-accent)] focus-visible:underline focus-visible:outline-none"
            >
              {b.batchNumber}
            </button>
            <p className="truncate text-[13px] text-erp-text-muted">
              {order?.orderNumber ?? '—'}
              {order?.deliveryDate && <> · due {formatDate(order.deliveryDate)}</>}
            </p>
          </div>
          {/* Tablet-sized trigger: the board is used on the shop floor. */}
          <DropdownMenu items={batchMenuItems(b, handlers, { includeView: true })} label={`Actions for ${b.batchNumber}`} size="md" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="erp-tabular text-sm font-medium">{batchGoodQty(b)} pcs</span>
          {(b.rejectedQuantity || 0) > 0 && <span className="text-xs text-erp-text-muted">({b.rejectedQuantity} rejected)</span>}
          {b.status !== 'IN_PROGRESS' && <StatusBadge status={b.status} label={b.status === 'CREATED' ? 'Not started' : undefined} />}
          {['HIGH', 'URGENT'].includes(order?.priority ?? '') && <Badge tone={order?.priority === 'URGENT' ? 'danger' : 'warning'}>{order?.priority === 'URGENT' ? 'Urgent' : 'High'}</Badge>}
          {due && <Badge tone="danger">Overdue</Badge>}
          {needsQc && <Badge tone="warning">QC needed</Badge>}
          {b.status === 'COMPLETED' && finalQcDone(b) && <Badge tone="success">QC done</Badge>}
        </div>
        {primary && (
          <Button
            block
            variant={primary.variant ?? 'primary'}
            className="mt-3 !min-h-11"
            loading={handlers.actions.pendingId === b._id}
            disabled={primary.disabled}
            icon={Icon ? <Icon size={16} /> : undefined}
            onClick={(e) => { e.stopPropagation(); primary.onClick(); }}
          >
            {primary.label}
          </Button>
        )}
      </div>
    </li>
  );
}

/** Kanban of open batches by line stage. Columns scroll sideways on tablets. */
export function BatchBoard({ board, isLoading, handlers, onOpen }: {
  board?: BatchBoardData;
  isLoading: boolean;
  handlers: BatchHandlers;
  onOpen: (b: ProductionBatch) => void;
}) {
  // When a batch changes column (e.g. "Complete Cutting"), bring its new column into view and
  // highlight the card briefly — later stages are often scrolled off to the right.
  const scroller = useRef<HTMLDivElement>(null);
  const lastStage = useRef<Map<string, string> | null>(null);
  const [movedId, setMovedId] = useState<string | null>(null);
  useEffect(() => {
    if (!board) return;
    const now = new Map<string, string>();
    for (const [stage, list] of Object.entries(board)) for (const b of list ?? []) now.set(b._id, stage);
    const prev = lastStage.current;
    lastStage.current = now;
    if (!prev) return;
    const moved = [...now].find(([id, stage]) => prev.has(id) && prev.get(id) !== stage)?.[0];
    if (!moved) return;
    setMovedId(moved);
    requestAnimationFrame(() => {
      scroller.current?.querySelector(`[data-batch-id="${moved}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
    const t = window.setTimeout(() => setMovedId(null), 2500);
    return () => window.clearTimeout(t);
  }, [board]);

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-72 shrink-0 space-y-2 rounded-lg border border-[var(--erp-border)] p-3">
            <Skeleton width="40%" /><Skeleton height={72} /><Skeleton height={72} />
          </div>
        ))}
      </div>
    );
  }
  const columns = Object.entries(board ?? {});
  const total = columns.reduce((s, [, list]) => s + (list?.length ?? 0), 0);
  if (!columns.length || total === 0) {
    return (
      <div className="erp-card">
        <EmptyState icon={Layers} title="No batches on the line" description="Approved orders get batches from the Orders tab. Started batches appear here by stage." />
      </div>
    );
  }
  return (
    <div ref={scroller} className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3" role="list" aria-label="Batch board by stage">
      {columns.map(([stage, list]) => {
        const items = list ?? [];
        const empty = items.length === 0;
        return (
          <section
            key={stage}
            role="listitem"
            aria-label={`${stageLabel(stage)}: ${items.length} batches`}
            className={`flex shrink-0 flex-col rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] ${empty ? 'w-40' : 'w-72'}`}
          >
            <header className="flex items-center justify-between gap-2 border-b border-[var(--erp-border)] px-3 py-2.5">
              <h3 className="truncate text-sm font-semibold">{stage === 'COMPLETED' ? 'Awaiting final QC' : stageLabel(stage)}</h3>
              <span className="erp-tabular rounded-full bg-[var(--erp-surface)] px-2 text-xs font-medium text-erp-text-muted">{items.length}</span>
            </header>
            {empty ? (
              <p className="px-3 py-4 text-[13px] text-erp-text-muted">Empty</p>
            ) : (
              <ul className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
                {items.map((b) => <BoardCard key={b._id} b={b} handlers={handlers} onOpen={onOpen} moved={movedId === b._id} />)}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
