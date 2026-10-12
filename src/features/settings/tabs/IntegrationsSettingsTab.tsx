import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../services/admin';
import type { IntegrationsSettings } from '../../../types/api';
import { ErpInput, ErpSelect, Field } from '../../../components/erp';
import { SaveBar, SettingsSection } from '../SettingsSection';
import { SettingsSkeleton } from './GeneralSettingsTab';
import { SECRET_MASK } from '../settingsUtils';

/** Accessible on/off switch. */
export function Switch({
  checked, onChange, disabled, label,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 text-[13px] font-medium text-erp-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-[var(--erp-accent)] group-focus-visible:ring-offset-2 ${
          checked ? 'bg-[var(--erp-accent)]' : 'bg-[var(--erp-border-strong)]'
        }`}
        aria-hidden="true"
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
      <span>{checked ? 'On' : 'Off'}</span>
    </button>
  );
}

export function IntegrationsSettingsTab({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings-integrations'],
    queryFn: settingsApi.getIntegrations,
  });

  const [form, setForm] = useState<IntegrationsSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [eventsText, setEventsText] = useState('');

  useEffect(() => {
    if (data) { setForm(data); setEventsText(data.webhook.events.join(', ')); setDirty(false); }
  }, [data]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateIntegrations(form!),
    meta: { successMessage: 'Integration settings saved' },
    onSuccess: (saved) => {
      setForm(saved);
      setEventsText(saved.webhook.events.join(', '));
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['settings-integrations'] });
    },
  });

  if (isLoading || !form) return <SettingsSkeleton />;

  const patch = (partial: Partial<IntegrationsSettings>) => {
    setForm((f) => (f ? { ...f, ...partial } : f));
    setDirty(true);
  };
  const email = (p: Partial<IntegrationsSettings['email']>) => patch({ email: { ...form.email, ...p } });
  const sms = (p: Partial<IntegrationsSettings['sms']>) => patch({ sms: { ...form.sms, ...p } });
  const webhook = (p: Partial<IntegrationsSettings['webhook']>) => patch({ webhook: { ...form.webhook, ...p } });

  return (
    <div className="space-y-4">
      <SettingsSection
        title="Email (SMTP)"
        description="Sends approval, payment and alert emails."
        actions={<Switch checked={form.email.enabled} onChange={(v) => email({ enabled: v })} label="Email sending" />}
      >
        <fieldset disabled={!form.email.enabled} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="SMTP host"><ErpInput value={form.email.host} onChange={(e) => email({ host: e.target.value })} placeholder="smtp.example.com" /></Field>
          <Field label="Port"><ErpInput type="number" value={form.email.port} onChange={(e) => email({ port: Number(e.target.value) })} /></Field>
          <Field label="Username"><ErpInput value={form.email.user} onChange={(e) => email({ user: e.target.value })} autoComplete="off" /></Field>
          <Field label="Password" hint="Leave the masked value to keep the saved password.">
            <ErpInput type="password" value={form.email.password} onChange={(e) => email({ password: e.target.value })} placeholder={SECRET_MASK} autoComplete="new-password" />
          </Field>
          <Field label="From name"><ErpInput value={form.email.fromName} onChange={(e) => email({ fromName: e.target.value })} /></Field>
          <Field label="From email"><ErpInput type="email" value={form.email.fromEmail} onChange={(e) => email({ fromEmail: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-[13px] text-erp-text-secondary sm:col-span-full">
            <input type="checkbox" className="h-4 w-4 rounded accent-[var(--erp-accent)]" checked={form.email.secure} onChange={(e) => email({ secure: e.target.checked })} />
            Use TLS/SSL
          </label>
        </fieldset>
      </SettingsSection>

      <SettingsSection
        title="SMS"
        description="Sends sign-in codes and urgent alerts by text message."
        actions={<Switch checked={form.sms.enabled} onChange={(v) => sms({ enabled: v })} label="SMS sending" />}
      >
        <fieldset disabled={!form.sms.enabled} className="grid gap-4 disabled:opacity-60 sm:grid-cols-3">
          <Field label="Provider">
            <ErpSelect value={form.sms.provider} onChange={(e) => sms({ provider: e.target.value })}>
              <option value="twilio">Twilio</option>
              <option value="msg91">MSG91</option>
              <option value="custom">Custom</option>
            </ErpSelect>
          </Field>
          <Field label="API key"><ErpInput type="password" value={form.sms.apiKey} onChange={(e) => sms({ apiKey: e.target.value })} autoComplete="off" /></Field>
          <Field label="Sender ID"><ErpInput value={form.sms.senderId} onChange={(e) => sms({ senderId: e.target.value })} /></Field>
        </fieldset>
      </SettingsSection>

      <SettingsSection
        title="Outbound webhook"
        description="Posts an event to your system whenever a document changes state."
        actions={<Switch checked={form.webhook.enabled} onChange={(v) => webhook({ enabled: v })} label="Webhook" />}
      >
        <fieldset disabled={!form.webhook.enabled} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
          <Field label="Webhook URL"><ErpInput value={form.webhook.url} onChange={(e) => webhook({ url: e.target.value })} placeholder="https://…" /></Field>
          <Field label="Signing secret"><ErpInput type="password" value={form.webhook.secret} onChange={(e) => webhook({ secret: e.target.value })} autoComplete="off" /></Field>
          <Field label="Events" hint="Comma-separated, e.g. po.created, design.approved." className="sm:col-span-2">
            <ErpInput
              value={eventsText}
              onChange={(e) => {
                setEventsText(e.target.value);
                webhook({ events: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) });
              }}
            />
          </Field>
        </fieldset>
      </SettingsSection>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        onSave={() => save.mutate()}
        onDiscard={() => { if (data) { setForm(data); setEventsText(data.webhook.events.join(', ')); } setDirty(false); }}
      />
    </div>
  );
}
