import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { ErpPageHeader, ErpButton, ErpSelect } from '../../components/erp';
import { DashboardContent } from './components/DashboardContent';
import { ModuleQuickLinks } from './components/ModuleQuickLinks';
import { DesignerDashboard } from './DesignerDashboard';
import { useDashboardData } from './useDashboardData';
import type { DashboardTab } from './dashboardUtils';
import { PRESET_OPTIONS, tabMeta } from './dashboardUtils';
import type { ReportDatePreset } from '../../types/api';
import { isDesignerWorkspace } from '../design/designUtils';

export function DashboardPage() {
  const { permissions, user } = useAuth();
  if (isDesignerWorkspace(permissions, !!user?.isSuperAdmin)) {
    return <DesignerDashboard />;
  }
  return <FactoryDashboard />;
}

function FactoryDashboard() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [preset, setPreset] = useState<ReportDatePreset>('mtd');
  const data = useDashboardData(preset);
  const meta = tabMeta(tab);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    qc.invalidateQueries({ queryKey: ['dashboard-factory'] });
    qc.invalidateQueries({ queryKey: ['dashboard-production-report'] });
    qc.invalidateQueries({ queryKey: ['dashboard-purchase-report'] });
    qc.invalidateQueries({ queryKey: ['dashboard-quality-report'] });
    qc.invalidateQueries({ queryKey: ['dashboard-financial'] });
    qc.invalidateQueries({ queryKey: ['dashboard-low-stock'] });
    qc.invalidateQueries({ queryKey: ['production-stats'] });
    qc.invalidateQueries({ queryKey: ['quality-pending'] });
    qc.invalidateQueries({ queryKey: ['waste-stats'] });
    qc.invalidateQueries({ queryKey: ['notifications-stats'] });
  };

  const canSeeAnalytics = data.hasReport || permissions.includes('*');

  return (
    <div className="space-y-5">
      <ErpPageHeader
        title="Factory Analytics"
        subtitle={meta.subtitle}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {canSeeAnalytics && (
              <>
                <label className="flex items-center gap-2">
                  <span className="text-[10px] text-erp-text-muted">Period</span>
                  <ErpSelect
                    value={preset}
                    onChange={(e) => setPreset(e.target.value as ReportDatePreset)}
                    className="min-w-[130px]"
                  >
                    {PRESET_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </ErpSelect>
                </label>
                <ErpButton variant="secondary" onClick={refresh} disabled={data.isLoading}>
                  <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${data.isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </ErpButton>
              </>
            )}
            <Link to="/reports/factory">
              <ErpButton variant="secondary">
                <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
                Full reports
              </ErpButton>
            </Link>
          </div>
        )}
      />

      {data.isLoading ? (
        <div className="erp-card flex items-center justify-center p-12">
          <p className="text-sm text-erp-text-muted">Loading analytics…</p>
        </div>
      ) : canSeeAnalytics ? (
        <DashboardContent tab={tab} onTabChange={setTab} data={data} />
      ) : (
        <div className="space-y-5">
          <div className="erp-card p-6 text-center">
            <p className="text-sm text-erp-text-muted">
              Dashboard analytics require report access. Use module navigation below.
            </p>
          </div>
          <ModuleQuickLinks permissions={permissions} />
        </div>
      )}
    </div>
  );
}
