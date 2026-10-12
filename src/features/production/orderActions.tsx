import type { NavigateFunction } from 'react-router-dom';
import {
  Ban, Calculator, CheckCircle2, Eye, Hourglass, Layers, PackageCheck, Play, RotateCcw, Send, ShoppingCart, Undo2, Users, XCircle,
} from 'lucide-react';
import type { ProductionBatch, ProductionOrder } from '../../types/api';
import { Button, RowActionsMenu, type DropdownMenuItem } from '../../components/erp';
import { finalQcDone, isBatchRunning, isFirstStage, remainingToBatch, stageLabel, stageNeedsQc } from './productionUtils';
import type { ProductionActions, useProductionPerms } from './useProductionActions';

type Perms = ReturnType<typeof useProductionPerms>;

export interface PrimaryAction {
  label: string;
  icon?: typeof Play;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  /** Shown as a non-clickable status (e.g. waiting on another role). */
  disabled?: boolean;
}

export interface OrderHandlers {
  actions: ProductionActions;
  perms: Perms;
  onNewBatch: (o: ProductionOrder) => void;
  onOpen?: (o: ProductionOrder) => void;
  navigate: NavigateFunction;
}

function raisedBy(o: ProductionOrder, perms: { userId?: string; isSuperAdmin?: boolean }): boolean {
  if (perms.isSuperAdmin || !perms.userId) return false;
  const c = (o as { createdBy?: string | { _id?: string } }).createdBy;
  const id = typeof c === 'string' ? c : c?._id;
  return !!id && String(id) === String(perms.userId);
}

/** The one thing to do next on an order (or null when nothing is actionable for this user). */
export function orderPrimaryAction(o: ProductionOrder, h: OrderHandlers): PrimaryAction | null {
  const { actions, perms } = h;
  const remaining = remainingToBatch(o);
  switch (o.status) {
    case 'CREATED':
      return perms.canUpdate ? { label: 'Run MRP', icon: Calculator, onClick: () => actions.runMrp(o) } : null;
    case 'MRP_DONE':
      return perms.canUpdate ? { label: 'Reserve material', icon: PackageCheck, onClick: () => actions.reserve(o) } : null;
    case 'MATERIAL_RESERVED':
      return perms.canUpdate ? { label: 'Submit for approval', icon: Send, onClick: () => actions.submit(o) } : null;
    case 'APPROVAL_PENDING':
      // Four-eyes: whoever raised the order can't approve it (the API refuses; don't offer it).
      return perms.canApprove && !raisedBy(o, perms)
        ? { label: 'Approve', icon: CheckCircle2, onClick: () => actions.approve(o) }
        : null;
    case 'APPROVED':
    case 'IN_PROGRESS':
      return perms.canBatch && remaining > 0
        ? { label: `New batch (${remaining})`, icon: Layers, onClick: () => h.onNewBatch(o), variant: 'secondary' }
        : null;
    default:
      return null;
  }
}

/** Everything else, for the overflow menu. */
export function orderMenuItems(o: ProductionOrder, h: OrderHandlers, opts: { includeView?: boolean } = {}): DropdownMenuItem[] {
  const { actions, perms } = h;
  const running = o.runningBatches ?? 0;
  const closed = ['COMPLETED', 'CANCELLED'].includes(o.status);
  return [
    { label: 'View details', icon: Eye, hidden: !opts.includeView || !h.onOpen, onSelect: () => h.onOpen?.(o) },
    { label: 'Re-run MRP', icon: RotateCcw, hidden: !(o.status === 'MRP_DONE' && perms.canUpdate), onSelect: () => actions.runMrp(o) },
    {
      label: 'Open purchase requisitions',
      icon: ShoppingCart,
      hidden: !(o.status === 'MRP_DONE' || o.suggestedPrId),
      onSelect: () => h.navigate('/purchase'),
    },
    { label: 'Reject…', icon: XCircle, danger: true, hidden: !(o.status === 'APPROVAL_PENDING' && perms.canApprove && !raisedBy(o, perms)), onSelect: () => actions.reject(o) },
    { type: 'separator', hidden: closed || !perms.canUpdate },
    {
      label: 'Cancel order',
      icon: Ban,
      danger: true,
      hidden: closed || !perms.canUpdate,
      disabled: running > 0,
      disabledReason: `${running} batch${running === 1 ? ' is' : 'es are'} still running`,
      onSelect: () => actions.cancel(o),
    },
  ];
}

export interface BatchHandlers {
  actions: ProductionActions;
  perms: Perms;
  onComplete: (b: ProductionBatch) => void;
  onAssign: (b: ProductionBatch) => void;
  onOpen?: (b: ProductionBatch) => void;
  navigate: NavigateFunction;
  fallbackStages?: string[];
}

export function batchPrimaryAction(b: ProductionBatch, h: BatchHandlers): PrimaryAction | null {
  const { actions, perms } = h;
  if (b.status === 'CREATED' && perms.canBatchUpdate) {
    return { label: 'Start batch', icon: Play, onClick: () => actions.start(b) };
  }
  if (isBatchRunning(b) && perms.canBatchUpdate) {
    if (stageNeedsQc(b)) {
      // Operators have no Quality access: show the wait state instead of a link into a page they can't open.
      if (!perms.canQc) {
        return {
          label: `Waiting for ${stageLabel(b.currentStage)} QC`, icon: Hourglass, variant: 'secondary', disabled: true, onClick: () => {},
        };
      }
      return {
        label: 'Send to QC',
        icon: CheckCircle2,
        variant: 'secondary',
        onClick: () => h.navigate('/quality/inspections?tab=inprocess'),
      };
    }
    return { label: `Complete ${stageLabel(b.currentStage)}`, icon: CheckCircle2, onClick: () => h.onComplete(b) };
  }
  if (b.status === 'COMPLETED' && !finalQcDone(b)) {
    if (!perms.canQc) {
      return { label: 'Waiting for final QC', icon: Hourglass, variant: 'secondary', disabled: true, onClick: () => {} };
    }
    return { label: 'Final QC', icon: CheckCircle2, variant: 'secondary', onClick: () => h.navigate('/quality/inspections?tab=final') };
  }
  return null;
}

export function batchMenuItems(b: ProductionBatch, h: BatchHandlers, opts: { includeView?: boolean } = {}): DropdownMenuItem[] {
  const { actions, perms } = h;
  const running = isBatchRunning(b);
  const open = !['COMPLETED', 'CANCELLED'].includes(b.status);
  return [
    { label: 'View details', icon: Eye, hidden: !opts.includeView || !h.onOpen, onSelect: () => h.onOpen?.(b) },
    { label: 'Assign machine / worker', icon: Users, hidden: !(open && perms.canBatchUpdate), onSelect: () => h.onAssign(b) },
    {
      label: 'Roll back one stage',
      icon: Undo2,
      danger: true,
      hidden: !(running && perms.canBatchUpdate && !isFirstStage(b, h.fallbackStages)),
      onSelect: () => actions.rollback(b),
    },
  ];
}

/** Table cell: one contextual button + overflow menu. */
export function ActionCell({ primary, items, busy, label }: {
  primary: PrimaryAction | null;
  items: DropdownMenuItem[];
  busy?: boolean;
  label?: string;
}) {
  const Icon = primary?.icon;
  return (
    <div className="flex items-center justify-end gap-1">
      {primary && (
        <Button
          size="sm"
          variant={primary.variant ?? 'primary'}
          loading={busy}
          disabled={primary.disabled}
          icon={Icon ? <Icon size={14} /> : undefined}
          onClick={(e) => { e.stopPropagation(); primary.onClick(); }}
        >
          {primary.label}
        </Button>
      )}
      <RowActionsMenu items={items} label={label} />
    </div>
  );
}
