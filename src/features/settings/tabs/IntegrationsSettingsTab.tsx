import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../services/admin';
import type { IntegrationsSettings } from '../../../types/api';
import { ErpButton, ErpInput, ErpSelect } from '../../../components/erp';
import { FieldLabel, SettingsSection } from '../SettingsSection';
import { SECRET_MASK } from '../settingsUtils';

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[11px]">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      <span>{label}</span>
    </label>
  );
}

export function IntegrationsSettingsTab({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings-integrations'],
    queryFn: settingsApi.getIntegrations,
  });

  const [form, setForm] = useState<IntegrationsSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(data);
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateIntegrations(form!),
    onSuccess: (saved) => {
      setForm(saved);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['settings-integrations'] });
      onSuccess('Integration settings saved');
    },
    onError: (e: Error) => onError(e.message),
  });

  if (isLoading || !form) {
    return <p className="text-[11px] text-erp-text-muted">Loading integrations…</p>;
  }

  const patch = (partial: Partial<IntegrationsSettings>) => {
    setForm((f) => (f ? { ...f, ...partial } : f));
    setDirty(true);
  };

  return (
    <div className="space-y-3">
      {dirty && (
        <div className="flex justify-end">
          <ErpButton className="!px-3 !py-1 text-[11px]" disabled={save.isPending} onClick={() => save.mutate()}>
            Save integrations
          </ErpButton>
        </div>
      )}

      <SettingsSection
        title="Email (SMTP)"
        description="Transactional email for approvals, PO notifications, and alerts."
        actions={<Toggle checked={form.email.enabled} onChange={(v) => patch({ email: { ...form.email, enabled: v } })} label="Enabled" />}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <FieldLabel label="SMTP host">
            <ErpInput value={form.email.host} onChange={(e) => patch({ email: { ...form.email, host: e.target.value } })} className="!py-1 !text-[11px] w-full" />
          </FieldLabel>
          <FieldLabel label="Port">
            <ErpInput type="number" value={form.email.port} onChange={(e) => patch({ email: { ...form.email, port: Number(e.target.value) } })} className="!py-1 !text-[11px] w-full" />
          </FieldLabel>
          <FieldLabel label="Username">
            <ErpInput value={form.email.user} onChange={(e) => patch({ email: { ...form.email, user: e.target.value } })} className="!py-1 !text-[11px] w-full" />
          </FieldLabel>
          <FieldLabel label="Password" hint="Leave masked value unchanged to keep current password">
            <ErpInput type="password" value={form.email.password} onChange={(e) => patch({ email: { ...form.email, password: e.target.value } })} className="!py-1 !text-[11px] w-full" placeholder={SECRET_MASK} />
          </FieldLabel>
          <FieldLabel label="From name">
            <ErpInput value={form.email.fromName} onChange={(e) => patch({ email: { ...form.email, fromName: e.target.value } })} className="!py-1 !text-[11px] w-full" />
          </FieldLabel>
          <FieldLabel label="From email">
            <ErpInput type="email" value={form.email.fromEmail} onChange={(e) => patch({ email: { ...form.email, fromEmail: e.target.value } })} className="!py-1 !text-[11px] w-full" />
          </FieldLabel>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[10px] text-erp-text-muted">
          <input type="checkbox" checked={form.email.secure} onChange={(e) => patch({ email: { ...form.email, secure: e.target.checked } })} />
          Use TLS/SSL
        </label>
      </SettingsSection>

      <SettingsSection
        title="SMS"
        description="OTP and alert SMS via your provider."
        actions={<Toggle checked={form.sms.enabled} onChange={(v) => patch({ sms: { ...form.sms, enabled: v } })} label="Enabled" />}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <FieldLabel label="Provider">
            <ErpSelect value={form.sms.provider} onChange={(e) => patch({ sms: { ...form.sms, provider: e.target.value } })} className="!py-1 !text-[11px] w-full">
              <option value="twilio">Twilio</option>
              <option value="msg91">MSG91</option>
              <option value="custom">Custom</option>
            </ErpSelect>
          </FieldLabel>
          <FieldLabel label="API key">
            <ErpInput type="password" value={form.sms.apiKey} onChange={(e) => patch({ sms: { ...form.sms, apiKey: e.target.value } })} className="!py-1 !text-[11px] w-full" />
          </FieldLabel>
          <FieldLabel label="Sender ID">
            <ErpInput value={form.sms.senderId} onChange={(e) => patch({ sms: { ...form.sms, senderId: e.target.value } })} className="!py-1 !text-[11px] w-full" />
          </FieldLabel>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Outbound webhook"
        description="POST events to your external system when documents change state."
        actions={<Toggle checked={form.webhook.enabled} onChange={(v) => patch({ webhook: { ...form.webhook, enabled: v } })} label="Enabled" />}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <FieldLabel label="Webhook URL">
            <ErpInput value={form.webhook.url} onChange={(e) => patch({ webhook: { ...form.webhook, url: e.target.value } })} className="!py-1 !text-[11px] w-full" placeholder="https://…" />
          </FieldLabel>
          <FieldLabel label="Signing secret">
            <ErpInput type="password" value={form.webhook.secret} onChange={(e) => patch({ webhook: { ...form.webhook, secret: e.target.value } })} className="!py-1 !text-[11px] w-full" />
          </FieldLabel>
        </div>
        <FieldLabel label="Events (comma-separated)" className="mt-2">
          <ErpInput
            value={form.webhook.events.join(', ')}
            onChange={(e) => patch({ webhook: { ...form.webhook, events: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })}
            className="!py-1 !text-[11px] w-full"
          />
        </FieldLabel>
      </SettingsSection>
    </div>
  );
}
