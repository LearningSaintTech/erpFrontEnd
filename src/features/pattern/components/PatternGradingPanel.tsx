import { ErpButton, ErpCard } from '../../../components/erp';
import { InventoryCodeSelect } from '../../../components/InventoryCodeSelect';
import type { PatternDevelopment, PatternTechPack } from '../../../types/api';

const label = 'mb-1 block text-[10px] font-medium text-erp-text-muted';

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
  onSave,
  saving,
  readOnly,
}: {
  form: GradingFormState;
  sizeLabels: string[];
  onChange: (patch: Partial<GradingFormState>) => void;
  onSave: () => void;
  saving?: boolean;
  readOnly?: boolean;
}) {
  const sizes = sizeLabels.length
    ? sizeLabels
    : form.gradedSizes.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <ErpCard className="!p-3">
      <h3 className="mb-1 text-[11px] font-semibold text-erp-text-primary">Mother pattern</h3>
      <p className="mb-3 text-[10px] text-erp-text-muted">
        The POM chart already lists graded sizes. Here you only record which size the mother pattern is made in.
      </p>

      <div>
        <label className={label}>Base size (mother pattern)</label>
        <div className="max-w-xs">
          <InventoryCodeSelect
            type="SIZE"
            value={form.baseSize}
            disabled={readOnly}
            placeholder="Select base size…"
            onChange={(code) => onChange({ baseSize: code })}
          />
        </div>
      </div>

      {sizes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {sizes.map((size) => (
            <span
              key={size}
              className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                size === form.baseSize
                  ? 'bg-[var(--erp-accent-muted)]/50 text-[var(--erp-accent)]'
                  : 'bg-[var(--erp-border)]/40 text-erp-text-muted'
              }`}
            >
              {size}{size === form.baseSize ? ' (base)' : ''}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        <label className={label}>Grade rules</label>
        <textarea
          value={form.notes}
          disabled={readOnly}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Increments per size, plus-size specials…"
          className="erp-input w-full resize-y !py-1.5 text-[11px]"
          rows={3}
        />
      </div>

      {!readOnly && (
        <ErpButton className="mt-3 !px-4 !py-1.5 text-[11px]" disabled={saving || !form.baseSize} onClick={onSave}>
          Save base size
        </ErpButton>
      )}
    </ErpCard>
  );
}
