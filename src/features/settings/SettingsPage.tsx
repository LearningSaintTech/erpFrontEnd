import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Building2, ExternalLink, Factory, GitBranch, Plug, Tags, ToggleRight, UserCircle, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { settingsApi } from '../../services/admin';
import { Badge, InfoBanner, PageHeader, useConfirm } from '../../components/erp';
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab';
import { FactorySettingsTab } from './tabs/FactorySettingsTab';
import { IntegrationsSettingsTab } from './tabs/IntegrationsSettingsTab';
import { FeatureFlagsSettingsTab } from './tabs/FeatureFlagsSettingsTab';
import { AccountSettingsTab } from './tabs/AccountSettingsTab';

type TabId = 'general' | 'factory-settings' | 'integrations' | 'feature-flags' | 'account';

interface NavItem { id: TabId; label: string; description: string; icon: LucideIcon; visible: boolean }

const READINESS_LABELS: Record<string, string> = {
  database: 'Database',
  redis: 'Cache (Redis)',
  twofactor: 'Two-factor sign-in',
  smtp: 'Email',
  s3: 'File storage',
};

function normalizeSection(section?: string): TabId {
  if (section === 'general' || section === 'integrations' || section === 'feature-flags' || section === 'account') return section;
  return 'factory-settings';
}

export function SettingsPage() {
  const { section: sectionParam } = useParams<{ section?: string }>();
  const { pathname } = useLocation();
  // /settings/account is its own route (open to every role), so it has no :section param.
  const section = sectionParam ?? pathname.split('/').filter(Boolean)[1];
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { factoryId, factories, permissions } = useAuth();
  const requested = normalizeSection(section);

  const canConfigure = permissions.includes('*') || permissions.includes('settings.configure');
  const canFactoryConfigure = permissions.includes('*') || permissions.includes('factory.configure');
  const canInventoryCodes = permissions.includes('*') || permissions.includes('inventory.configure');
  const canWorkflows = permissions.includes('*') || permissions.includes('approval.read');

  const [dirty, setDirty] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);

  const nav: NavItem[] = [
    { id: 'general', label: 'Organization', description: 'Region, currency, fiscal year', icon: Building2, visible: canConfigure },
    { id: 'factory-settings', label: 'Factory', description: 'Working days, stages', icon: Factory, visible: canConfigure || canFactoryConfigure },
    { id: 'integrations', label: 'Integrations', description: 'Email, SMS, webhooks', icon: Plug, visible: canConfigure },
    { id: 'feature-flags', label: 'Feature flags', description: 'Turn features on or off', icon: ToggleRight, visible: canConfigure },
    { id: 'account', label: 'My account', description: 'Profile and password', icon: UserCircle, visible: true },
  ];
  const visibleNav = nav.filter((n) => n.visible);
  const active: TabId = visibleNav.some((n) => n.id === requested) ? requested : 'account';

  const { data: readiness } = useQuery({
    queryKey: ['settings-readiness'],
    queryFn: settingsApi.getReadiness,
    enabled: canConfigure,
  });
  const readinessChecks = useMemo(() => {
    const checks = (readiness as { checks?: Record<string, string> })?.checks;
    return checks ? Object.entries(checks) : [];
  }, [readiness]);

  const go = async (id: TabId) => {
    if (id === active) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        message: 'You have changes in this section that have not been saved.',
        confirmLabel: 'Discard changes',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setDirty(false);
    navigate(`/settings/${id}`);
  };

  const factory = factories.find((f) => f._id === factoryId);

  // On phones the section nav scrolls sideways — keep the active item visible.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Organization preferences, factory operations and your own account."
        meta={canConfigure && readinessChecks.length > 0 ? (
          <span className="hidden flex-wrap items-center gap-1.5 sm:flex">
            {readinessChecks.map(([key, status]) => {
              const ok = status === 'ok' || status === 'configured';
              return (
                <Badge key={key} tone={ok ? 'success' : 'warning'} title={`${key}: ${status}`}>
                  {READINESS_LABELS[key.toLowerCase()] ?? key.charAt(0).toUpperCase() + key.slice(1)} {ok ? 'ready' : 'not set up'}
                </Badge>
              );
            })}
          </span>
        ) : undefined}
      />

      {!canConfigure && !canFactoryConfigure && (
        <InfoBanner inset={false} tone="muted">
          Organization settings are managed by administrators. You can update your own password here.
        </InfoBanner>
      )}

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <nav ref={navRef} aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-4">
          <ul className="erp-hide-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {visibleNav.map((n) => {
              const Icon = n.icon;
              const on = n.id === active;
              return (
                <li key={n.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => go(n.id)}
                    aria-current={on ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-accent)] ${
                      on ? 'bg-[var(--erp-accent-subtle)] text-[var(--erp-accent-text)]' : 'text-erp-text-secondary hover:bg-[var(--erp-surface-muted)]'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-sm font-medium">{n.label}</span>
                      <span className="hidden truncate text-xs text-erp-text-muted lg:block">{n.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {(canInventoryCodes || canWorkflows) && (
              <li className="hidden px-3 pb-1 pt-4 text-xs font-medium text-erp-text-muted lg:block">Related</li>
            )}
            {canInventoryCodes && (
              <li className="shrink-0">
                <Link to="/settings/inventory-codes" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-erp-text-secondary hover:bg-[var(--erp-surface-muted)]">
                  <Tags size={18} aria-hidden="true" /> <span className="whitespace-nowrap">Inventory codes</span>
                  <ExternalLink size={14} className="ml-auto hidden text-erp-text-muted lg:block" aria-hidden="true" />
                </Link>
              </li>
            )}
            {canWorkflows && (
              <li className="shrink-0">
                <Link to="/approvals?tab=workflows" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-erp-text-secondary hover:bg-[var(--erp-surface-muted)]">
                  <GitBranch size={18} aria-hidden="true" /> <span className="whitespace-nowrap">Approval workflows</span>
                  <ExternalLink size={14} className="ml-auto hidden text-erp-text-muted lg:block" aria-hidden="true" />
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="min-w-0">
          {active === 'general' && <GeneralSettingsTab onDirtyChange={onDirtyChange} />}
          {active === 'factory-settings' && (
            <FactorySettingsTab
              factoryId={factoryId}
              factoryName={factory?.name}
              canEdit={canFactoryConfigure}
              onDirtyChange={onDirtyChange}
            />
          )}
          {active === 'integrations' && <IntegrationsSettingsTab onDirtyChange={onDirtyChange} />}
          {active === 'feature-flags' && <FeatureFlagsSettingsTab onDirtyChange={onDirtyChange} factoryScoped={!!factoryId} />}
          {active === 'account' && <AccountSettingsTab />}
        </div>
      </div>
    </div>
  );
}
