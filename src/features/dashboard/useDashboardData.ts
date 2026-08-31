import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/providers/AuthProvider';
import { reportApi } from '../../services/reports';
import { notificationApi } from '../../services/notifications';
import {
  productionApi, purchaseApi, qualityApi, wasteApi,
} from '../../services/operations';
import type {
  FactoryReport, FinancialReport, ProductionOrder, ProductionReport,
  PurchaseOrder, PurchaseReport, QualityReport, ReportDatePreset, ReportStats,
} from '../../types/api';
import { recordToChart } from './dashboardUtils';

function canAccess(permissions: string[], required: string) {
  return permissions.includes('*') || permissions.includes(required);
}

export interface DashboardKpis {
  fulfillmentPct: number;
  stockValue: number;
  openPoValue: number;
  firstPassYield: number;
  wasteCost: number;
  dispatchReady: number;
  pendingApprovals: number;
  batchesInProgress: number;
  qcQueue: number;
  lowStock: number;
  overdueOrders: number;
  openCapa: number;
  periodSpend: number;
  unreadNotifications: number;
}

export interface LowStockItem {
  name: string;
  sku: string;
  stock: number;
  reorderLevel?: number;
}

export interface RecentOrderRow {
  id: string;
  type: string;
  total: string;
  status: string;
  date: string;
  link: string;
}

export interface AlertItem {
  id: string;
  label: string;
  count: number;
  link: string;
  severity: 'info' | 'warning' | 'danger';
}

export function useDashboardData(preset: ReportDatePreset = 'mtd') {
  const { permissions } = useAuth();
  const filters = { preset };
  const hasReport = canAccess(permissions, 'report.read');
  const hasProduction = canAccess(permissions, 'production.read');
  const hasPurchase = canAccess(permissions, 'purchase.read');
  const hasQuality = canAccess(permissions, 'quality.read');
  const hasInventory = canAccess(permissions, 'inventory.read');
  const hasWaste = canAccess(permissions, 'waste.read');
  const hasNotify = canAccess(permissions, 'notification.read');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', preset],
    queryFn: () => reportApi.stats(filters),
    enabled: hasReport,
  });

  const { data: factory } = useQuery({
    queryKey: ['dashboard-factory', preset],
    queryFn: () => reportApi.factory(filters),
    enabled: hasReport,
  });

  const { data: productionReport } = useQuery({
    queryKey: ['dashboard-production-report', preset],
    queryFn: () => reportApi.production(filters),
    enabled: hasReport,
  });

  const { data: purchaseReport } = useQuery({
    queryKey: ['dashboard-purchase-report', preset],
    queryFn: () => reportApi.purchase(filters),
    enabled: hasReport,
  });

  const { data: qualityReport } = useQuery({
    queryKey: ['dashboard-quality-report', preset],
    queryFn: () => reportApi.quality(filters),
    enabled: hasReport,
  });

  const { data: financial } = useQuery({
    queryKey: ['dashboard-financial', preset],
    queryFn: () => reportApi.financial(filters),
    enabled: hasReport,
  });

  const { data: lowStockPage } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: () => reportApi.lowStockPage({ page: 1, limit: 6 }),
    enabled: hasReport,
  });

  const { data: productionStats } = useQuery({
    queryKey: ['production-stats'],
    queryFn: () => productionApi.stats(),
    enabled: hasProduction,
  });

  const { data: pendingWork } = useQuery({
    queryKey: ['quality-pending'],
    queryFn: () => qualityApi.pendingWork(),
    enabled: hasQuality,
  });

  const { data: wasteStats } = useQuery({
    queryKey: ['waste-stats'],
    queryFn: () => wasteApi.stats(),
    enabled: hasWaste,
  });

  const { data: notifyStats } = useQuery({
    queryKey: ['notifications-stats'],
    queryFn: () => notificationApi.stats(),
    enabled: hasNotify,
  });

  const { data: pos = [] } = useQuery({
    queryKey: ['pos-dashboard'],
    queryFn: () => purchaseApi.listPOsPage({ limit: 5 }).then((r) => r.items),
    enabled: hasPurchase,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['production-orders-dashboard'],
    queryFn: () => productionApi.listOrdersPage({ limit: 5 }).then((r) => r.items),
    enabled: hasProduction,
  });

  const summary = factory?.summary ?? {};
  const kpis: DashboardKpis = {
    fulfillmentPct: stats?.production?.fulfillmentPct ?? productionReport?.fulfillmentPct ?? summary.fulfillmentPct ?? 0,
    stockValue: stats?.inventory?.stockValue ?? 0,
    openPoValue: stats?.purchase?.openPoValue ?? summary.openPoValue ?? 0,
    firstPassYield: stats?.quality?.firstPassYield ?? summary.firstPassYield ?? 0,
    wasteCost: stats?.waste?.totalCost ?? wasteStats?.totalCost ?? 0,
    dispatchReady: stats?.warehouse?.dispatchReady ?? 0,
    pendingApprovals: summary.pendingApprovals ?? 0,
    batchesInProgress: stats?.production?.batchesInProgress ?? summary.batchesInProgress ?? 0,
    qcQueue: summary.qcQueue ?? stats?.quality?.pending ?? 0,
    lowStock: stats?.inventory?.lowStock ?? summary.lowStockAlerts ?? 0,
    overdueOrders: stats?.production?.overdueOrders ?? productionReport?.overdueOrders ?? productionStats?.overdueOrders ?? 0,
    openCapa: stats?.quality?.openCapa ?? qualityReport?.openCapa ?? 0,
    periodSpend: stats?.purchase?.periodSpend ?? purchaseReport?.spendMtd ?? 0,
    unreadNotifications: notifyStats?.unread ?? 0,
  };

  const lowStock: LowStockItem[] = (lowStockPage?.items ?? []).map((r) => ({
    name: r.name || 'Material',
    sku: r.materialCode || '—',
    stock: r.available ?? 0,
    reorderLevel: r.reorderLevel,
  }));

  const alerts: AlertItem[] = [
    { id: 'low-stock', label: 'Low stock materials', count: kpis.lowStock, link: '/inventory', severity: (kpis.lowStock > 0 ? 'danger' : 'info') as AlertItem['severity'] },
    { id: 'qc', label: 'QC queue', count: kpis.qcQueue, link: '/quality/inspections', severity: (kpis.qcQueue > 0 ? 'warning' : 'info') as AlertItem['severity'] },
    { id: 'approvals', label: 'Pending approvals', count: kpis.pendingApprovals, link: '/approvals', severity: (kpis.pendingApprovals > 0 ? 'warning' : 'info') as AlertItem['severity'] },
    { id: 'overdue', label: 'Overdue orders', count: kpis.overdueOrders, link: '/production', severity: (kpis.overdueOrders > 0 ? 'danger' : 'info') as AlertItem['severity'] },
    { id: 'capa', label: 'Open CAPA', count: kpis.openCapa, link: '/quality/capa', severity: (kpis.openCapa > 0 ? 'warning' : 'info') as AlertItem['severity'] },
    { id: 'grn', label: 'GRNs pending QC', count: pendingWork?.pendingGrns?.length ?? purchaseReport?.grnPendingQc ?? 0, link: '/quality/inspections', severity: 'warning' as const },
  ].filter((a) => a.count > 0);

  const productionChart = recordToChart(productionReport?.ordersByStatus ?? factory?.productionByStatus);
  const designChart = recordToChart(factory?.designsByStatus);
  const batchStageChart = recordToChart(productionReport?.batchesByStage);
  const purchaseChart = recordToChart(purchaseReport?.poByStatus);
  const qualityOutcomeChart = qualityReport ? recordToChart({
    Passed: qualityReport.passed,
    Failed: qualityReport.failed,
    Partial: qualityReport.partial,
    Rework: qualityReport.rework,
    Pending: qualityReport.pending,
  }, (k) => k) : [];
  const inspectionTypeChart = recordToChart(qualityReport?.inspectionsByType);
  const wasteChart = recordToChart(wasteStats?.byType ?? {});

  const spendChart = financial ? [
    { name: 'Purchase', value: financial.purchaseSpend ?? 0 },
    { name: 'Waste', value: financial.wasteCostTotal ?? 0 },
    { name: 'Stock value', value: financial.stockValue ?? 0 },
  ].filter((d) => d.value > 0) : [];

  const activityChart = buildActivityChart(stats, financial, wasteStats);

  const recentOrders = buildRecentOrders(pos, orders);

  return {
    isLoading: hasReport && statsLoading,
    hasReport,
    preset,
    stats,
    factory,
    productionReport,
    purchaseReport,
    qualityReport,
    financial,
    kpis,
    lowStock,
    alerts,
    productionChart,
    designChart,
    batchStageChart,
    purchaseChart,
    qualityOutcomeChart,
    inspectionTypeChart,
    wasteChart,
    spendChart,
    activityChart,
    pendingWork,
    recentOrders,
    permissions,
  };
}

function buildActivityChart(
  stats?: ReportStats,
  financial?: FinancialReport,
  wasteStats?: { periodCost7d?: number },
): { name: string; value: number }[] {
  if (!stats && !financial) return [];
  return [
    { name: 'Orders', value: stats?.production?.ordersTotal ?? 0 },
    { name: 'Batches', value: stats?.production?.batchesInProgress ?? 0 },
    { name: 'Spend', value: Math.round((stats?.purchase?.periodSpend ?? financial?.purchaseSpend ?? 0) / 1000) },
    { name: 'QC pending', value: stats?.quality?.pending ?? 0 },
    { name: 'Waste (7d)', value: Math.round((wasteStats?.periodCost7d ?? stats?.waste?.totalCost ?? 0) / 1000) },
    { name: 'Dispatch', value: stats?.warehouse?.dispatchReady ?? 0 },
    { name: 'Low stock', value: stats?.inventory?.lowStock ?? 0 },
  ].filter((d) => d.value > 0);
}

function buildRecentOrders(pos: PurchaseOrder[], orders: ProductionOrder[]): RecentOrderRow[] {
  const poRows: RecentOrderRow[] = pos.map((p) => ({
    id: p.poNumber,
    type: 'Purchase',
    total: p.totalAmount != null ? `₹${Math.round(p.totalAmount).toLocaleString()}` : '—',
    status: p.status,
    date: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—',
    link: '/purchase',
  }));
  const prodRows: RecentOrderRow[] = orders.map((o) => ({
    id: o.orderNumber,
    type: 'Production',
    total: `${o.plannedQuantity} pcs`,
    status: o.status,
    date: o.createdAt ? new Date(o.createdAt).toLocaleDateString() : (o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : '—'),
    link: '/production',
  }));
  return [...prodRows, ...poRows].slice(0, 8);
}

export type { FactoryReport, ProductionReport, PurchaseReport, QualityReport, ReportStats };
