import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ToggleRight } from 'lucide-react';
import { settingsApi } from '../../../services/admin';
import type { FeatureFlagDefinition, FeatureFlagsSettings } from '../../../types/api';
import { EmptyState, Section } from '../../../components/erp';
import { SaveBar } from '../SettingsSection';
import { SettingsSkeleton } from './GeneralSettingsTab';
import { Switch } from './IntegrationsSettingsTab';

export function FeatureFlagsSettingsTab({ onDirtyChange, factoryScoped }: {
  onDirtyChange?: (dirty: boolean) => void;
  /** True when a factory is selected (flags may override per site). */
  factoryScoped?: boolean;
}) {
  const qc = useQueryClient();
  const { data: catalog = [], isLoading: catalogLoading } = useQuery<FeatureFlagDefinition[]>({
    queryKey: ['feature-flag-catalog'],
    queryFn: settingsApi.getFeatureFlagCatalog,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['settings-flags'],
    queryFn: settingsApi.getFeatureFlags,
  });

  const [flags, setFlags] = useState<FeatureFlagsSettings>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) { setFlags(data); setDirty(false); }
  }, [data]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateFeatureFlags(flags),
    meta: { successMessage: 'Feature flags saved' },
    onSuccess: (saved) => {
      setFlags(saved);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['settings-flags'] });
    },
  });

  if (isLoading || catalogLoading) return <SettingsSkeleton />;

  return (
    <div className="space-y-4">
      <Section
        title="Feature flags"
        description={factoryScoped
          ? 'Turn modules and behaviours on or off for the selected factory.'
          : 'Turn modules and behaviours on or off for the whole organization.'}
        flush
      >
        {catalog.length === 0 ? (
          <EmptyState icon={ToggleRight} title="No feature flags available" />
        ) : (
          <ul className="divide-y divide-[var(--erp-border)]">
            {catalog.map((f) => (
              <li key={f.key} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-erp-text-primary">{f.label}</p>
                  {f.description && <p className="mt-0.5 text-[13px] text-erp-text-muted">{f.description}</p>}
                  <p className="mt-0.5 font-mono text-xs text-erp-text-muted">{f.key}</p>
                </div>
                <Switch
                  checked={!!flags[f.key]}
                  label={f.label ?? f.key}
                  onChange={(v) => { setFlags((cur) => ({ ...cur, [f.key]: v })); setDirty(true); }}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        onSave={() => save.mutate()}
        onDiscard={() => { if (data) setFlags(data); setDirty(false); }}
        saveLabel="Save flags"
      />
    </div>
  );
}
