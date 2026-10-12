import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, ArrowUp, Factory, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { settingsApi } from '../../../services/admin';
import type { FactorySettings } from '../../../types/api';
import {
  Button, EmptyState, ErpInput, Field, IconButton, InfoBanner, Section,
} from '../../../components/erp';
import { SaveBar, SettingsSection } from '../SettingsSection';
import { SettingsSkeleton } from './GeneralSettingsTab';
import {
  DEFAULT_PRODUCTION_STAGES, WORKING_DAY_LABELS,
} from '../settingsUtils';

function normalize(data: FactorySettings): FactorySettings {
  return {
    ...data,
    shifts: data.shifts?.length ? data.shifts : [{ name: 'General', startTime: '09:00', endTime: '18:00' }],
    workingDays: data.workingDays?.length ? data.workingDays : [1, 2, 3, 4, 5, 6],
    productionStages: data.productionStages?.length ? data.productionStages : [...DEFAULT_PRODUCTION_STAGES],
    numberingPrefixes: data.numberingPrefixes || {},
    defaultWarehouses: data.defaultWarehouses || {},
  };
}

const stageLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function FactorySettingsTab({
  factoryId,
  factoryName,
  canEdit,
  onDirtyChange,
}: {
  factoryId: string | null;
  factoryName?: string;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
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
  const [stageError, setStageError] = useState('');

  useEffect(() => {
    if (data) { setForm(normalize(data)); setDirty(false); }
  }, [data]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateFactorySettings(factoryId!, form!),
    meta: { successMessage: 'Factory settings saved' },
    onSuccess: (saved) => {
      setForm(normalize(saved));
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['factory-settings', factoryId] });
    },
  });

  if (!factoryId) {
    return (
      <Section>
        <EmptyState icon={Factory} title="Select a factory" description="Factory settings apply to one site. Choose it from the switcher in the header." />
      </Section>
    );
  }

  if (isLoading || !form) return <SettingsSkeleton />;

  const patch = (partial: Partial<FactorySettings>) => {
    setForm((f) => (f ? { ...f, ...partial } : f));
    setDirty(true);
  };



  const toggleDay = (day: number) => {
    const days = form.workingDays.includes(day)
      ? form.workingDays.filter((d) => d !== day)
      : [...form.workingDays, day].sort();
    patch({ workingDays: days });
  };

  const addStage = () => {
    const stage = newStage.trim().toUpperCase().replace(/\s+/g, '_');
    if (!stage) { setStageError('Enter a stage name.'); return; }
    // Mirrors the server rules (settings.controller factorySettingsSchema) so the user finds out here, not on save.
    if (stage === 'QC' || stage === 'COMPLETED') {
      setStageError(`${stage === 'QC' ? 'QC' : 'Completed'} is added automatically at the end — no need to add it.`);
      return;
    }
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(stage) || stage.length > 40) {
      setStageError('Use letters, digits, spaces, "_" or "-" (max 40 characters).');
      return;
    }
    if (form.productionStages.includes(stage)) { setStageError('That stage is already in the list.'); return; }
    patch({ productionStages: [...form.productionStages, stage] });
    setNewStage('');
    setStageError('');
  };

  const moveStage = (i: number, dir: -1 | 1) => {
    const next = [...form.productionStages];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    patch({ productionStages: next });
  };

  return (
    <div className="space-y-4">
      {!canEdit && (
        <InfoBanner inset={false} tone="muted">You can view these settings. Editing needs the factory configuration permission.</InfoBanner>
      )}
      {factoryName && <p className="text-[13px] text-erp-text-muted">Settings for <span className="font-medium text-erp-text-primary">{factoryName}</span>.</p>}

      <SettingsSection title="Working shifts" description="Shifts are managed in one place — the list batches and schedules use.">
        <Link to="/production/machines?tab=shifts" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--erp-accent-text)] hover:underline">
          Manage shifts in Machines &amp; capacity <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </SettingsSection>

      <SettingsSection title="Working days" description="Days the factory normally runs.">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Working days">
          {WORKING_DAY_LABELS.map((label, day) => {
            const on = form.workingDays.includes(day);
            return (
              <button
                key={label}
                type="button"
                disabled={!canEdit}
                aria-pressed={on}
                onClick={() => toggleDay(day)}
                className={`h-9 min-w-[3.25rem] rounded-md border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-accent)] disabled:cursor-default ${
                  on
                    ? 'border-[var(--erp-accent)] bg-[var(--erp-accent-subtle)] text-[var(--erp-accent-text)]'
                    : 'border-[var(--erp-border)] bg-[var(--erp-surface)] text-erp-text-muted hover:border-[var(--erp-border-strong)]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Production stages" description="The order batches move through on the floor.">
        <ol className="divide-y divide-[var(--erp-border)] rounded-lg border border-[var(--erp-border)]">
          {form.productionStages.map((stage, i) => (
            <li key={stage} className="flex items-center gap-3 px-3 py-2">
              <span className="erp-tabular w-6 text-center text-xs text-erp-text-muted">{i + 1}</span>
              <span className="flex-1 text-[13px] font-medium text-erp-text-primary">{stageLabel(stage)}</span>
              {canEdit && (
                <span className="flex items-center gap-0.5">
                  <IconButton aria-label={`Move ${stageLabel(stage)} up`} size="sm" disabled={i === 0} onClick={() => moveStage(i, -1)}><ArrowUp size={16} /></IconButton>
                  <IconButton aria-label={`Move ${stageLabel(stage)} down`} size="sm" disabled={i === form.productionStages.length - 1} onClick={() => moveStage(i, 1)}><ArrowDown size={16} /></IconButton>
                  <IconButton aria-label={`Remove ${stageLabel(stage)}`} size="sm" disabled={form.productionStages.length <= 1} onClick={() => patch({ productionStages: form.productionStages.filter((s) => s !== stage) })}><X size={16} /></IconButton>
                </span>
              )}
            </li>
          ))}
        </ol>
        {canEdit && (
          <div className="mt-3 flex flex-wrap items-start gap-2">
            <Field error={stageError} className="w-full sm:w-64">
              <ErpInput
                value={newStage}
                onChange={(e) => { setNewStage(e.target.value); setStageError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStage(); } }}
                placeholder="New stage, e.g. Packing"
                aria-label="New stage name"
              />
            </Field>
            <Button variant="secondary" icon={<Plus size={16} />} onClick={addStage}>Add stage</Button>
          </div>
        )}
      </SettingsSection>

      {canEdit && (
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          onSave={() => save.mutate()}
          onDiscard={() => { if (data) setForm(normalize(data)); setDirty(false); }}
        />
      )}
    </div>
  );
}
