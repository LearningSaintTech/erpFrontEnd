import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  Button, ErpSelect, IconButton, InfoBanner, PageHeader, Skeleton, KpiGrid,
} from '../../components/erp';
import { DashboardContent } from './components/DashboardContent';
import { ChartsLoadingContext } from './components/ChartPanels';
import { KpiStrip } from './components/KpiStrip';
import { ModuleQuickLinks } from './components/ModuleQuickLinks';
import { AttentionList, greeting } from './components/AttentionList';
import { DesignerDashboard } from './DesignerDashboard';
import { useDashboardData } from './useDashboardData';
import type { DashboardTab } from './dashboardUtils';
import { PRESET_OPTIONS, presetLabel } from './dashboardUtils';
import type { ReportDatePreset } from '../../types/api';
import { isDesignerWorkspace } from '../design/designUtils';

const DASHBOARD_QUERY_KEYS = [
  'dashboard-stats', 'dashboard-factory', 'dashboard-production-report', 'dashboard-purchase-report',
  'dashboard-quality-report', 'dashboard-financial', 'dashboard-low-stock', 'production-stats',
  'inventory-stats', 'purchase-stats', 'quality-stats', 'approvals-stats', 'quality-pending',
  'waste-stats', 'notifications-stats', 'pos-dashboard', 'production-orders-dashboard',
];

export function DashboardPage() {
  const { permissions, user } = useAuth();
  if (isDesignerWorkspace(permissions, !!user?.isSuperAdmin)) {
    return <DesignerDashboard />;
  }
  return <FactoryDashboard />;
}

/** Period selector shared by the dashboard header (same options as Reports). */
export function PeriodSelect({ value, onChange }: { value: ReportDatePreset; onChange: (v: ReportDatePreset) => void }) {
  return (
    <ErpSelect
      inputSize="sm"
      value={value}
      onChange={(e) => onChange(e.target.value as ReportDatePreset)}
      aria-label="Period"
      className="min-w-[150px]"
    >
      {PRESET_OPTIONS.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </ErpSelect>
  );
}

function FactoryDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { permissions, user, factories, factoryId } = useAuth();
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [preset, setPreset] = useState<ReportDatePreset>('mtd');
  const data = useDashboardData(preset);
  const fetching = useIsFetching({
    predicate: (q) => DASHBOARD_QUERY_KEYS.includes(String(q.queryKey[0])),
  }) > 0;

  const refresh = () => {
    DASHBOARD_QUERY_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  };

  const canSeeAnalytics = data.hasReport || permissions.includes('*');
  const factory = factories.find((f) => f._id === factoryId);
  const firstName = user?.firstName?.trim();

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={factory
          ? `Here is what needs attention at ${factory.name} today.`
          : 'Here is what needs your attention today.'}
        secondaryActions={canSeeAnalytics ? (
          <>
            <PeriodSelect value={preset} onChange={setPreset} />
            <IconButton
              aria-label="Refresh dashboard"
              outlined
              size="sm"
              onClick={refresh}
              loading={fetching}
            >
              <RefreshCw size={16} />
            </IconButton>
          </>
        ) : undefined}
        primaryAction={canSeeAnalytics ? (
          <Button variant="secondary" size="sm" icon={<BarChart3 size={16} />} onClick={() => navigate('/reports/factory')}>
            Full reports
          </Button>
        ) : undefined}
      />

      <AttentionList items={data.attention} isLoading={data.attentionLoading} />

      {canSeeAnalytics ? (
        <>
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-erp-text-primary">Key numbers</h2>
              <span className="text-xs text-erp-text-muted">{presetLabel(preset)}</span>
            </div>
            {data.isLoading ? (
              <KpiGrid cols={6}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="erp-stat-tile bg-[var(--erp-surface)] px-4 py-3.5">
                    <Skeleton width="50%" />
                    <Skeleton className="mt-2" width="70%" height={24} />
                  </div>
                ))}
              </KpiGrid>
            ) : (
              <KpiStrip
                kpis={data.kpis}
                hasProductionData={data.hasProductionData}
                hasInspections={data.inspectionsTotal > 0}
              />
            )}
          </div>
          <ChartsLoadingContext.Provider value={data.isLoading || data.attentionLoading}>
            <DashboardContent tab={tab} onTabChange={setTab} data={data} />
          </ChartsLoadingContext.Provider>
        </>
      ) : (
        <ModuleQuickLinks permissions={permissions} title="Your workspace" />
      )}
    </div>
  );
}
