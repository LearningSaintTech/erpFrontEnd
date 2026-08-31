import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../services/admin';
import type { FeatureFlagDefinition, FeatureFlagsSettings } from '../../../types/api';
import { ErpButton, ErpCard } from '../../../components/erp';

export function FeatureFlagsSettingsTab({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const qc = useQueryClient();
  const { data: catalog = [] } = useQuery<FeatureFlagDefinition[]>({
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
    if (data) {
      setFlags(data);
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateFeatureFlags(flags),
    onSuccess: (saved) => {
      setFlags(saved);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['settings-flags'] });
      onSuccess('Feature flags saved');
    },
    onError: (e: Error) => onError(e.message),
  });

  if (isLoading) {
    return <p className="text-[11px] text-erp-text-muted">Loading feature flags…</p>;
  }

  const toggle = (key: string) => {
    setFlags((f) => ({ ...f, [key]: !f[key] }));
    setDirty(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-erp-text-muted">
          Toggle modules and behaviors. Org-level flags apply when no factory is selected; with a factory selected, flags can override per site.
        </p>
        {dirty && (
          <ErpButton className="!px-3 !py-1 text-[11px]" disabled={save.isPending} onClick={() => save.mutate()}>
            Save flags
          </ErpButton>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {catalog.map((f) => (
          <ErpCard key={f.key} className="!p-2.5">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                checked={!!flags[f.key]}
                onChange={() => toggle(f.key)}
              />
              <span>
                <span className="block text-[11px] font-medium text-erp-text-primary">{f.label}</span>
                <span className="block text-[10px] text-erp-text-muted">{f.description}</span>
                <span className="mt-0.5 block font-mono text-[9px] text-erp-text-muted">{f.key}</span>
              </span>
            </label>
          </ErpCard>
        ))}
      </div>
    </div>
  );
}
