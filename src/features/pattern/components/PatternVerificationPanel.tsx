import { ErpButton, ErpCard } from '../../../components/erp';
import { canVerifyFlag, evidenceLabel, verificationProgress } from '../patternUtils';
import type { PatternDevelopment, PatternVerificationEvidence } from '../../../types/api';

const VERIFY_FIELDS = [
  { key: 'sizeChartVerified' as const, label: 'Size chart matches tech pack', evidenceKey: 'sizeChart' as const },
  { key: 'consumptionVerified' as const, label: 'Fabric consumption approved', evidenceKey: 'consumption' as const },
  { key: 'sampleBomVerified' as const, label: 'Sample BOM verified for cutting', evidenceKey: 'bom' as const },
];

export interface VerifyFormState {
  sizeChartVerified: boolean;
  consumptionVerified: boolean;
  sampleBomVerified: boolean;
  patternNotes: string;
}

export function PatternVerificationPanel({
  pd,
  evidence,
  form,
  onChange,
  onSave,
  onComplete,
  saving,
  completing,
  readOnly,
  completeBlockReason,
}: {
  pd?: PatternDevelopment;
  evidence?: PatternVerificationEvidence;
  form: VerifyFormState;
  onChange: (patch: Partial<VerifyFormState>) => void;
  onSave: () => void;
  onComplete: () => void;
  saving?: boolean;
  completing?: boolean;
  readOnly?: boolean;
  completeBlockReason?: string | null;
}) {
  const progress = verificationProgress(form);
  const allChecked = form.sizeChartVerified && form.consumptionVerified && form.sampleBomVerified;
  const isComplete = pd?.status === 'COMPLETED';

  return (
    <div className="space-y-3">
      <ErpCard className="!p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold text-erp-text-primary">Verification checklist</h3>
          <span className="text-[10px] text-erp-text-muted">{progress.done}/3 complete</span>
        </div>
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--erp-border)]">
          <div className="h-full bg-[var(--erp-accent)] transition-all" style={{ width: `${progress.percent}%` }} />
        </div>

        <div className="space-y-2">
          {VERIFY_FIELDS.map(({ key, label, evidenceKey }) => {
            const canCheck = canVerifyFlag(key, evidence);
            return (
              <label
                key={key}
                className={`flex flex-wrap items-start gap-2 rounded-lg border px-3 py-2 ${
                  canCheck ? 'border-[var(--erp-border)]' : 'border-amber-500/40 bg-amber-500/5'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={form[key]}
                  disabled={readOnly || !canCheck || isComplete}
                  onChange={(e) => onChange({ [key]: e.target.checked })}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium text-erp-text-primary">{label}</span>
                  <span className="text-[10px] text-erp-text-muted">{evidenceLabel(evidenceKey, evidence)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </ErpCard>

      <ErpCard className="!p-3">
        <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Pattern room notes</label>
        <textarea
          value={form.patternNotes}
          disabled={readOnly || isComplete}
          onChange={(e) => onChange({ patternNotes: e.target.value })}
          placeholder="Seam allowances, notch placement, grain lines, cutting instructions…"
          className="erp-input w-full resize-y !py-1.5 text-[11px]"
          rows={4}
        />
      </ErpCard>

      {!readOnly && !isComplete && (
        <div className="flex flex-wrap gap-2">
          <ErpButton variant="secondary" className="!px-4 !py-1.5 text-[11px]" disabled={saving} onClick={onSave}>
            Save verification
          </ErpButton>
          <ErpButton
            className="!px-4 !py-1.5 text-[11px]"
            disabled={completing || !allChecked || !!completeBlockReason}
            onClick={onComplete}
          >
            Complete pattern development
          </ErpButton>
          {completeBlockReason && (
            <span className="self-center text-[10px] text-amber-600">{completeBlockReason}</span>
          )}
          {!completeBlockReason && !allChecked && (
            <span className="self-center text-[10px] text-amber-600">All three checks required before completion</span>
          )}
        </div>
      )}

      {isComplete && (
        <ErpCard className="!border-emerald-500/30 !bg-emerald-500/5 !p-3">
          <p className="text-[11px] font-medium text-emerald-800">Pattern development completed — sampling is unlocked for this design.</p>
        </ErpCard>
      )}
    </div>
  );
}
