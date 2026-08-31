import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart3, Download, Factory, IndianRupee, Package, RefreshCw, ShieldCheck, TrendingUp, Users,
} from 'lucide-react';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { reportApi } from '../../services/reports';
import type {
  ApprovalReport, EmployeeReport, FactoryReport, FinancialReport, InventoryReport,
  MachineReport, ProductionReport, PurchaseReport, QualityReport, ReportDatePreset,
  ReportPeriod, ReportTabId, WasteReport,
} from '../../types/api';
import {
  ErpPageHeader, ErpTabs, ErpButton, ErpCard, ErpDataTable, ErpSelect, ErpStatusBadge,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  DATE_PRESET_OPTIONS, formatCurrency, formatNumber, formatPct, formatPeriod,
  recordToChartData, statusLabel, tabMeta,
} from './reportsUtils';

const CHART_COLORS = ['var(--erp-accent)', '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const btnSm = '!px-2 !py-1 text-[10px]';

function KpiCard({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <ErpCard className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-erp-text-muted">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-erp-text-muted" />}
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </ErpCard>
  );
}

function StatusBarChart({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  if (!data.length) {
    return (
      <ErpCard className="p-4">
        <p className="mb-2 text-sm font-medium">{title}</p>
        <p className="text-xs text-erp-text-muted">No data for this period</p>
      </ErpCard>
    );
  }
  return (
    <ErpCard className="p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--erp-glass-elevated)',
                border: '1px solid var(--erp-border)',
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Bar dataKey="value" fill="var(--erp-accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ErpCard>
  );
}

function StatusPieChart({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  if (!data.length) {
    return (
      <ErpCard className="p-4">
        <p className="mb-2 text-sm font-medium">{title}</p>
        <p className="text-xs text-erp-text-muted">No data</p>
      </ErpCard>
    );
  }
  return (
    <ErpCard className="p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: 'var(--erp-glass-elevated)', border: '1px solid var(--erp-border)', borderRadius: 8, fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ErpCard>
  );
}

function BreakdownTable({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <ErpCard className="p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ErpDataTable>
        <thead><tr><th>Status</th><th className="text-right">Count</th></tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.name}>
              <td><ErpStatusBadge status={r.name.toUpperCase().replace(/ /g, '_')} label={r.name} /></td>
              <td className="text-right font-mono text-xs">{formatNumber(r.value)}</td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-erp-text-muted">No rows</td></tr>}
        </tbody>
      </ErpDataTable>
    </ErpCard>
  );
}

function FactoryTab({ data }: { data: FactoryReport }) {
  const s = data.summary;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Approved designs" value={formatNumber(s.approvedDesigns)} icon={Factory} />
        <KpiCard label="Batches in progress" value={formatNumber(s.batchesInProgress)} icon={TrendingUp} />
        <KpiCard label="Fulfillment" value={formatPct(s.fulfillmentPct)} icon={BarChart3} />
        <KpiCard label="First-pass yield" value={formatPct(s.firstPassYield)} icon={ShieldCheck} />
        <KpiCard label="Open PO value" value={formatCurrency(s.openPoValue)} icon={IndianRupee} />
        <KpiCard label="Low stock alerts" value={formatNumber(s.lowStockAlerts)} icon={Package} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <StatusBarChart data={recordToChartData(data.designsByStatus)} title="Designs by status" />
        <StatusBarChart data={recordToChartData(data.productionByStatus)} title="Production orders" />
        <StatusBarChart data={recordToChartData(data.samplesByStatus)} title="Samples by status" />
      </div>
    </div>
  );
}

function ProductionTab({ data }: { data: ProductionReport }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Planned qty" value={formatNumber(data.totalPlannedQty)} />
        <KpiCard label="Produced qty" value={formatNumber(data.totalProducedQty)} />
        <KpiCard label="Fulfillment" value={formatPct(data.fulfillmentPct)} />
        <KpiCard label="Overdue orders" value={formatNumber(data.overdueOrders)} />
        <KpiCard label="Batches in progress" value={formatNumber(data.batchesInProgress)} />
        <KpiCard label="Batches completed" value={formatNumber(data.batchesCompleted)} />
        <KpiCard label="Rework batches" value={formatNumber(data.batchesRework)} />
        <KpiCard label="Capacity / hr" value={formatNumber(data.totalCapacityPerHour)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <StatusBarChart data={recordToChartData(data.ordersByStatus)} title="Orders by status" />
        <StatusBarChart data={recordToChartData(data.batchesByStage)} title="In-progress batches by stage" />
      </div>
    </div>
  );
}

function InventoryTab({ data, showDrillDown }: { data: InventoryReport; showDrillDown: boolean }) {
  const { data: lowStock } = useQuery({
    queryKey: ['report-low-stock'],
    queryFn: () => reportApi.lowStockPage({ page: 1, limit: 10 }),
    enabled: showDrillDown,
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Materials" value={formatNumber(data.materialCount)} />
        <KpiCard label="RM on hand" value={formatNumber(data.rmOnHand)} />
        <KpiCard label="FG on hand" value={formatNumber(data.fgOnHand)} />
        <KpiCard label="Stock value" value={formatCurrency(data.stockValue)} />
        <KpiCard label="Low stock SKUs" value={formatNumber(data.lowStock)} />
        <KpiCard label="Out of stock" value={formatNumber(data.outOfStock)} />
        <KpiCard label="Dispatch ready" value={formatNumber(data.dispatchReady)} />
        <KpiCard label="Reserved" value={formatNumber(data.totalReserved)} />
      </div>
      {showDrillDown && lowStock && lowStock.items.length > 0 && (
        <ErpCard className="p-4">
          <p className="mb-3 text-sm font-medium">Low stock drill-down</p>
          <ErpDataTable>
            <thead>
              <tr>
                <th>Material</th>
                <th>Available</th>
                <th>Reorder</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.items.map((r) => (
                <tr key={r.materialId}>
                  <td>
                    <span className="font-mono text-xs">{r.materialCode}</span>
                    <span className="ml-2 text-xs text-erp-text-muted">{r.name}</span>
                  </td>
                  <td>{formatNumber(r.available)} {r.unit}</td>
                  <td>{formatNumber(r.reorderLevel)}</td>
                  <td className="text-right">{formatCurrency(r.stockValue)}</td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        </ErpCard>
      )}
    </div>
  );
}

function PurchaseTab({ data }: { data: PurchaseReport }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Period spend" value={formatCurrency(data.spendMtd)} icon={IndianRupee} />
        <KpiCard label="Open POs" value={formatNumber(data.poOpen)} />
        <KpiCard label="Open PO value" value={formatCurrency(data.openPoValue)} />
        <KpiCard label="GRNs pending QC" value={formatNumber(data.grnPendingQc)} />
        <KpiCard label="Suppliers" value={formatNumber(data.suppliers)} />
        <KpiCard label="Open RFQs" value={formatNumber(data.rfqOpen)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable title="PR by status" data={recordToChartData(data.prByStatus)} />
        <BreakdownTable title="PO by status" data={recordToChartData(data.poByStatus)} />
      </div>
    </div>
  );
}

function QualityTab({ data, showDrillDown }: { data: QualityReport; showDrillDown: boolean }) {
  const { data: defects = [] } = useQuery({
    queryKey: ['report-top-defects'],
    queryFn: () => reportApi.topDefects({ limit: 8 }),
    enabled: showDrillDown,
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="First-pass yield" value={formatPct(data.firstPassYield)} icon={ShieldCheck} />
        <KpiCard label="Pending inspections" value={formatNumber(data.pending)} />
        <KpiCard label="Open CAPA" value={formatNumber(data.openCapa)} />
        <KpiCard label="Defects logged" value={formatNumber(data.defectsLogged)} />
        <KpiCard label="Passed" value={formatNumber(data.passed)} />
        <KpiCard label="Failed" value={formatNumber(data.failed)} />
        <KpiCard label="Rework" value={formatNumber(data.rework)} />
        <KpiCard label="GRNs waiting QC" value={formatNumber(data.pendingGrns)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <StatusPieChart data={recordToChartData(data.inspectionsByType)} title="Inspections by type" />
        {showDrillDown && defects.length > 0 ? (
          <ErpCard className="p-4">
            <p className="mb-3 text-sm font-medium">Top defect categories</p>
            <ErpDataTable>
              <thead><tr><th>Code</th><th>Name</th><th className="text-right">Qty</th></tr></thead>
              <tbody>
                {defects.map((d) => (
                  <tr key={d.code}>
                    <td className="font-mono text-xs">{d.code}</td>
                    <td>{d.name}</td>
                    <td className="text-right">{formatNumber(d.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </ErpCard>
        ) : (
          <BreakdownTable title="Inspection outcomes" data={[
            { name: 'Passed', value: data.passed ?? 0 },
            { name: 'Failed', value: data.failed ?? 0 },
            { name: 'Partial', value: data.partial ?? 0 },
            { name: 'Rework', value: data.rework ?? 0 },
          ].filter((r) => r.value > 0)} />
        )}
      </div>
    </div>
  );
}

function WasteTab({ data }: { data: WasteReport }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Records" value={formatNumber(data.count)} />
        <KpiCard label="Total cost" value={formatCurrency(data.totalCost)} icon={IndianRupee} />
        <KpiCard label="Recovered" value={formatNumber(data.recovered)} />
      </div>
      <StatusBarChart data={recordToChartData(data.byType)} title="Waste by type" />
    </div>
  );
}

function MachineTab({ data }: { data: MachineReport }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total machines" value={formatNumber(data.total)} />
        <KpiCard label="Active" value={formatNumber(data.active)} />
        <KpiCard label="Maintenance" value={formatNumber(data.maintenance)} />
        <KpiCard label="Utilization" value={formatPct(data.utilizationPct)} />
        <KpiCard label="Capacity / hr" value={formatNumber(data.totalCapacityPerHour)} />
        <KpiCard label="Production lines" value={formatNumber(data.lineCount)} />
      </div>
      <StatusPieChart data={recordToChartData(data.machinesByStatus)} title="Machines by status" />
    </div>
  );
}

function EmployeeTab({ data }: { data: EmployeeReport }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Assigned users" value={formatNumber(data.assignedUsers)} icon={Users} />
        <KpiCard label="Active" value={formatNumber(data.activeUsers)} />
        <KpiCard label="Inactive" value={formatNumber(data.inactiveUsers)} />
      </div>
      <StatusBarChart data={recordToChartData(data.usersByRole)} title="Users by role" />
    </div>
  );
}

function FinancialTab({ data }: { data: FinancialReport }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-erp-text-muted">{formatPeriod(data.period.from, data.period.to)}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Purchase spend" value={formatCurrency(data.purchaseSpend)} icon={IndianRupee} />
        <KpiCard label="Waste cost" value={formatCurrency(data.wasteCostTotal)} />
        <KpiCard label="Stock value" value={formatCurrency(data.stockValue)} icon={Package} />
        <KpiCard label="Net exposure" value={formatCurrency(data.netExposure)} />
      </div>
    </div>
  );
}

function ApprovalTab({ data, showDrillDown }: { data: ApprovalReport; showDrillDown: boolean }) {
  const { data: pendingPage } = useQuery({
    queryKey: ['report-pending-approvals'],
    queryFn: () => reportApi.pendingApprovalsPage({ page: 1, limit: 10 }),
    enabled: showDrillDown,
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pending" value={formatNumber(data.pending)} />
        <KpiCard label="Approved" value={formatNumber(data.approved)} />
        <KpiCard label="Rejected" value={formatNumber(data.rejected)} />
        <KpiCard label="Approval rate" value={formatPct(data.approvalRate)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <StatusBarChart data={recordToChartData(data.pendingByType)} title="Pending by document type" />
        {showDrillDown && pendingPage && pendingPage.items.length > 0 && (
          <ErpCard className="p-4">
            <p className="mb-3 text-sm font-medium">Pending approvals</p>
            <ErpDataTable>
              <thead><tr><th>Type</th><th>Level</th><th>Submitted</th></tr></thead>
              <tbody>
                {pendingPage.items.map((a) => (
                  <tr key={a._id}>
                    <td>{statusLabel(a.documentType)}</td>
                    <td>L{a.currentLevel}</td>
                    <td className="text-xs text-erp-text-muted">
                      {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </ErpCard>
        )}
      </div>
    </div>
  );
}

const VALID_REPORT_TABS: ReportTabId[] = [
  'factory', 'production', 'inventory', 'purchase', 'quality', 'waste', 'machine', 'employee', 'financial', 'approval',
];

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

export function ReportsPage() {
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canRead = permissions.includes('*') || permissions.includes('report.read');
  const canExport = permissions.includes('*') || permissions.includes('report.export');

  useEffect(() => {
    if (!canRead) return;
    const valid = tabParam && VALID_REPORT_TABS.includes(tabParam as ReportTabId);
    if (!valid) {
      navigate(`/reports/${defaultReportTab(permissions)}`, { replace: true });
    }
  }, [tabParam, permissions, canRead, navigate]);

  const activeTab = (VALID_REPORT_TABS.includes(tabParam as ReportTabId) ? tabParam : defaultReportTab(permissions)) as ReportTabId;
  const meta = tabMeta(activeTab);
  const [preset, setPreset] = useState<ReportDatePreset>('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const filters = { preset };

  const { data: stats } = useQuery({
    queryKey: ['report-stats', preset],
    queryFn: () => reportApi.stats(filters),
    enabled: canRead,
  });

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

  const { data, isLoading, isFetching, refetch, error: queryError } = useQuery({
    queryKey: ['reports', activeTab, preset],
    queryFn: () => tabFetchers[activeTab](filters),
    enabled: canRead,
  });

  const selectTab = (id: string) => navigate(`/reports/${id}`, { replace: true });

  const handleExport = async () => {
    try {
      const blob = await reportApi.exportCsv(activeTab, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('Report exported');
      setError('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    }
  };

  if (!canRead) {
    return (
      <div>
        <ErpPageHeader title="Reports & Analytics" subtitle="Insights and operational KPIs" />
        <p className="text-sm text-erp-text-muted">You do not have permission to view reports.</p>
      </div>
    );
  }

  const displayError = error || (queryError instanceof Error ? queryError.message : '');
  const period = reportPeriod(data);

  return (
    <div>
      <AlertBanner message={displayError} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Reports & Analytics"
        subtitle={meta.subtitle}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span className={fieldLabel}>Period</span>
              <ErpSelect value={preset} onChange={(e) => setPreset(e.target.value as ReportDatePreset)} className="min-w-[130px]">
                {DATE_PRESET_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </ErpSelect>
            </label>
            <ErpButton variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </ErpButton>
            {canExport && (
              <ErpButton variant="secondary" onClick={handleExport}>
                <Download className="mr-1 inline h-3.5 w-3.5" />
                Export CSV
              </ErpButton>
            )}
          </div>
        )}
      />

      {stats && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Fulfillment" value={formatPct(stats.production?.fulfillmentPct)} icon={TrendingUp} />
          <KpiCard label="Stock value" value={formatCurrency(stats.inventory?.stockValue)} icon={Package} />
          <KpiCard label="Open PO value" value={formatCurrency(stats.purchase?.openPoValue)} icon={IndianRupee} />
          <KpiCard label="QC yield" value={formatPct(stats.quality?.firstPassYield)} icon={ShieldCheck} />
          <KpiCard label="Waste cost" value={formatCurrency(stats.waste?.totalCost)} />
          <KpiCard label="Dispatch ready" value={formatNumber(stats.warehouse?.dispatchReady)} />
        </div>
      )}

      <div className="mb-4">
        <ErpTabs
          tabs={[
            { id: 'factory', label: 'Factory' },
            { id: 'production', label: 'Production' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'purchase', label: 'Purchase' },
            { id: 'quality', label: 'Quality' },
            { id: 'waste', label: 'Waste' },
            { id: 'machine', label: 'Machine' },
            { id: 'employee', label: 'Employee' },
            { id: 'financial', label: 'Financial' },
            { id: 'approval', label: 'Approval' },
          ]}
          active={activeTab}
          onChange={selectTab}
        />
      </div>

      {period && (
        <p className="mb-4 text-xs text-erp-text-muted">
          Showing data for {formatPeriod(period.from, period.to)}
        </p>
      )}

      {isLoading ? (
        <p className="text-erp-text-muted">Loading report…</p>
      ) : data != null ? (
        <>
          {activeTab === 'factory' && <FactoryTab data={data as FactoryReport} />}
          {activeTab === 'production' && <ProductionTab data={data as ProductionReport} />}
          {activeTab === 'inventory' && <InventoryTab data={data as InventoryReport} showDrillDown />}
          {activeTab === 'purchase' && <PurchaseTab data={data as PurchaseReport} />}
          {activeTab === 'quality' && <QualityTab data={data as QualityReport} showDrillDown />}
          {activeTab === 'waste' && <WasteTab data={data as WasteReport} />}
          {activeTab === 'machine' && <MachineTab data={data as MachineReport} />}
          {activeTab === 'employee' && <EmployeeTab data={data as EmployeeReport} />}
          {activeTab === 'financial' && <FinancialTab data={data as FinancialReport} />}
          {activeTab === 'approval' && <ApprovalTab data={data as ApprovalReport} showDrillDown />}
        </>
      ) : (
        <p className="text-erp-text-muted">No report data available</p>
      )}
    </div>
  );
}
