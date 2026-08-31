import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { ErpCard } from '../../../components/erp';
import type { PipelineStep } from '../designFlowUtils';

function StepIcon({ state }: { state: PipelineStep['state'] }) {
  if (state === 'done') {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40">
        <CheckCircle2 size={10} className="text-emerald-600" />
      </span>
    );
  }
  if (state === 'blocked') {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--erp-surface-muted)] ring-1 ring-[var(--erp-border)]">
        <Lock size={8} className="text-erp-text-muted" />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--erp-accent-muted)]/40 ring-1 ring-[var(--erp-accent)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--erp-accent)]" />
      </span>
    );
  }
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--erp-surface)] ring-1 ring-[var(--erp-border)]">
      <Circle size={8} className="text-erp-text-muted" />
    </span>
  );
}

function connectorTone(prev: PipelineStep['state']) {
  return prev === 'done' ? 'bg-emerald-500/50' : 'bg-[var(--erp-border)]';
}

function labelTone(state: PipelineStep['state']) {
  if (state === 'done') return 'text-emerald-700';
  if (state === 'current') return 'text-[var(--erp-accent)]';
  if (state === 'blocked') return 'text-erp-text-muted';
  return 'text-erp-text-primary';
}

export function DesignPipelineCard({ steps }: { steps: PipelineStep[] }) {
  return (
    <ErpCard className="mb-2 !p-2">
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-erp-text-muted">
        Product development pipeline
      </p>

      <ol className="m-0 flex list-none items-start p-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <li key={step.id} className={`flex min-w-0 ${isLast ? '' : 'flex-1'}`} title={step.description}>
              <div className="flex w-full min-w-0 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  {i > 0 ? (
                    <span aria-hidden className={`h-px min-w-[4px] flex-1 ${connectorTone(steps[i - 1].state)}`} />
                  ) : (
                    <span className="min-w-[4px] flex-1" />
                  )}
                  <StepIcon state={step.state} />
                  {!isLast ? (
                    <span aria-hidden className={`h-px min-w-[4px] flex-1 ${connectorTone(step.state)}`} />
                  ) : (
                    <span className="min-w-[4px] flex-1" />
                  )}
                </div>

                <div className="mt-1 w-full px-0.5">
                  <p className={`text-[9px] font-medium leading-tight ${labelTone(step.state)}`}>
                    {step.label}
                    {step.state === 'current' && (
                      <span className="ml-0.5 text-[8px] font-semibold uppercase text-[var(--erp-accent)]">· now</span>
                    )}
                  </p>
                  {step.href && step.actionLabel && step.state !== 'done' && (
                    <Link
                      to={step.href}
                      className="mt-0.5 inline-block text-[8px] font-medium text-[var(--erp-accent)] hover:underline"
                    >
                      Open →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </ErpCard>
  );
}
