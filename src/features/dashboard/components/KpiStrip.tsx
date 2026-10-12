import {
  Boxes, Factory, IndianRupee, Package, ShieldCheck, TrendingUp,
} from 'lucide-react';
import { KpiGrid, StatTile } from '../../../components/erp';
import type { DashboardKpis } from '../useDashboardData';
import { currencyHint, formatCompactCurrency, formatNumber, formatPct } from '../dashboardUtils';

/** Six headline KPIs for the selected period (2 per row on phones). */
export function KpiStrip({ kpis, hasProductionData, hasInspections }: {
  kpis: DashboardKpis;
  hasProductionData: boolean;
  hasInspections: boolean;
}) {
  return (
    <KpiGrid cols={6}>
      <StatTile
        icon={TrendingUp}
        label="Fulfillment"
        value={hasProductionData ? formatPct(kpis.fulfillmentPct) : '—'}
        hint={hasProductionData ? 'Passed QC vs plan' : 'No orders yet'}
      />
      <StatTile icon={Factory} label="Active batches" value={formatNumber(kpis.batchesInProgress)} hint="On the floor" />
      <StatTile
        icon={ShieldCheck}
        label="QC yield"
        value={hasInspections ? formatPct(kpis.firstPassYield) : '—'}
        hint={hasInspections ? 'First-pass' : 'No inspections yet'}
      />
      <StatTile icon={Package} label="Stock value" value={formatCompactCurrency(kpis.stockValue)} hint={currencyHint(kpis.stockValue)} />
      <StatTile
        icon={IndianRupee}
        label="Unpaid"
        value={formatCompactCurrency(kpis.unpaidValue)}
        hint={currencyHint(kpis.unpaidValue)}
        highlight={kpis.unpaidValue > 0 ? 'warn' : undefined}
      />
      <StatTile icon={Boxes} label="Dispatch ready" value={formatNumber(kpis.dispatchReady)} hint="Staged to ship" />
    </KpiGrid>
  );
}
