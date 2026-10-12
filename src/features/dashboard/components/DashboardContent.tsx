import {
  ClipboardCheck, Factory, FileWarning, Hourglass, ShieldAlert, Truck,
} from 'lucide-react';
import {
  DescriptionList, ErpTabs, KpiGrid, Section, StatTile,
} from '../../../components/erp';
import { LowStockCard } from './LowStockCard';
import { RecentOrdersTable } from './RecentOrdersTable';
import { BarStatusChart, DonutChart, FulfillmentGauge } from './ChartPanels';
import type { DashboardTab } from '../dashboardUtils';
import { DASHBOARD_TABS, formatCurrency, formatNumber, formatPct } from '../dashboardUtils';
import type { useDashboardData } from '../useDashboardData';

type DashboardData = ReturnType<typeof useDashboardData>;

interface DashboardContentProps {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  data: DashboardData;
}

const noOrders = 'Fulfillment is measured once production orders exist for this period.';

export function DashboardContent({ tab, onTabChange, data }: DashboardContentProps) {
  const { kpis, lowStock, recentOrders } = data;
  const lowStockCount = kpis.lowStock || lowStock.length;

  return (
    <div className="space-y-4">
      <ErpTabs
        tabs={DASHBOARD_TABS}
        active={tab}
        onChange={(id) => onTabChange(id as DashboardTab)}
        ariaLabel="Dashboard views"
      />

      {tab === 'overview' && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <FulfillmentGauge
              pct={kpis.fulfillmentPct}
              link="/production/orders"
              isEmpty={!data.hasProductionData}
              emptyDescription={noOrders}
            />
            <BarStatusChart
              title="Production orders"
              description="By status"
              data={data.productionChart}
              link="/production/orders"
              emptyTitle="No production orders"
              emptyDescription="Orders created in this period will be charted here."
            />
            <DonutChart
              title="Design pipeline"
              description="Designs by status"
              data={data.designChart}
              link="/designs"
              emptyTitle="No designs yet"
              emptyDescription="Designs appear here once they are created."
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <LowStockCard items={lowStock} alertCount={lowStockCount} />
            </div>
            <div className="min-w-0 lg:col-span-2">
              <RecentOrdersTable orders={recentOrders} />
            </div>
          </div>
        </>
      )}

      {tab === 'production' && (
        <>
          {data.pendingWork && (
            <KpiGrid cols={4}>
              <StatTile icon={Factory} label="Batches in process" value={formatNumber(data.pendingWork.inProgressBatches?.length ?? 0)} />
              <StatTile icon={ClipboardCheck} label="Awaiting final QC" value={formatNumber(data.pendingWork.completedBatches?.length ?? 0)} />
              <StatTile icon={Hourglass} label="Overdue orders" value={formatNumber(kpis.overdueOrders)} highlight={kpis.overdueOrders > 0 ? 'warn' : undefined} />
              <StatTile label="Fulfillment" value={data.hasProductionData ? formatPct(kpis.fulfillmentPct) : '—'} />
            </KpiGrid>
          )}
          <div className="grid gap-4 lg:grid-cols-3">
            <FulfillmentGauge pct={kpis.fulfillmentPct} link="/production/orders" isEmpty={!data.hasProductionData} emptyDescription={noOrders} />
            <BarStatusChart title="Orders by status" data={data.productionChart} link="/production/orders" emptyTitle="No production orders" />
            <BarStatusChart title="Running batches by stage" data={data.batchStageChart} link="/production/orders" emptyTitle="No batches running" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BarStatusChart title="Batch workload" data={data.workloadChart} link="/production/orders" emptyTitle="No batch activity" horizontal />
            <Section title="Capacity" description="Machines and hourly capacity at this factory.">
              <DescriptionList
                columns={2}
                items={[
                  { label: 'Machines', value: formatNumber(data.productionReport?.machineCount) },
                  { label: 'Capacity per hour', value: formatNumber(data.productionReport?.totalCapacityPerHour) },
                  { label: 'Batches completed', value: formatNumber(data.productionReport?.batchesCompleted) },
                  { label: 'Rework batches', value: formatNumber(data.productionReport?.batchesRework) },
                ]}
              />
            </Section>
          </div>
        </>
      )}

      {tab === 'supply' && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <LowStockCard items={lowStock} alertCount={lowStockCount} />
            <BarStatusChart title="Payments by status" data={data.purchaseChart} link="/purchase?tab=po" horizontal emptyTitle="No payments in this period" />
            <BarStatusChart
              title="Spend breakdown"
              data={data.spendChart}
              link="/reports/financial"
              valueFormatter={(v) => formatCurrency(v)}
              emptyTitle="No spend recorded"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <DonutChart title="Waste by type" data={data.wasteChart} link="/waste" emptyTitle="No waste recorded" />
            <div className="min-w-0 lg:col-span-2">
              <RecentOrdersTable title="Recent payments" orders={recentOrders.filter((o) => o.type === 'Payment')} />
            </div>
          </div>
        </>
      )}

      {tab === 'quality' && (
        <>
          <KpiGrid cols={4}>
            <StatTile icon={ClipboardCheck} label="QC queue" value={formatNumber(kpis.qcQueue)} hint="Not started" />
            <StatTile icon={ShieldAlert} label="Open CAPA" value={formatNumber(kpis.openCapa)} />
            <StatTile icon={Truck} label="Receipts awaiting QC" value={formatNumber(data.grnPendingQc)} />
            <StatTile icon={FileWarning} label="Defects logged" value={formatNumber(data.qualityReport?.defectsLogged ?? 0)} />
          </KpiGrid>
          <div className="grid gap-4 lg:grid-cols-3">
            <FulfillmentGauge
              title="First-pass yield"
              label="Inspections passed first time"
              pct={kpis.firstPassYield}
              link="/quality/inspections"
              isEmpty={data.inspectionsTotal === 0}
              emptyTitle="No inspections yet"
              emptyDescription="Yield is calculated from completed inspections."
            />
            <DonutChart
              title="Inspection outcomes"
              data={data.qualityOutcomeChart}
              link="/quality/inspections"
              emptyTitle="No inspections yet"
            />
            <DonutChart
              title="By inspection type"
              data={data.inspectionTypeChart}
              link="/quality/inspections"
              emptyTitle="No inspections yet"
            />
          </div>
        </>
      )}
    </div>
  );
}
