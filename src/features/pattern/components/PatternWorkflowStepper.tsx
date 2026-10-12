import { StepFlow, type Step } from '../../../components/erp';
import type { WorkflowStepId } from '../patternWorkflowUtils';
import { WORKFLOW_STEPS, stepStatus, canAccessStep, isStepComplete } from '../patternWorkflowUtils';
import type { PatternDevelopment, PatternTechPack } from '../../../types/api';

const SHORT_HINT: Record<WorkflowStepId, string> = {
  techpack: 'Measurements, fabric, trims',
  marker: 'Length, pieces, consumption',
  grading: 'Mother pattern size',
  verify: 'Checks and completion',
};

/** Pattern workflow: Tech pack → Marker → Base size → Sign-off. Reachable steps are clickable. */
export function PatternWorkflowStepper({
  current,
  pd,
  techPack,
  onSelect,
}: {
  current: WorkflowStepId;
  pd?: PatternDevelopment;
  techPack?: PatternTechPack;
  onSelect: (step: WorkflowStepId) => void;
}) {
  const steps: Step[] = WORKFLOW_STEPS.map((s) => {
    const state = stepStatus(s.id, current, pd, techPack);
    const accessible = canAccessStep(s.id, pd, techPack);
    const done = isStepComplete(s.id, pd, techPack);
    return {
      id: s.id,
      label: s.label,
      description: state === 'current' ? (done ? 'Done · viewing' : SHORT_HINT[s.id]) : done ? 'Done' : accessible ? SHORT_HINT[s.id] : 'Locked',
      state: s.id === current ? 'current' : done ? 'done' : state === 'done' ? 'done' : 'upcoming',
      onClick: accessible && s.id !== current ? () => onSelect(s.id) : undefined,
    };
  });
  return <StepFlow steps={steps} size="sm" />;
}
