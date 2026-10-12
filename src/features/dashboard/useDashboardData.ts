import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowDownToLine, ClipboardCheck, Factory, Inbox, PackageX, PlayCircle, Scissors, ShieldAlert, Truck, Wallet,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { reportApi } from '../../services/reports';
import { notificationApi } from '../../services/notifications';
import { approvalApi } from '../../services/approvals';
import { inventoryApi, sampleApi } from '../../services/manufacturing';
import {
  productionApi, purchaseApi, qualityApi, wasteApi,
} from '../../services/operations';
import type {
  FactoryReport, FinancialReport, ProductionOrder, ProductionReport,
  PurchaseOrder, PurchaseReport, QualityReport, ReportDatePreset, ReportStats,
} from '../../types/api';
import { formatCurrency, recordToChart } from './dashboardUtils';
import { canActOnApproval } from '../approvals/approvalUtils';
import type { AttentionItem } from './components/AttentionList';

function canAccess(permissions: string[], required: string) {
  return permissions.includes('*') || permissions.includes(required);
}

export interface DashboardKpis {
  fulfillmentPct: number;
  stockValue: number;
  openPoValue: number;
  /** Every non-cancelled payment not marked paid (matches the Unpaid payments queue). */
  unpaidValue: number;
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
  unit?: string;
}

export interface RecentOrderRow {
  id: string;
  type: string;
  total: string;
  status: string;
  date: string;
  link: string;
}

export function useDashboardData(preset: ReportDatePreset = 'mtd') {
  const { permissions, user } = useAuth();
  const filters = { preset };
  const hasReport = canAccess(permissions, 'report.read');
  const hasProduction = canAccess(permissions, 'production.read');
  const hasPurchase = canAccess(permissions, 'purchase.read');
  const hasQuality = canAccess(permissions, 'quality.read');
  const hasInventory = canAccess(permissions, 'inventory.read');
  const hasWaste = canAccess(permissions, 'waste.read');
  const hasNotify = canAccess(permissions, 'notification.read');
  const hasApprovals = canAccess(permissions, 'approval.read');
  // Queues are shown to the people who act on them, not everyone who can read the module.
  const canInspect = canAccess(permissions, 'quality.update') || canAccess(permissions, 'quality.create');
  const canPay = canAccess(permissions, 'purchase.pay');
  const canCreatePayment = canAccess(permissions, 'purchase.approve');
  const canReceive = canAccess(permissions, 'purchase.create') || canAccess(permissions, 'purchase.update');
  // Hands-on store tasks belong on the store's dashboard; admins (who manage users / approve
  // requisitions) get oversight queues only, not the store's to-do list.
  const isAllAccess = permissions.includes('*')
    || canAccess(permissions, 'user.update')
    || canAccess(permissions, 'purchase.authorize');
  const canMoveStock = !isAllAccess && (canAccess(permissions, 'inventory.update') || canAccess(permissions, 'warehouse.update'));
  const canIssueSamples = !isAllAccess && canAccess(permissions, 'inventory.update') && canAccess(permissions, 'sampling.read');
  // Whoever creates samples needs to see designs whose pattern is done and that have no sample yet.
  const canCreateSamples = canAccess(permissions, 'sampling.create');

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

  // Module stats — these power "Needs your attention" for roles without report access too.
  const { data: productionStats, isLoading: prodStatsLoading } = useQuery({
    queryKey: ['production-stats'],
    queryFn: () => productionApi.stats(),
    enabled: hasProduction,
  });

  const { data: inventoryStats, isLoading: invStatsLoading } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: () => inventoryApi.stats(),
    enabled: hasInventory,
  });

  const { data: purchaseStats, isLoading: purStatsLoading } = useQuery({
    queryKey: ['purchase-stats'],
    queryFn: () => purchaseApi.stats(),
    enabled: hasPurchase,
  });

  const { data: qualityStats, isLoading: qStatsLoading } = useQuery({
    queryKey: ['quality-stats'],
    queryFn: () => qualityApi.stats(),
    enabled: hasQuality,
  });

  const { data: approvalStats, isLoading: apprLoading } = useQuery({
    queryKey: ['approvals-stats'],
    queryFn: approvalApi.stats,
    enabled: hasApprovals,
  });

  // Approvals this user can actually decide on (first 50 pending) — "assigned to me".
  const { data: myPending, isLoading: myPendingLoading } = useQuery({
    queryKey: ['approvals-pending', 'dashboard-mine'],
    queryFn: () => approvalApi.pending({ page: 1, limit: 50 }),
    enabled: hasApprovals,
  });
  const actionableApprovals = myPending
    ? myPending.items.filter((a) => canActOnApproval(a, permissions, user?._id)).length
    : undefined;

  const { data: pendingWork } = useQuery({
    queryKey: ['quality-pending'],
    queryFn: () => qualityApi.pendingWork(),
    enabled: hasQuality,
  });

  const { data: designsToSample } = useQuery({
    queryKey: ['sample-eligible-designs', 'new'],
    queryFn: () => sampleApi.eligibleDesigns({ onlyNew: true }),
    enabled: canCreateSamples,
  });

  const { data: samplesToIssue } = useQuery({
    queryKey: ['dashboard-samples-to-issue'],
    queryFn: async () => {
      const [approved, reserved] = await Promise.all([
        sampleApi.listPage({ status: 'MATERIAL_REQUEST_APPROVED', limit: 1 }),
        sampleApi.listPage({ status: 'MATERIAL_RESERVED', limit: 1 }),
      ]);
      return (approved.meta?.total ?? 0) + (reserved.meta?.total ?? 0);
    },
    enabled: canIssueSamples,
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
    stockValue: stats?.inventory?.stockValue ?? inventoryStats?.stockValue ?? 0,
    openPoValue: stats?.purchase?.openPoValue ?? summary.openPoValue ?? purchaseStats?.openPoValue ?? 0,
    unpaidValue: stats?.purchase?.unpaidValue ?? summary.unpaidValue ?? purchaseStats?.unpaidValue ?? 0,
    firstPassYield: stats?.quality?.firstPassYield ?? summary.firstPassYield ?? qualityStats?.firstPassYield ?? 0,
    wasteCost: stats?.waste?.totalCost ?? wasteStats?.totalCost ?? 0,
    dispatchReady: stats?.warehouse?.dispatchReady ?? 0,
    pendingApprovals: approvalStats?.pending ?? summary.pendingApprovals ?? 0,
    batchesInProgress: stats?.production?.batchesInProgress ?? summary.batchesInProgress ?? productionStats?.batchesInProgress ?? 0,
    qcQueue: qualityStats?.pending ?? summary.qcQueue ?? stats?.quality?.pending ?? 0,
    // Low + out-of-stock materials — same rule as the low-stock drill-down list (computeMaterialStockAlerts).
    lowStock: stats?.inventory
      ? (stats.inventory.lowStock ?? 0) + (stats.inventory.outOfStock ?? 0)
      : inventoryStats
        ? (inventoryStats.lowStock ?? 0) + (inventoryStats.outOfStock ?? 0)
        : summary.lowStockAlerts ?? 0,
    overdueOrders: productionStats?.overdueOrders ?? stats?.production?.overdueOrders ?? productionReport?.overdueOrders ?? 0,
    openCapa: qualityStats?.openCapa ?? stats?.quality?.openCapa ?? qualityReport?.openCapa ?? 0,
    periodSpend: stats?.purchase?.periodSpend ?? purchaseReport?.spendMtd ?? 0,
    unreadNotifications: notifyStats?.unread ?? 0,
  };

  const grnPendingQc = qualityStats?.pendingGrns
    ?? pendingWork?.pendingGrns?.length
    ?? purchaseStats?.grnPendingQc
    ?? purchaseReport?.grnPendingQc
    ?? 0;
  const unpaidCount = purchaseStats?.poUnpaid ?? purchaseReport?.poOpen ?? 0;

  const attention: AttentionItem[] = [];
  const isApprover = permissions.includes('*') || permissions.some((p) => p.endsWith('.approve') || p === 'purchase.authorize');
  if (hasApprovals && (isApprover || (actionableApprovals ?? 0) > 0)) {
    attention.push({
      id: 'approvals', label: 'Approvals for you', hint: 'Waiting for your decision',
      count: actionableApprovals ?? kpis.pendingApprovals, link: '/approvals?tab=inbox', icon: Inbox,
      tone: (approvalStats?.overdue ?? 0) > 0 ? 'danger' : 'warning',
    });
  }
  if (hasQuality && canInspect) {
    // Distinct queues (a generic "QC queue" double-counted the receipts below).
    attention.push({
      id: 'qc-final', label: 'Batches for final QC', hint: 'Finished on the line, waiting for inspection',
      count: qualityStats?.batchesAwaitingFinal ?? 0, link: '/quality/inspections?tab=final', icon: ClipboardCheck, tone: 'warning',
    });
    attention.push({
      id: 'qc-samples', label: 'Samples to inspect', hint: 'Stitched samples waiting for QC',
      count: qualityStats?.pendingSampleQc ?? 0, link: '/quality/inspections?tab=samples', icon: ClipboardCheck, tone: 'warning',
    });
    attention.push({
      id: 'grn', label: 'Goods receipts to inspect', hint: 'Received goods waiting for QC',
      count: grnPendingQc, link: '/quality/inspections?tab=incoming', icon: Truck, tone: 'warning',
    });
  }
  // Shop floor: people who work batches (operators) see what is running, not order planning.
  const worksBatches = canAccess(permissions, 'batch.update');
  const plansOrders = canAccess(permissions, 'production.update');
  if (hasProduction && worksBatches && !plansOrders) {
    attention.push({
      id: 'on-line', label: 'Batches on the line', hint: 'Start, complete stages, send to QC',
      count: productionStats?.batchesInProgress ?? 0, link: '/production/orders?tab=board', icon: PlayCircle, tone: 'warning',
    });
  }
  if (hasProduction && plansOrders) {
    attention.push({
      id: 'overdue', label: 'Overdue orders', hint: 'Past their delivery date',
      count: kpis.overdueOrders, link: '/production/orders?filter=overdue', icon: Factory, tone: 'danger',
    });
  }
  if (hasInventory || hasReport) {
    attention.push({
      id: 'low-stock', label: 'Low stock materials', hint: 'At or below reorder level',
      count: kpis.lowStock, link: '/inventory?tab=alerts', icon: PackageX, tone: 'danger',
    });
  }
  if (hasInventory && canMoveStock) {
    attention.push({
      id: 'dock', label: 'Stock to put away',
      // No unit total here: the dock mixes metres, pieces and kg.
      hint: 'Received stock waiting on the dock for a bin',
      count: inventoryStats?.dockBalanceCount ?? 0, link: '/inventory?tab=stock', icon: ArrowDownToLine, tone: 'warning',
    });
  }
  if (hasPurchase && canReceive && !isAllAccess) {
    attention.push({
      id: 'grn-draft', label: 'Receipts to send to QC', hint: 'Goods received but not submitted for inspection',
      count: purchaseStats?.grnDraft ?? 0, link: '/purchase?tab=grn', icon: Truck, tone: 'warning',
    });
  }
  if (canCreateSamples) {
    attention.push({
      id: 'sample-create', label: 'Designs ready to sample', hint: 'Pattern done — create the sample',
      count: designsToSample?.length ?? 0, link: '/samples?new=1', icon: Scissors, tone: 'warning',
    });
  }
  if (canIssueSamples) {
    attention.push({
      id: 'sample-issue', label: 'Sample materials to issue', hint: 'Approved requests waiting for the store',
      count: samplesToIssue ?? 0, link: '/samples', icon: Scissors, tone: 'warning',
    });
  }
  if (hasPurchase && canCreatePayment) {
    attention.push({
      id: 'ready-to-pay', label: 'Requisitions ready to pay', hint: 'Approved — agree the price and create the payment',
      count: purchaseStats?.prApproved ?? 0, link: '/purchase', icon: Wallet, tone: 'warning',
    });
  }
  if (hasPurchase && canPay) {
    const unpaidValue = (purchaseStats as { unpaidValue?: number } | undefined)?.unpaidValue;
    attention.push({
      id: 'unpaid', label: 'Unpaid payments',
      hint: unpaidValue ? `${formatCurrency(unpaidValue)} outstanding` : 'Supplier payments not marked paid',
      count: unpaidCount, link: '/purchase?tab=po', icon: Wallet, tone: 'warning',
    });
  }
  if (hasQuality && canInspect && kpis.openCapa > 0) {
    attention.push({
      id: 'capa', label: 'Open CAPA', hint: 'Corrective actions not closed',
      count: kpis.openCapa, link: '/quality/capa', icon: ShieldAlert, tone: 'warning',
    });
  }
  if (hasApprovals && (approvalStats?.overdue ?? 0) > 0) {
    attention.push({
      id: 'approvals-sla', label: 'Approvals over SLA', hint: 'Waiting longer than 24 hours',
      count: approvalStats?.overdue ?? 0, link: '/approvals?tab=inbox', icon: AlertTriangle, tone: 'danger',
    });
  }

  const attentionLoading = (hasApprovals && (apprLoading || myPendingLoading))
    || (hasQuality && qStatsLoading)
    || (hasProduction && prodStatsLoading)
    || (hasInventory && invStatsLoading)
    || (hasPurchase && purStatsLoading);

  const lowStock: LowStockItem[] = (lowStockPage?.items ?? []).map((r) => ({
    name: r.name || 'Material',
    sku: r.materialCode || '—',
    stock: r.available ?? 0,
    reorderLevel: r.reorderLevel,
    unit: r.unit,
  }));

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

  const workloadChart = [
    { name: 'In progress', value: productionReport?.batchesInProgress ?? kpis.batchesInProgress },
    { name: 'Completed', value: productionReport?.batchesCompleted ?? 0 },
    { name: 'Rework', value: productionReport?.batchesRework ?? 0 },
    { name: 'Overdue', value: kpis.overdueOrders },
  ].filter((d) => d.value > 0);

  const ordersTotal = stats?.production?.ordersTotal ?? productionStats?.ordersTotal;
  const hasProductionData = (ordersTotal ?? 0) > 0 || productionChart.length > 0;
  const inspectionsTotal = (qualityReport?.passed ?? 0) + (qualityReport?.failed ?? 0)
    + (qualityReport?.partial ?? 0) + (qualityReport?.rework ?? 0);

  const recentOrders = buildRecentOrders(pos, orders);

  return {
    isLoading: hasReport && statsLoading,
    attentionLoading,
    hasReport,
    preset,
    stats,
    factory,
    productionReport,
    purchaseReport,
    qualityReport,
    financial,
    kpis,
    attention,
    grnPendingQc,
    lowStock,
    productionChart,
    designChart,
    batchStageChart,
    purchaseChart,
    qualityOutcomeChart,
    inspectionTypeChart,
    wasteChart,
    spendChart,
    workloadChart,
    hasProductionData,
    inspectionsTotal,
    pendingWork,
    recentOrders,
    permissions,
  };
}

function buildRecentOrders(pos: PurchaseOrder[], orders: ProductionOrder[]): RecentOrderRow[] {
  const poRows: RecentOrderRow[] = pos.map((p) => ({
    id: p.poNumber,
    type: 'Payment',
    total: p.totalAmount != null ? formatCurrency(p.totalAmount) : '—',
    status: p.paymentStatus === 'PAID' ? 'PAID' : p.status,
    date: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
    link: '/purchase?tab=po',
  }));
  const prodRows: RecentOrderRow[] = orders.map((o) => ({
    id: o.orderNumber,
    type: 'Production',
    total: `${(o.plannedQuantity ?? 0).toLocaleString()} pcs`,
    status: o.status,
    date: o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : (o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'),
    link: '/production/orders',
  }));
  return [...prodRows, ...poRows].slice(0, 8);
}

export type { FactoryReport, FinancialReport, ProductionReport, PurchaseReport, QualityReport, ReportStats };
