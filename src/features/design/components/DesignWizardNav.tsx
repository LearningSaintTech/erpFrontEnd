import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ErpButton } from '../../../components/erp';

type Props = {
  stepIndex: number;
  stepCount: number;
  groupLabel: string;
  tabLabel: string;
  canGoBack: boolean;
  canGoNext: boolean;
  isLast: boolean;
  editable: boolean;
  saving?: boolean;
  canSubmit?: boolean;
  submitHint?: string;
  nextLabel?: string;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft?: () => void;
  onSubmit?: () => void;
};

export function DesignWizardNav({
  stepIndex,
  stepCount,
  groupLabel,
  tabLabel,
  canGoBack,
  canGoNext,
  isLast,
  editable,
  saving,
  canSubmit,
  submitHint,
  nextLabel,
  onBack,
  onNext,
  onSaveDraft,
  onSubmit,
}: Props) {
  return (
    <div className="sticky bottom-0 mt-4 border-t border-[var(--erp-border)] bg-[var(--erp-bg)] py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-erp-text-muted">
          Step {stepIndex + 1} of {stepCount}
          <span className="mx-1.5 text-[var(--erp-border)]">·</span>
          <span className="font-medium text-erp-text-primary">{groupLabel}</span>
          <span className="mx-1 text-erp-text-muted">/</span>
          <span className="text-erp-text-primary">{tabLabel}</span>
        </p>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[var(--erp-surface-muted)] sm:w-40">
          <div
            className="h-full rounded-full bg-[var(--erp-accent)] transition-all"
            style={{ width: `${Math.round(((stepIndex + 1) / stepCount) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ErpButton
          variant="secondary"
          className="!px-3 !py-1.5 text-[11px]"
          disabled={!canGoBack || saving}
          onClick={onBack}
        >
          <ChevronLeft size={14} className="mr-0.5 inline" />
          Back
        </ErpButton>

        {!isLast && (
          <ErpButton className="!px-3 !py-1.5 text-[11px]" disabled={!canGoNext || saving} onClick={onNext}>
            {nextLabel || 'Next'}
            <ChevronRight size={14} className="ml-0.5 inline" />
          </ErpButton>
        )}

        {editable && (
          <>
            <span className="mx-1 hidden h-4 w-px bg-[var(--erp-border)] sm:inline-block" />
            <ErpButton
              variant="secondary"
              className="!px-3 !py-1.5 text-[11px]"
              disabled={saving}
              onClick={onSaveDraft}
            >
              Save draft
            </ErpButton>
            {isLast && (
              <ErpButton
                className="!px-3 !py-1.5 text-[11px]"
                disabled={saving || !canSubmit}
                onClick={onSubmit}
              >
                Save & submit for review
              </ErpButton>
            )}
            {isLast && !canSubmit && submitHint && (
              <span className="text-[10px] text-amber-600">{submitHint}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
