import { Field, Section, Textarea } from '../../../components/erp';
import { InventoryCodeSelect } from '../../../components/InventoryCodeSelect';
import type { PatternDevelopment, PatternTechPack } from '../../../types/api';

export interface GradingFormState {
  baseSize: string;
  gradedSizes: string;
  notes: string;
}

export function emptyGradingForm(pd?: PatternDevelopment, techPack?: PatternTechPack): GradingFormState {
  const sizes = techPack?.techPack?.sizeChartData?.sizeLabels
    ?? techPack?.design.sizeChartData?.sizeLabels
    ?? [];
  return {
    baseSize: pd?.grading?.baseSize || sizes[Math.floor(sizes.length / 2)] || '',
    gradedSizes: sizes.join(', '),
    notes: pd?.grading?.notes || '',
  };
}

export function PatternGradingPanel({
  form,
  sizeLabels,
  onChange,
  readOnly,
  showErrors,
}: {
  form: GradingFormState;
  sizeLabels: string[];
  onChange: (patch: Partial<GradingFormState>) => void;
  readOnly?: boolean;
  showErrors?: boolean;
}) {
  const sizes = sizeLabels.length
    ? sizeLabels
    : form.gradedSizes.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <Section title="Mother pattern" description="The measurement chart already grades every size. Record which size the mother pattern is made in.">
      <div className="space-y-4">
        <Field label="Base size" required htmlFor="grading-base-size" error={showErrors && !form.baseSize ? 'Choose the base size.' : undefined}>
          <div className="max-w-xs">
            <InventoryCodeSelect
              type="SIZE"
              value={form.baseSize}
              disabled={readOnly}
              placeholder="Select base size…"
              onChange={(code) => onChange({ baseSize: code })}
            />
          </div>
        </Field>

        {sizes.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-erp-text-muted">Graded sizes</p>
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((size) => {
                const base = size === form.baseSize;
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange({ baseSize: size })}
                    className={`rounded-md border px-2.5 py-1 font-mono text-[13px] transition disabled:cursor-default ${
                      base
                        ? 'border-[var(--erp-accent)] bg-[var(--erp-accent-muted)] font-semibold text-[var(--erp-accent)]'
                        : 'border-[var(--erp-border)] text-erp-text-secondary hover:border-[var(--erp-border-strong)]'
                    }`}
                    aria-pressed={base}
                  >
                    {size}{base ? ' · base' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Field label="Grade rules">
          <Textarea
            value={form.notes}
            disabled={readOnly}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Increments per size, plus-size specials…"
            rows={3}
          />
        </Field>
      </div>
    </Section>
  );
}
