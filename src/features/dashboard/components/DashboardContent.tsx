import { Link } from 'react-router-dom';
import { ErpTabs } from '../../../components/erp';
import { KpiStrip, SecondaryKpis } from './KpiStrip';
import { AlertsPanel } from './AlertsPanel';
import { LowStockCard } from './LowStockCard';
import { RecentOrdersTable } from './RecentOrdersTable';
import { ModuleQuickLinks } from './ModuleQuickLinks';
import {
  AreaTrendChart, BarStatusChart, DonutChart, FulfillmentGauge,
} from './ChartPanels';
import type { DashboardTab } from '../dashboardUtils';
import { DASHBOARD_TABS, formatPct } from '../dashboardUtils';
import type { useDashboardData } from '../useDashboardData';

type DashboardData = ReturnType<typeof useDashboardData>;

interface DashboardContentProps {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  data: DashboardData;
}

export function DashboardContent({ tab, onTabChange, data }: DashboardContentProps) {
  const { kpis, alerts, lowStock, recentOrders, permissions } = data;

  return (
    <div className="space-y-5">
      <ErpTabs
        tabs={DASHBOARD_TABS.map((t) => ({ id: t.id, label: t.label }))}
        active={tab}
        onChange={(id) => onTabChange(id as DashboardTab)}
      />

      <KpiStrip kpis={kpis} />
      <SecondaryKpis kpis={kpis} />

      {tab === 'overview' && (
        <>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <FulfillmentGauge pct={kpis.fulfillmentPct} link="/production" />
            </div>
            <div className="lg:col-span-4">
              <AlertsPanel alerts={alerts} />
            </div>
            <div className="lg:col-span-4">
              <LowStockCard items={lowStock} alertCount={kpis.lowStock || lowStock.length} />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <AreaTrendChart
              title="Operations pulse"
              subtitle="Key metrics for selected period"
              data={data.activityChart}
              link="/reports/factory"
            />
            <DonutChart
              title="Design pipeline"
              data={data.designChart}
              link="/designs"
              centerLabel={String(data.factory?.summary?.approvedDesigns ?? '')}
            />
          </div>
          <RecentOrdersTable orders={recentOrders} />
        </>
      )}

      {tab === 'production' && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <FulfillmentGauge pct={kpis.fulfillmentPct} link="/production" />
            <BarStatusChart title="Orders by status" data={data.productionChart} link="/production" />
            <BarStatusChart title="Batches by stage" data={data.batchStageChart} link="/production" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <AreaTrendChart
              title="Production workload"
              data={[
                { name: 'In progress', value: data.productionReport?.batchesInProgress ?? kpis.batchesInProgress },
                { name: 'Completed', value: data.productionReport?.batchesCompleted ?? 0 },
                { name: 'Rework', value: data.productionReport?.batchesRework ?? 0 },
                { name: 'Overdue', value: kpis.overdueOrders },
              ].filter((d) => d.value > 0)}
              link="/production"
            />
            <DonutChart
              title="Capacity"
              data={[
                { name: 'Machines', value: data.productionReport?.machineCount ?? 0 },
                { name: 'Capacity/hr', value: Math.round((data.productionReport?.totalCapacityPerHour ?? 0) / 10) },
              ].filter((d) => d.value > 0)}
              link="/production/machines"
            />
          </div>
          {data.pendingWork && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Link to="/quality/inspections" className="erp-card block p-4 hover:border-[var(--erp-accent)]">
                <p className="text-[10px] text-erp-text-muted">Batches in process</p>
                <p className="text-xl font-semibold">{data.pendingWork.inProgressBatches?.length ?? 0}</p>
              </Link>
              <Link to="/quality/inspections" className="erp-card block p-4 hover:border-[var(--erp-accent)]">
                <p className="text-[10px] text-erp-text-muted">Awaiting final QC</p>
                <p className="text-xl font-semibold">{data.pendingWork.completedBatches?.length ?? 0}</p>
              </Link>
              <Link to="/production" className="erp-card block p-4 hover:border-[var(--erp-accent)]">
                <p className="text-[10px] text-erp-text-muted">Fulfillment</p>
                <p className="text-xl font-semibold">{formatPct(kpis.fulfillmentPct)}</p>
              </Link>
            </div>
          )}
        </>
      )}

      {tab === 'supply' && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <LowStockCard items={lowStock} alertCount={kpis.lowStock || lowStock.length} />
            <BarStatusChart title="PO pipeline" data={data.purchaseChart} link="/purchase" horizontal />
            <BarStatusChart title="Spend breakdown (₹ thousands)" data={data.spendChart} link="/reports/financial" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <AreaTrendChart
              title="Inventory & dispatch"
              data={[
                { name: 'Stock value (₹K)', value: Math.round(kpis.stockValue / 1000) },
                { name: 'Dispatch ready', value: kpis.dispatchReady },
                { name: 'Low stock', value: kpis.lowStock },
                { name: 'Open PO (₹K)', value: Math.round(kpis.openPoValue / 1000) },
              ].filter((d) => d.value > 0)}
              link="/inventory"
            />
            <DonutChart
              title="Waste by type"
              data={data.wasteChart}
              link="/waste"
            />
          </div>
          <RecentOrdersTable orders={recentOrders.filter((o) => o.type === 'Purchase')} />
        </>
      )}

      {tab === 'quality' && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <FulfillmentGauge pct={kpis.firstPassYield} link="/quality/inspections" label="First-pass yield" />
            <DonutChart
              title="Inspection outcomes"
              data={data.qualityOutcomeChart}
              link="/quality/inspections"
              centerLabel={formatPct(kpis.firstPassYield)}
            />
            <DonutChart
              title="By inspection type"
              data={data.inspectionTypeChart}
              link="/quality/inspections"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/quality/inspections" className="erp-card block p-4 hover:border-[var(--erp-accent)]">
              <p className="text-[10px] text-erp-text-muted">QC queue</p>
              <p className="text-xl font-semibold">{kpis.qcQueue}</p>
            </Link>
            <Link to="/quality/capa" className="erp-card block p-4 hover:border-[var(--erp-accent)]">
              <p className="text-[10px] text-erp-text-muted">Open CAPA</p>
              <p className="text-xl font-semibold">{kpis.openCapa}</p>
            </Link>
            <Link to="/quality/inspections" className="erp-card block p-4 hover:border-[var(--erp-accent)]">
              <p className="text-[10px] text-erp-text-muted">GRNs pending QC</p>
              <p className="text-xl font-semibold">{data.pendingWork?.pendingGrns?.length ?? data.purchaseReport?.grnPendingQc ?? 0}</p>
            </Link>
            <Link to="/reports/quality" className="erp-card block p-4 hover:border-[var(--erp-accent)]">
              <p className="text-[10px] text-erp-text-muted">Defects logged</p>
              <p className="text-xl font-semibold">{data.qualityReport?.defectsLogged ?? 0}</p>
            </Link>
          </div>
          <AlertsPanel alerts={alerts.filter((a) => ['qc', 'capa', 'grn'].includes(a.id))} />
        </>
      )}

      <ModuleQuickLinks permissions={permissions} />
    </div>
  );
}
