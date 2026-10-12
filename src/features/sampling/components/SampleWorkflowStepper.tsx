import { StepFlow, type Step } from '../../../components/erp';
import type { SampleWorkflowStepId } from '../sampleWorkflowUtils';
import { SAMPLE_WORKFLOW_STEPS, inferSampleStep, stepStatus } from '../sampleWorkflowUtils';
import type { Sample } from '../../../types/api';

/**
 * The sample's own steps (Tech pack → Fabric & trims → Cutting → Stitching → QC → Fit → Approval).
 * "current" follows the sample's status; the step being viewed is highlighted in its description.
 */
export function SampleWorkflowStepper({
  current,
  sampleStatus,
  sampleType,
  onSelect,
}: {
  current: SampleWorkflowStepId;
  sampleStatus: string;
  sampleType?: string;
  onSelect: (step: SampleWorkflowStepId) => void;
}) {
  const live = inferSampleStep({ status: sampleStatus, sampleType } as Sample);
  const rejected = sampleStatus === 'REJECTED';
  const steps: Step[] = SAMPLE_WORKFLOW_STEPS.map((s) => {
    const st = stepStatus(s.id, live, sampleStatus, sampleType);
    const skipped = st === 'skipped';
    const state = rejected && s.id === live ? 'blocked' : skipped ? 'upcoming' : st;
    return {
      id: s.id,
      label: s.label,
      description: s.id === current ? 'Viewing' : skipped ? 'Not needed' : st === 'current' ? 'Now' : undefined,
      state: state as Step['state'],
      onClick: s.id !== current ? () => onSelect(s.id) : undefined,
    };
  });
  return <StepFlow steps={steps} size="sm" />;
}
