import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Factory } from 'lucide-react';
import { settingsApi } from '../../../services/admin';
import type { FactorySettings, FactoryShift } from '../../../types/api';
import { ErpButton, ErpCard, ErpInput } from '../../../components/erp';
import { FieldLabel, SettingsSection } from '../SettingsSection';
import {
  DEFAULT_PRODUCTION_STAGES, NUMBERING_PREFIX_FIELDS, WORKING_DAY_LABELS,
} from '../settingsUtils';

export function FactorySettingsTab({
  factoryId,
  canEdit,
  onError,
  onSuccess,
}: {
  factoryId: string | null;
  canEdit: boolean;
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['factory-settings', factoryId],
    queryFn: () => settingsApi.getFactorySettings(factoryId!),
    enabled: !!factoryId,
  });

  const [form, setForm] = useState<FactorySettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [newStage, setNewStage] = useState('');

  useEffect(() => {
    if (data) {
      setForm({
        ...data,
        shifts: data.shifts?.length ? data.shifts : [{ name: 'General', startTime: '09:00', endTime: '18:00' }],
        workingDays: data.workingDays?.length ? data.workingDays : [1, 2, 3, 4, 5, 6],
        productionStages: data.productionStages?.length ? data.productionStages : [...DEFAULT_PRODUCTION_STAGES],
        numberingPrefixes: data.numberingPrefixes || {},
        defaultWarehouses: data.defaultWarehouses || {},
      });
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateFactorySettings(factoryId!, form!),
    onSuccess: (saved) => {
      setForm(saved);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['factory-settings', factoryId] });
      onSuccess('Factory settings saved');
    },
    onError: (e: Error) => onError(e.message),
  });

  if (!factoryId) {
    return (
      <ErpCard className="!p-6 text-center">
        <Factory size={28} className="mx-auto mb-2 text-erp-text-muted opacity-50" />
        <p className="text-[11px] font-medium">Select a factory</p>
        <p className="mt-1 text-[10px] text-erp-text-muted">Use the factory switcher in the header to configure operational settings.</p>
      </ErpCard>
    );
  }

  if (isLoading || !form) {
    return <p className="text-[11px] text-erp-text-muted">Loading factory settings…</p>;
  }

  const patch = (partial: Partial<FactorySettings>) => {
    setForm((f) => (f ? { ...f, ...partial } : f));
    setDirty(true);
  };

  const updateShift = (idx: number, field: keyof FactoryShift, value: string) => {
    const shifts = [...form.shifts];
    shifts[idx] = { ...shifts[idx], [field]: value };
    patch({ shifts });
  };

  const toggleDay = (day: number) => {
    const days = form.workingDays.includes(day)
      ? form.workingDays.filter((d) => d !== day)
      : [...form.workingDays, day].sort();
    patch({ workingDays: days });
  };

  const addStage = () => {
    const stage = newStage.trim().toUpperCase();
    if (!stage || form.productionStages.includes(stage)) return;
    patch({ productionStages: [...form.productionStages, stage] });
    setNewStage('');
  };

  return (
    <div className="space-y-3">
      {canEdit && dirty && (
        <div className="flex justify-end">
          <ErpButton className="!px-3 !py-1 text-[11px]" disabled={save.isPending} onClick={() => save.mutate()}>
            Save factory settings
          </ErpButton>
        </div>
      )}

      <SettingsSection title="Working shifts" description="Define shift windows for capacity and scheduling.">
        <div className="space-y-2">
          {form.shifts.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-4">
              <FieldLabel label="Name">
                <ErpInput value={s.name} disabled={!canEdit} onChange={(e) => updateShift(i, 'name', e.target.value)} className="!py-1 !text-[11px] w-full" />
              </FieldLabel>
              <FieldLabel label="Start">
                <ErpInput type="time" value={s.startTime} disabled={!canEdit} onChange={(e) => updateShift(i, 'startTime', e.target.value)} className="!py-1 !text-[11px] w-full" />
              </FieldLabel>
              <FieldLabel label="End">
                <ErpInput type="time" value={s.endTime} disabled={!canEdit} onChange={(e) => updateShift(i, 'endTime', e.target.value)} className="!py-1 !text-[11px] w-full" />
              </FieldLabel>
              {canEdit && form.shifts.length > 1 && (
                <div className="flex items-end">
                  <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => patch({ shifts: form.shifts.filter((_, j) => j !== i) })}>
                    Remove
                  </ErpButton>
                </div>
              )}
            </div>
          ))}
          {canEdit && (
            <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => patch({ shifts: [...form.shifts, { name: 'Shift', startTime: '09:00', endTime: '18:00' }] })}>
              Add shift
            </ErpButton>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Working days">
        <div className="flex flex-wrap gap-1">
          {WORKING_DAY_LABELS.map((label, day) => {
            const on = form.workingDays.includes(day);
            return (
              <button
                key={label}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleDay(day)}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  on ? 'bg-[var(--erp-accent)]/20 font-medium text-[var(--erp-accent)]' : 'bg-[var(--erp-surface-muted)] text-erp-text-muted'
                } disabled:cursor-default`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Production stages" description="Order of batch stages — used when advancing production.">
        <div className="mb-2 flex flex-wrap gap-1">
          {form.productionStages.map((stage, i) => (
            <span key={stage} className="inline-flex items-center gap-1 rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] px-2 py-0.5 text-[10px] font-mono">
              <span className="text-erp-text-muted">{i + 1}.</span> {stage}
              {canEdit && (
                <button type="button" className="text-erp-text-muted hover:text-red-500" onClick={() => patch({ productionStages: form.productionStages.filter((s) => s !== stage) })}>×</button>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <ErpInput value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="STAGE_CODE" className="!py-1 !text-[11px] font-mono max-w-[10rem]" />
            <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={addStage}>Add stage</ErpButton>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Document numbering prefixes">
        <div className="grid gap-2 sm:grid-cols-3">
          {NUMBERING_PREFIX_FIELDS.map(({ key, label }) => (
            <FieldLabel key={key} label={label}>
              <ErpInput
                value={form.numberingPrefixes?.[key] || ''}
                disabled={!canEdit}
                onChange={(e) => patch({ numberingPrefixes: { ...form.numberingPrefixes, [key]: e.target.value.toUpperCase() } })}
                className="!py-1 !text-[11px] font-mono w-full"
              />
            </FieldLabel>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
