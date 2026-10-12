import { Button, InfoBanner } from '../../../components/erp';
import type { SampleWorkflowStepId } from '../sampleWorkflowUtils';
import { stepGuidance } from '../sampleNextActions';

/** One-line status of the step being viewed (done / now / not started), with a jump to the live step. */
export function SampleStepGuidance({
  stepId,
  status,
  sampleType,
  onGoActive,
  activeStep,
}: {
  stepId: SampleWorkflowStepId;
  status: string;
  sampleType?: string;
  activeStep: SampleWorkflowStepId;
  onGoActive?: () => void;
}) {
  const g = stepGuidance(stepId, status, sampleType);
  // The live step is already explained by the next-action card at the top.
  if (g.state === 'active') return null;
  const tone = g.state === 'done' ? 'success' : 'muted';
  return (
    <InfoBanner
      inset={false}
      tone={tone}
      className="mb-4"
      action={g.state === 'locked' && stepId !== activeStep && onGoActive
        ? <Button size="sm" variant="secondary" onClick={onGoActive}>Go to current step</Button>
        : undefined}
    >
      <span className="font-medium">{g.title}.</span> {g.body}
    </InfoBanner>
  );
}
