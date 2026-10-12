import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productionApi } from '../../services/operations';
import type { ProductionBatch, ProductionOrder } from '../../types/api';
import { toast, useConfirm, usePrompt } from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import { stageLabel } from './productionUtils';

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useProductionPerms() {
  const { permissions, user } = useAuth();
  const has = (p: string) => permissions.includes('*') || permissions.includes(p);
  return {
    userId: user?._id,
    isSuperAdmin: !!user?.isSuperAdmin,
    canCreate: has('production.create'),
    canUpdate: has('production.update'),
    canBatch: has('batch.create'),
    canBatchUpdate: has('batch.update'),
    canApprove: has('production.approve'),
    /** Can open the Quality page (operators can't — they wait for QC instead of being sent there). */
    canQc: has('quality.read'),
  };
}

export function useInvalidateProduction() {
  const qc = useQueryClient();
  return () => {
    [
      'production-stats', 'production-list', 'batch-board', 'production-schedules', 'batches',
      'production-orders', 'production-order', 'production-batch', 'order-batches', 'qc-queue',
      'quality-pending', 'inventory-balances', 'inventory-stats', 'warehouse-stats',
    ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
}

type Step = 'mrp' | 'reserve' | 'submit-approval' | 'approve' | 'reject' | 'cancel' | 'start' | 'rollback';

const SUCCESS: Record<Step, string> = {
  mrp: 'Material requirements calculated',
  reserve: 'Raw material reserved',
  'submit-approval': 'Submitted for approval',
  approve: 'Production order approved',
  reject: 'Production order rejected',
  cancel: 'Production order cancelled',
  start: 'Batch started — materials issued',
  rollback: 'Batch moved back one stage',
};

/**
 * Order/batch workflow actions shared by tables, the board and the detail drawers.
 * Destructive steps confirm first; reject asks for a reason.
 */
export function useProductionActions() {
  const invalidate = useInvalidateProduction();
  const confirm = useConfirm();
  const prompt = usePrompt();

  const workflow = useMutation({
    mutationFn: ({ step, id, comments }: { step: Step; id: string; comments?: string }) => {
      switch (step) {
        case 'mrp': return productionApi.runMrp(id);
        case 'reserve': return productionApi.reserve(id);
        case 'submit-approval': return productionApi.submitApproval(id);
        case 'approve': return productionApi.approve(id);
        case 'reject': return productionApi.reject(id, comments);
        case 'cancel': return productionApi.cancel(id);
        case 'start': return productionApi.startBatch(id);
        case 'rollback': return productionApi.rollbackStage(id);
        default: throw new Error('Unknown step');
      }
    },
    onSuccess: (_d, vars) => {
      invalidate();
      toast.success(SUCCESS[vars.step]);
    },
  });

  const run = (step: Step, id: string, comments?: string) => workflow.mutateAsync({ step, id, comments }).catch(() => undefined);

  return {
    busy: workflow.isPending,
    pendingId: workflow.isPending ? workflow.variables?.id : undefined,
    runMrp: (o: ProductionOrder) => run('mrp', o._id),
    reserve: (o: ProductionOrder) => run('reserve', o._id),
    submit: (o: ProductionOrder) => run('submit-approval', o._id),
    approve: (o: ProductionOrder) => run('approve', o._id),
    reject: async (o: ProductionOrder) => {
      const reason = await prompt({
        title: `Reject ${o.orderNumber}?`,
        message: 'The planner sees this reason and can revise the order.',
        label: 'Reason for rejection',
        minLength: 3,
        tone: 'danger',
        confirmLabel: 'Reject order',
      });
      if (reason != null) await run('reject', o._id, reason);
    },
    cancel: async (o: ProductionOrder) => {
      const ok = await confirm({
        title: `Cancel ${o.orderNumber}?`,
        message: 'Reserved material is released and no new batches can be created. This cannot be undone.',
        confirmLabel: 'Cancel order',
        cancelLabel: 'Keep order',
        tone: 'danger',
      });
      if (ok) await run('cancel', o._id);
    },
    start: (b: ProductionBatch) => run('start', b._id),
    rollback: async (b: ProductionBatch) => {
      const ok = await confirm({
        title: `Roll back ${b.batchNumber}?`,
        message: `The batch moves back from ${stageLabel(b.currentStage)} to the previous stage.`,
        confirmLabel: 'Roll back',
        tone: 'danger',
      });
      if (ok) await run('rollback', b._id);
    },
  };
}

export type ProductionActions = ReturnType<typeof useProductionActions>;
