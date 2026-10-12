import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../services/admin';
import type { GeneralSettings } from '../../../types/api';
import { ErpInput, ErpSelect, Field, Skeleton } from '../../../components/erp';
import { SaveBar, SettingsSection } from '../SettingsSection';
import {
  CURRENCY_OPTIONS, DATE_FORMAT_OPTIONS, TIMEZONE_OPTIONS, UOM_OPTIONS,
} from '../settingsUtils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function SettingsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading settings">
      {[0, 1].map((i) => (
        <div key={i} className="erp-card space-y-3 p-4">
          <Skeleton width="30%" height={14} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton height={36} /><Skeleton height={36} /><Skeleton height={36} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GeneralSettingsTab({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings-general'],
    queryFn: settingsApi.getGeneral,
  });

  const [form, setForm] = useState<GeneralSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) { setForm(data); setDirty(false); }
  }, [data]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateGeneral(form!),
    meta: { successMessage: 'Organization preferences saved' },
    onSuccess: (saved) => {
      setForm(saved);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['settings-general'] });
    },
  });

  if (isLoading || !form) return <SettingsSkeleton />;

  const set = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <SettingsSection title="Regional and display" description="Defaults for dates, currency and language across the organization.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Timezone">
            <ErpSelect value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
              {TIMEZONE_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Currency">
            <ErpSelect value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Date format">
            <ErpSelect value={form.dateFormat} onChange={(e) => set('dateFormat', e.target.value)}>
              {DATE_FORMAT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Locale" hint="Language and number format, e.g. en-IN.">
            <ErpInput value={form.locale} onChange={(e) => set('locale', e.target.value)} />
          </Field>
          <Field label="Fiscal year starts in">
            <ErpSelect value={form.fiscalYearStartMonth} onChange={(e) => set('fiscalYearStartMonth', Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Default unit of measure">
            <ErpSelect value={form.defaultUom} onChange={(e) => set('defaultUom', e.target.value)}>
              {UOM_OPTIONS.map((u) => <option key={u} value={u}>{u.charAt(0) + u.slice(1).toLowerCase()}</option>)}
            </ErpSelect>
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Inventory alerts" description="When the dashboard starts warning about low stock.">
        <Field label="Warn when stock covers fewer than (days)" hint="Days of expected usage, 1–90." className="max-w-xs">
          <ErpInput
            type="number"
            min={1}
            max={90}
            value={form.lowStockAlertDays}
            onChange={(e) => set('lowStockAlertDays', Number(e.target.value))}
          />
        </Field>
      </SettingsSection>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        onSave={() => save.mutate()}
        onDiscard={() => { if (data) setForm(data); setDirty(false); }}
      />
    </div>
  );
}
