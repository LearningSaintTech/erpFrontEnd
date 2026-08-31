import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../services/admin';
import type { GeneralSettings } from '../../../types/api';
import { ErpButton, ErpInput, ErpSelect } from '../../../components/erp';
import { FieldLabel, SettingsSection } from '../SettingsSection';
import {
  CURRENCY_OPTIONS, DATE_FORMAT_OPTIONS, TIMEZONE_OPTIONS, UOM_OPTIONS,
} from '../settingsUtils';

export function GeneralSettingsTab({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings-general'],
    queryFn: settingsApi.getGeneral,
  });

  const [form, setForm] = useState<GeneralSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(data);
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateGeneral(form!),
    onSuccess: (saved) => {
      setForm(saved);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['settings-general'] });
      onSuccess('Organization preferences saved');
    },
    onError: (e: Error) => onError(e.message),
  });

  if (isLoading || !form) {
    return <p className="text-[11px] text-erp-text-muted">Loading organization settings…</p>;
  }

  const set = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setDirty(true);
  };

  return (
    <div className="space-y-3">
      <SettingsSection
        title="Regional & display"
        description="Defaults for dates, currency, and locale across the organization."
        actions={dirty && (
          <ErpButton className="!px-2 !py-1 text-[10px]" disabled={save.isPending} onClick={() => save.mutate()}>
            Save changes
          </ErpButton>
        )}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <FieldLabel label="Timezone">
            <ErpSelect value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className="!py-1 !text-[11px] w-full">
              {TIMEZONE_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </ErpSelect>
          </FieldLabel>
          <FieldLabel label="Currency">
            <ErpSelect value={form.currency} onChange={(e) => set('currency', e.target.value)} className="!py-1 !text-[11px] w-full">
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </ErpSelect>
          </FieldLabel>
          <FieldLabel label="Date format">
            <ErpSelect value={form.dateFormat} onChange={(e) => set('dateFormat', e.target.value)} className="!py-1 !text-[11px] w-full">
              {DATE_FORMAT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </ErpSelect>
          </FieldLabel>
          <FieldLabel label="Locale">
            <ErpInput value={form.locale} onChange={(e) => set('locale', e.target.value)} className="!py-1 !text-[11px] w-full" />
          </FieldLabel>
          <FieldLabel label="Fiscal year starts (month)" hint="1 = January, 4 = April">
            <ErpInput
              type="number"
              min={1}
              max={12}
              value={form.fiscalYearStartMonth}
              onChange={(e) => set('fiscalYearStartMonth', Number(e.target.value))}
              className="!py-1 !text-[11px] w-full"
            />
          </FieldLabel>
          <FieldLabel label="Default UOM">
            <ErpSelect value={form.defaultUom} onChange={(e) => set('defaultUom', e.target.value)} className="!py-1 !text-[11px] w-full">
              {UOM_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </ErpSelect>
          </FieldLabel>
        </div>
      </SettingsSection>

      <SettingsSection title="Inventory alerts" description="When to surface low-stock warnings on the dashboard.">
        <FieldLabel label="Low stock alert (days of cover)">
          <ErpInput
            type="number"
            min={1}
            max={90}
            value={form.lowStockAlertDays}
            onChange={(e) => set('lowStockAlertDays', Number(e.target.value))}
            className="!py-1 !text-[11px] max-w-[8rem]"
          />
        </FieldLabel>
      </SettingsSection>
    </div>
  );
}
