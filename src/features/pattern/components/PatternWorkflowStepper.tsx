import { CheckCircle2, Circle } from 'lucide-react';
import type { WorkflowStepId } from '../patternWorkflowUtils';
import { WORKFLOW_STEPS, stepStatus, canAccessStep } from '../patternWorkflowUtils';
import type { PatternDevelopment, PatternTechPack } from '../../../types/api';

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
  return (
    <nav className="mb-4 flex flex-wrap gap-1" aria-label="Pattern workflow">
      {WORKFLOW_STEPS.map((step, i) => {
        const state = stepStatus(step.id, current, pd, techPack);
        const accessible = canAccessStep(step.id, pd, techPack);
        return (
          <button
            key={step.id}
            type="button"
            disabled={!accessible && state === 'upcoming'}
            onClick={() => accessible && onSelect(step.id)}
            className={`flex min-w-[120px] flex-1 items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
              !accessible && state === 'upcoming' ? 'cursor-not-allowed opacity-50 ' : ''
            }${
              state === 'current'
                ? 'border-[var(--erp-accent)] bg-[var(--erp-accent-muted)]/20'
                : state === 'done'
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-[var(--erp-border)] bg-[var(--erp-surface)]'
            }`}
          >
            {state === 'done' ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <Circle size={14} className={`mt-0.5 shrink-0 ${state === 'current' ? 'text-[var(--erp-accent)]' : 'text-erp-text-muted'}`} />
            )}
            <span>
              <span className="block text-[10px] font-semibold text-erp-text-primary">
                {i + 1}. {step.label}
              </span>
              <span className="mt-0.5 block text-[9px] leading-tight text-erp-text-muted">{step.hint}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
