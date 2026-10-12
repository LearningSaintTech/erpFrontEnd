import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { reportApi } from '../../services/reports';
import type {
  ApprovalReport, EmployeeReport, FactoryReport, FinancialReport, InventoryReport,
  MachineReport, ProductionReport, PurchaseReport, QualityReport, ReportDatePreset,
  ReportPeriod, ReportTabId, WasteReport,
} from '../../types/api';
import {
  Button, EmptyState, IconButton, KpiGrid, PageHeader, Section, Skeleton, Tabs, toast,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { useAuth } from '../../app/providers/AuthProvider';
import { formatPeriod, REPORT_TABS } from './reportsUtils';
import { PeriodSelect } from '../dashboard/DashboardPage';
import { getApiErrorMessage } from '../../utils/errors';
import {
  ApprovalTab, EmployeeTab, FactoryTab, FinancialTab, InventoryTab, MachineTab, ProductionTab,
  PurchaseTab, QualityTab, WasteTab,
} from './components/ReportTabs';

const VALID_REPORT_TABS: ReportTabId[] = REPORT_TABS.map((t) => t.id);

function defaultReportTab(permissions: string[]): ReportTabId {
  if (permissions.includes('*')) return 'factory';
  const has = (p: string) => permissions.includes(p);
  if ((has('quality.approve') || has('quality.configure')) && !has('production.configure')) return 'quality';
  if (has('purchase.read') && has('report.read') && !has('production.read')) return 'financial';
  if (has('production.read')) return 'production';
  if (has('inventory.read')) return 'inventory';
  return 'factory';
}

function reportPeriod(data: unknown): ReportPeriod | null {
  if (!data || typeof data !== 'object' || !('period' in data)) return null;
  const p = (data as { period?: ReportPeriod | null }).period;
  return p ?? null;
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading report">
      <KpiGrid cols={6}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="erp-stat-tile bg-[var(--erp-surface)] px-4 py-3.5">
            <Skeleton width="50%" /><Skeleton className="mt-2" width="70%" height={24} />
          </div>
        ))}
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="erp-card p-4"><Skeleton height={180} /></div>
        <div className="erp-card p-4"><Skeleton height={180} /></div>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canRead = permissions.includes('*') || permissions.includes('report.read');
  const canExport = permissions.includes('*') || permissions.includes('report.export');

  useEffect(() => {
    if (!canRead) return;
    const valid = tabParam && VALID_REPORT_TABS.includes(tabParam as ReportTabId);
    if (!valid) navigate(`/reports/${defaultReportTab(permissions)}`, { replace: true });
  }, [tabParam, permissions, canRead, navigate]);

  const activeTab = (VALID_REPORT_TABS.includes(tabParam as ReportTabId) ? tabParam : defaultReportTab(permissions)) as ReportTabId;
  const meta = REPORT_TABS.find((t) => t.id === activeTab) ?? REPORT_TABS[0];
  const [preset, setPreset] = useState<ReportDatePreset>('all');
  const [exporting, setExporting] = useState(false);
  const filters = { preset };

  const tabFetchers: Record<ReportTabId, (f: typeof filters) => Promise<unknown>> = {
    factory: reportApi.factory,
    production: reportApi.production,
    inventory: reportApi.inventory,
    purchase: reportApi.purchase,
    quality: reportApi.quality,
    waste: reportApi.waste,
    machine: reportApi.machine,
    employee: reportApi.employee,
    financial: reportApi.financial,
    approval: reportApi.approval,
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['reports', activeTab, preset],
    queryFn: () => tabFetchers[activeTab](filters),
    enabled: canRead,
  });

  const selectTab = (id: string) => navigate(`/reports/${id}`, { replace: true });

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await reportApi.exportCsv(activeTab, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}-report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${meta.label} report exported`);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  if (!canRead) {
    return (
      <div className="space-y-4">
        <PageHeader title="Reports" description="Operational reports for every module." />
        <Section><EmptyState icon={BarChart3} title="You don't have access to reports" description="Ask an administrator for the report permission." /></Section>
      </div>
    );
  }

  const period = reportPeriod(data);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Operational reports for every module, for the period you choose."
        secondaryActions={(
          <>
            <PeriodSelect value={preset} onChange={setPreset} />
            <IconButton aria-label="Refresh report" outlined size="sm" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw size={16} />
            </IconButton>
          </>
        )}
        primaryAction={canExport ? (
          <Button variant="secondary" size="sm" icon={<Download size={16} />} onClick={handleExport} loading={exporting}>
            Export CSV
          </Button>
        ) : undefined}
      />

      <Tabs
        tabs={REPORT_TABS.map((t) => ({ id: t.id, label: t.label }))}
        active={activeTab}
        onChange={selectTab}
        ariaLabel="Report"
      />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-erp-text-secondary">{meta.subtitle}</p>
        {period && <p className="text-xs text-erp-text-muted">{formatPeriod(period.from, period.to)}</p>}
      </div>

      {isLoading ? <ReportSkeleton /> : (
        <QueryState
          isError={isError}
          error={error}
          onRetry={refetch}
          isEmpty={data == null}
          emptyMessage="No report data available"
          emptyIcon={BarChart3}
        >
          {activeTab === 'factory' && <FactoryTab data={data as FactoryReport} />}
          {activeTab === 'production' && <ProductionTab data={data as ProductionReport} />}
          {activeTab === 'inventory' && <InventoryTab data={data as InventoryReport} />}
          {activeTab === 'purchase' && <PurchaseTab data={data as PurchaseReport} />}
          {activeTab === 'quality' && <QualityTab data={data as QualityReport} />}
          {activeTab === 'waste' && <WasteTab data={data as WasteReport} />}
          {activeTab === 'machine' && <MachineTab data={data as MachineReport} />}
          {activeTab === 'employee' && <EmployeeTab data={data as EmployeeReport} />}
          {activeTab === 'financial' && <FinancialTab data={data as FinancialReport} />}
          {activeTab === 'approval' && <ApprovalTab data={data as ApprovalReport} />}
        </QueryState>
      )}
    </div>
  );
}
