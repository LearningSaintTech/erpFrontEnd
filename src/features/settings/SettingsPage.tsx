import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { settingsApi } from '../../services/admin';
import { ErpPageHeader, ErpButton, ErpTabs, ErpCard } from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab';
import { FactorySettingsTab } from './tabs/FactorySettingsTab';
import { IntegrationsSettingsTab } from './tabs/IntegrationsSettingsTab';
import { FeatureFlagsSettingsTab } from './tabs/FeatureFlagsSettingsTab';
import { AccountSettingsTab } from './tabs/AccountSettingsTab';

const TABS = [
  { id: 'general', label: 'Organization' },
  { id: 'factory-settings', label: 'Factory' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'feature-flags', label: 'Feature flags' },
  { id: 'account', label: 'My account' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function normalizeSection(section?: string): TabId {
  if (section === 'general') return 'general';
  if (section === 'integrations') return 'integrations';
  if (section === 'feature-flags') return 'feature-flags';
  if (section === 'account') return 'account';
  return 'factory-settings';
}

export function SettingsPage() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { factoryId, permissions } = useAuth();
  const active = normalizeSection(section);

  const canConfigure = permissions.includes('*') || permissions.includes('settings.configure');
  const canFactoryConfigure = permissions.includes('*') || permissions.includes('factory.configure');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const { data: readiness, refetch, isFetching } = useQuery({
    queryKey: ['settings-readiness'],
    queryFn: settingsApi.getReadiness,
    enabled: canConfigure,
  });

  const readinessChecks = useMemo(() => {
    const checks = (readiness as { checks?: Record<string, string> })?.checks;
    if (!checks) return [];
    return Object.entries(checks);
  }, [readiness]);

  const onTabChange = (id: string) => navigate(`/settings/${id}`);

  return (
    <div className="settings-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Settings"
        subtitle={(
          <>
            Organization preferences, factory operations, integrations, and feature toggles.
            <Link to="/approvals" className="ml-1.5 inline-flex items-center gap-0.5 text-[var(--erp-accent)]">
              Approval workflows <ExternalLink size={10} />
            </Link>
            <Link to="/settings/inventory-codes" className="ml-2 text-[var(--erp-accent)]">
              Inventory codes →
            </Link>
          </>
        )}
        actions={canConfigure && (
          <ErpButton variant="secondary" className="!px-2 !py-1 text-[11px] inline-flex items-center gap-1" disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </ErpButton>
        )}
      />

      {canConfigure && readinessChecks.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {readinessChecks.map(([key, status]) => (
            <ErpCard key={key} className="!px-2.5 !py-1.5">
              <span className="text-[10px] capitalize text-erp-text-muted">{key}</span>
              <span className={`ml-1.5 text-[10px] font-medium ${status === 'ok' || status === 'configured' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {status}
              </span>
            </ErpCard>
          ))}
        </div>
      )}

      <div className="mb-3">
        <ErpTabs tabs={[...TABS]} active={active} onChange={onTabChange} />
      </div>

      {!canConfigure && active !== 'account' && (
        <ErpCard className="mb-3 !p-3 text-[11px] text-erp-text-muted">
          You need <span className="font-mono">settings.configure</span> permission to edit these settings. Account tab is always available.
        </ErpCard>
      )}

      {active === 'general' && canConfigure && (
        <GeneralSettingsTab onError={setError} onSuccess={showSuccess} />
      )}
      {active === 'factory-settings' && (
        <FactorySettingsTab factoryId={factoryId} canEdit={canFactoryConfigure} onError={setError} onSuccess={showSuccess} />
      )}
      {active === 'integrations' && canConfigure && (
        <IntegrationsSettingsTab onError={setError} onSuccess={showSuccess} />
      )}
      {active === 'feature-flags' && canConfigure && (
        <FeatureFlagsSettingsTab onError={setError} onSuccess={showSuccess} />
      )}
      {active === 'account' && (
        <AccountSettingsTab onError={setError} onSuccess={showSuccess} />
      )}
    </div>
  );
}
