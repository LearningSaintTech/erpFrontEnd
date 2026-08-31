import { CheckCircle2, Lock, PlayCircle, Minus } from 'lucide-react';
import type { SampleWorkflowStepId } from '../sampleWorkflowUtils';
import { stepGuidance } from '../sampleNextActions';

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
  const icon = g.state === 'done'
    ? <CheckCircle2 size={14} className="text-emerald-600" />
    : g.state === 'active'
      ? <PlayCircle size={14} className="text-[var(--erp-accent)]" />
      : g.state === 'skipped'
        ? <Minus size={14} className="text-erp-text-muted" />
        : <Lock size={14} className="text-erp-text-muted" />;

  return (
    <div className={`mb-3 flex flex-wrap items-start gap-2 rounded-lg border px-3 py-2 text-[10px] ${
      g.state === 'active'
        ? 'border-[var(--erp-accent)]/40 bg-[var(--erp-accent-muted)]/10'
        : 'border-[var(--erp-border)] bg-[var(--erp-surface-muted)]/30'
    }`}>
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-erp-text-primary">{g.title}</p>
        <p className="mt-0.5 text-erp-text-muted">{g.body}</p>
      </div>
      {g.state === 'locked' && stepId !== activeStep && onGoActive && (
        <button
          type="button"
          onClick={onGoActive}
          className="shrink-0 text-[10px] font-medium text-[var(--erp-accent)] hover:underline"
        >
          Go to active step →
        </button>
      )}
    </div>
  );
}
