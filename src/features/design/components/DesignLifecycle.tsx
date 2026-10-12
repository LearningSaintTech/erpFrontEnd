import { useNavigate } from 'react-router-dom';
import { StepFlow, type Step, type StepState } from '../../../components/erp';
import type { PipelineStep } from '../designFlowUtils';

function asState(s: PipelineStep['state']): StepState {
  // StepFlow "blocked" is red — locked steps are simply not reached yet.
  return s === 'blocked' ? 'upcoming' : s;
}

/**
 * Product lifecycle for one style: Design → Pattern → Sample → SKU / BOM → Production.
 * Built from the existing pipeline rules (designFlowUtils); steps with a link are clickable.
 */
export function DesignLifecycle({ steps, designStatus }: { steps: PipelineStep[]; designStatus: string }) {
  const navigate = useNavigate();
  const byId = Object.fromEntries(steps.map((s) => [s.id, s]));
  const approval = byId.approval;
  const release = byId.release;

  const designState: StepState = designStatus === 'REJECTED'
    ? 'blocked'
    : release?.state === 'done'
      ? 'done'
      : 'current';

  const designDescription = designStatus === 'REJECTED'
    ? 'Rejected'
    : release?.state === 'done'
      ? release.description
      : designStatus === 'APPROVED'
        ? 'Approved — release next'
        : approval?.description;

  const linkStep = (id: string, label: string, short: string): Step | null => {
    const s = byId[id];
    if (!s) return null;
    return {
      id,
      label,
      description: short,
      state: asState(s.state),
      onClick: s.href ? () => navigate(s.href!) : undefined,
    };
  };

  const pattern = byId.pattern;
  const sampling = byId.sampling;
  const sku = byId.sku;

  const out: Step[] = [
    { id: 'design', label: 'Design', description: designDescription, state: designState },
    linkStep('pattern', 'Pattern', pattern?.state === 'done' ? 'Completed' : pattern?.state === 'current' ? 'In development' : 'After release') as Step,
    linkStep('sampling', 'Sample', sampling?.state === 'done' ? 'Approved' : sampling?.state === 'current' ? 'In progress' : 'After pattern') as Step,
    linkStep('sku', 'SKU / BOM', sku?.state === 'done' ? 'BOM frozen' : sku?.state === 'current' ? (sku.href === '/products/boms' ? 'SKUs ready — BOM next' : 'Ready to generate') : 'After sample approval') as Step,
    linkStep('production', 'Production', byId.production?.state === 'current' ? 'Plan orders' : 'After SKU & BOM') as Step,
  ].filter(Boolean);

  return <StepFlow steps={out} size="sm" />;
}
