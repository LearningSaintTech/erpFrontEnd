import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bomApi } from '../../services/manufacturing';
import { toast, useConfirm, usePrompt } from '../../components/erp';
import type { Bom, MrpPreview } from '../../types/api';
import './bomTypes';

export type BomStep = 'submit' | 'approve' | 'finalize' | 'reject' | 'request-changes';

const SUCCESS: Record<BomStep, string> = {
  submit: 'BOM submitted for approval',
  approve: 'BOM approved — ready to freeze',
  finalize: 'BOM frozen as standard cost',
  reject: 'BOM rejected — back to draft',
  'request-changes': 'Changes requested — BOM back to draft',
};

/** BOM lifecycle actions with confirm / reason dialogs, shared by the list and the detail drawer. */
export function useBomActions() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [mrpView, setMrpView] = useState<{ bom: Bom; mrp: MrpPreview } | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['boms'] });
    qc.invalidateQueries({ queryKey: ['bom-stats'] });
    qc.invalidateQueries({ queryKey: ['bom'] });
    // SKU production-readiness (hasActiveBom) and the design lifecycle depend on BOM status.
    qc.invalidateQueries({ queryKey: ['skus'] });
    qc.invalidateQueries({ queryKey: ['approvals-pending'] });
  };

  const workflow = useMutation({
    mutationFn: async ({ bom, step, comments }: { bom: Bom; step: BomStep; comments?: string }) => {
      switch (step) {
        case 'submit': return bomApi.submit(bom._id);
        case 'approve': return bomApi.approve(bom._id);
        case 'reject': return bomApi.reject(bom._id, comments ?? '');
        case 'request-changes': return bomApi.requestChanges(bom._id, comments ?? '');
        default: return bomApi.finalize(bom._id);
      }
    },
    onSuccess: (result, vars) => {
      invalidate();
      toast.success(SUCCESS[vars.step]);
      if (vars.step === 'finalize' && result && 'mrp' in result) {
        setMrpView({ bom: vars.bom, mrp: result.mrp });
      }
    },
  });

  const loadMrp = useMutation({
    mutationFn: (bom: Bom) => bomApi.mrpPreview(bom._id),
    onSuccess: (mrp, bom) => setMrpView({ bom, mrp }),
  });

  const submit = (bom: Bom) => workflow.mutate({ bom, step: 'submit' });

  const approve = async (bom: Bom) => {
    const ok = await confirm({
      title: `Approve ${bom.bomCode}?`,
      message: 'Quantities and wastage are approved. It can then be frozen as the standard cost.',
      confirmLabel: 'Approve',
      tone: 'primary',
    });
    if (ok) workflow.mutate({ bom, step: 'approve' });
  };

  const finalize = async (bom: Bom) => {
    const ok = await confirm({
      title: `Freeze ${bom.bomCode} and run MRP?`,
      message: 'This version becomes the active BOM and its cost is frozen as the standard. Any older active version is retired.',
      confirmLabel: 'Freeze and run MRP',
      tone: 'primary',
    });
    if (ok) workflow.mutate({ bom, step: 'finalize' });
  };

  const requestChanges = async (bom: Bom) => {
    const comments = await prompt({
      title: `Request changes — ${bom.bomCode}`,
      message: 'The BOM goes back to draft for the owner to fix.',
      label: 'What needs to change',
      minLength: 3,
      confirmLabel: 'Request changes',
    });
    if (comments != null) workflow.mutate({ bom, step: 'request-changes', comments });
  };

  const reject = async (bom: Bom) => {
    const comments = await prompt({
      title: `Reject ${bom.bomCode}`,
      message: 'The BOM goes back to draft.',
      label: 'Reason',
      minLength: 3,
      tone: 'danger',
      confirmLabel: 'Reject',
    });
    if (comments != null) workflow.mutate({ bom, step: 'reject', comments });
  };

  return {
    submit,
    approve,
    finalize,
    requestChanges,
    reject,
    showMrp: (bom: Bom) => loadMrp.mutate(bom),
    mrpView,
    closeMrp: () => setMrpView(null),
    pending: workflow.isPending || loadMrp.isPending,
  };
}
