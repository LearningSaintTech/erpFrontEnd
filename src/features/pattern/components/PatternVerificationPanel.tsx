import { CheckCircle2, CircleAlert } from 'lucide-react';
import { Field, Section, Textarea } from '../../../components/erp';
import { canVerifyFlag, evidenceLabel, verificationProgress } from '../patternUtils';
import type { PatternDevelopment, PatternVerificationEvidence } from '../../../types/api';

const VERIFY_FIELDS = [
  { key: 'sizeChartVerified' as const, label: 'Size chart matches the tech pack', evidenceKey: 'sizeChart' as const },
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
  readOnly,
}: {
  pd?: PatternDevelopment;
  evidence?: PatternVerificationEvidence;
  form: VerifyFormState;
  onChange: (patch: Partial<VerifyFormState>) => void;
  readOnly?: boolean;
}) {
  const progress = verificationProgress(form);
  const isComplete = pd?.status === 'COMPLETED';

  return (
    <div className="space-y-4">
      <Section
        title="Sign-off checklist"
        description="Tick each check once you have confirmed it. All three are needed to complete."
        actions={<span className="text-[13px] tabular-nums text-erp-text-muted">{progress.done} of 3</span>}
      >
        <ul className="space-y-2">
          {VERIFY_FIELDS.map(({ key, label, evidenceKey }) => {
            const canCheck = canVerifyFlag(key, evidence);
            const disabled = readOnly || !canCheck || isComplete;
            return (
              <li key={key}>
                <label
                  className={`flex items-start gap-3 rounded-md border px-3 py-2.5 ${
                    canCheck ? 'border-[var(--erp-border)]' : 'border-[var(--erp-warning-border)] bg-[var(--erp-warning-bg)]'
                  } ${disabled ? '' : 'cursor-pointer hover:bg-[var(--erp-surface-muted)]'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded"
                    checked={form[key]}
                    disabled={disabled}
                    onChange={(e) => onChange({ [key]: e.target.checked })}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-erp-text-primary">{label}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-erp-text-muted">
                      {canCheck
                        ? <CheckCircle2 size={12} className="text-[var(--erp-success-solid)]" />
                        : <CircleAlert size={12} className="text-[var(--erp-warning-solid)]" />}
                      {evidenceLabel(evidenceKey, evidence)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Pattern room notes">
        <Field label="Notes for cutting and sampling">
          <Textarea
            value={form.patternNotes}
            disabled={readOnly || isComplete}
            onChange={(e) => onChange({ patternNotes: e.target.value })}
            placeholder="Seam allowances, notch placement, grain lines, cutting instructions…"
            rows={4}
          />
        </Field>
      </Section>
    </div>
  );
}
