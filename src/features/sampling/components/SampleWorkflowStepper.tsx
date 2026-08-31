import { CheckCircle2, Circle, Minus } from 'lucide-react';
import type { SampleWorkflowStepId } from '../sampleWorkflowUtils';
import { SAMPLE_WORKFLOW_STEPS, stepStatus } from '../sampleWorkflowUtils';

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
  return (
    <nav className="mb-4 flex flex-wrap gap-1" aria-label="Garment sampling workflow">
      {SAMPLE_WORKFLOW_STEPS.map((step, i) => {
        const state = stepStatus(step.id, current, sampleStatus, sampleType);
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            className={`flex min-w-[88px] flex-1 items-start gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors ${
              state === 'current'
                ? 'border-[var(--erp-accent)] bg-[var(--erp-accent-muted)]/20'
                : state === 'done'
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : state === 'skipped'
                    ? 'border-[var(--erp-border)]/50 bg-[var(--erp-surface-muted)]/30 opacity-60'
                    : 'border-[var(--erp-border)] bg-[var(--erp-surface)]'
            }`}
          >
            {state === 'done' ? (
              <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : state === 'skipped' ? (
              <Minus size={12} className="mt-0.5 shrink-0 text-erp-text-muted" />
            ) : (
              <Circle size={12} className={`mt-0.5 shrink-0 ${state === 'current' ? 'text-[var(--erp-accent)]' : 'text-erp-text-muted'}`} />
            )}
            <span>
              <span className="block text-[9px] font-semibold text-erp-text-primary">
                {i + 1}. {step.label}
                {state === 'skipped' && <span className="font-normal text-erp-text-muted"> (n/a)</span>}
              </span>
              <span className="mt-0.5 block text-[8px] leading-tight text-erp-text-muted">{step.hint}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
