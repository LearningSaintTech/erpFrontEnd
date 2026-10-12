import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, CheckCircle2, Clock, Cog, Download, Factory, FileText, IndianRupee, Package, PackageX,
  Percent, ShieldCheck, Trash2, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { PreviewableImage } from '../../../components/ImagePreview';
import { mediaUrl } from '../../inventory/inventoryUtils';
import { reportApi } from '../../../services/reports';
import { purchaseApi } from '../../../services/operations';
import type {
  ApprovalReport, EmployeeReport, FactoryReport, FinancialReport, InventoryReport,
  MachineReport, ProductionReport, PurchaseReport, QualityReport, WasteReport, PurchaseOrder, GoodsReceipt,
} from '../../../types/api';
import {
  Button, DescriptionList, EmptyRow, ErpDataTable, IconButton, KpiGrid, Section, StatTile,
  StatusBadge, TableSkeleton, toast, useConfirm,
} from '../../../components/erp';
import { useAuth } from '../../../app/providers/AuthProvider';
import { BarStatusChart, DonutChart } from '../../dashboard/components/ChartPanels';
import {
  formatCurrency, formatNumber, formatPct, recordToChartData, statusLabel,
} from '../reportsUtils';
import { currencyHint, formatCompactCurrency } from '../../dashboard/dashboardUtils';
import { documentTypeLabel } from '../../approvals/approvalUtils';
import { getApiErrorMessage } from '../../../utils/errors';

type Datum = { name: string; value: number };

function BreakdownTable({ title, data, emptyTitle = 'Nothing recorded in this period' }: { title: string; data: Datum[]; emptyTitle?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Section title={title} flush>
      <ErpDataTable>
        <thead><tr><th>Status</th><th className="erp-num">Count</th><th className="erp-num">Share</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <EmptyRow colSpan={3} icon={BarChart3} title={emptyTitle} />
          ) : data.map((r) => (
            <tr key={r.name}>
              <td><StatusBadge status={r.name.toUpperCase().replace(/ /g, '_')} label={r.name} /></td>
              <td className="erp-num">{formatNumber(r.value)}</td>
              <td className="erp-num text-erp-text-muted">{total > 0 ? `${Math.round((r.value / total) * 100)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </ErpDataTable>
    </Section>
  );
}

export function FactoryTab({ data }: { data: FactoryReport }) {
  const s = data.summary;
  return (
    <div className="space-y-4">
      <KpiGrid cols={6}>
        <StatTile icon={Factory} label="Approved designs" value={formatNumber(s.approvedDesigns)} />
        <StatTile icon={TrendingUp} label="Batches in progress" value={formatNumber(s.batchesInProgress)} />
        <StatTile icon={BarChart3} label="Fulfillment" value={formatPct(s.fulfillmentPct)} />
        <StatTile icon={ShieldCheck} label="First-pass yield" value={formatPct(s.firstPassYield)} />
        <StatTile icon={IndianRupee} label="Unpaid payments" value={formatCompactCurrency(s.unpaidValue ?? s.openPoValue)} hint={currencyHint(s.unpaidValue ?? s.openPoValue)} />
        <StatTile icon={PackageX} label="Low stock alerts" value={formatNumber(s.lowStockAlerts)} highlight={(s.lowStockAlerts ?? 0) > 0 ? 'warn' : undefined} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-3">
        <BarStatusChart title="Designs by status" data={recordToChartData(data.designsByStatus)} link="/designs" emptyTitle="No designs in this period" />
        <BarStatusChart title="Production orders" data={recordToChartData(data.productionByStatus)} link="/production/orders" emptyTitle="No orders in this period" />
        <BarStatusChart title="Samples by status" data={recordToChartData(data.samplesByStatus)} link="/samples" emptyTitle="No samples in this period" />
      </div>
    </div>
  );
}

export function ProductionTab({ data }: { data: ProductionReport }) {
  return (
    <div className="space-y-4">
      <KpiGrid cols={6}>
        <StatTile label="Planned qty" value={formatNumber(data.totalPlannedQty)} />
        <StatTile label="Produced qty" value={formatNumber(data.totalProducedQty)} />
        <StatTile label="Passed final QC" value={formatNumber(data.totalPassedQty)} />
        <StatTile icon={Percent} label="Fulfillment" value={formatPct(data.fulfillmentPct)} hint="Passed vs planned" />
        <StatTile icon={Clock} label="Overdue orders" value={formatNumber(data.overdueOrders)} highlight={(data.overdueOrders ?? 0) > 0 ? 'warn' : undefined} />
        <StatTile icon={Factory} label="Batches in progress" value={formatNumber(data.batchesInProgress)} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-3">
        <BarStatusChart title="Orders by status" data={recordToChartData(data.ordersByStatus)} link="/production/orders" emptyTitle="No orders in this period" />
        <BarStatusChart title="Running batches by stage" description="Includes rework" data={recordToChartData(data.batchesByStage)} link="/production/orders" emptyTitle="No batches running" />
        <Section title="More figures">
          <DescriptionList
            columns={2}
            items={[
              { label: 'Rejected qty', value: formatNumber(data.totalRejectedQty) },
              { label: 'Batches completed', value: formatNumber(data.batchesCompleted) },
              { label: 'Rework batches', value: formatNumber(data.batchesRework) },
              { label: 'Cancelled orders', value: formatNumber(data.ordersCancelled) },
              { label: 'Cancelled batches', value: formatNumber(data.batchesCancelled) },
              { label: 'Capacity per hour', value: formatNumber(data.totalCapacityPerHour) },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}

export function InventoryTab({ data }: { data: InventoryReport }) {
  const navigate = useNavigate();
  const { data: lowStock, isLoading } = useQuery({
    queryKey: ['report-low-stock'],
    queryFn: () => reportApi.lowStockPage({ page: 1, limit: 10 }),
  });
  const rows = lowStock?.items ?? [];
  return (
    <div className="space-y-4">
      {/* No raw-material quantity total: materials mix metres, pieces and kg — value is the comparable figure. */}
      <KpiGrid cols={6}>
        <StatTile icon={Package} label="Materials" value={formatNumber(data.materialCount)} />
        <StatTile label="Dispatch ready" value={formatNumber(data.dispatchReady)} hint="Staged to ship" />
        <StatTile label="FG on hand" value={formatNumber(data.fgOnHand)} hint="Pieces" />
        <StatTile icon={IndianRupee} label="Stock value" value={formatCompactCurrency(data.stockValue)} hint={currencyHint(data.stockValue)} />
        <StatTile icon={PackageX} label="Low stock" value={formatNumber(data.lowStock)} highlight={(data.lowStock ?? 0) > 0 ? 'warn' : undefined} />
        <StatTile label="Out of stock" value={formatNumber(data.outOfStock)} highlight={(data.outOfStock ?? 0) > 0 ? 'warn' : undefined} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Section
            title="Low stock materials"
            description="Lowest cover first."
            actions={<Button size="sm" variant="ghost" onClick={() => navigate('/inventory?tab=alerts')}>Open in inventory</Button>}
            flush
          >
            <ErpDataTable>
              <thead>
                <tr><th>Material</th><th className="erp-num">Available</th><th className="erp-num">Reorder level</th><th className="erp-num">Value</th></tr>
              </thead>
              <tbody>
                {isLoading ? <TableSkeleton asRows rows={4} columns={4} /> : rows.length === 0 ? (
                  <EmptyRow colSpan={4} icon={Package} title="No low-stock materials">Everything is above its reorder level.</EmptyRow>
                ) : rows.map((r) => (
                  <tr key={r.materialId}>
                    <td>
                      <span className="erp-cell-primary block">{r.name}</span>
                      <span className="block font-mono text-xs text-erp-text-muted">{r.materialCode}</span>
                    </td>
                    <td className="erp-num">{formatNumber(r.available)} <span className="text-xs text-erp-text-muted">{r.unit}</span></td>
                    <td className="erp-num">{formatNumber(r.reorderLevel)}</td>
                    <td className="erp-num">{formatCurrency(r.stockValue)}</td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </Section>
        </div>
        <Section title="Reservations and dispatch">
          <DescriptionList
            columns={1}
            items={[
              { label: 'Dispatch ready', value: formatNumber(data.dispatchReady) },
              { label: 'RM reserved qty', value: formatNumber(data.rmReserved ?? data.totalReserved) },
              { label: 'FG reserved pieces', value: formatNumber(data.fgReserved) },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}

export function PurchaseTab({ data }: { data: PurchaseReport }) {
  return (
    <div className="space-y-4">
      <KpiGrid cols={6}>
        <StatTile icon={IndianRupee} label="Period spend" value={formatCompactCurrency(data.spendMtd)} hint={currencyHint(data.spendMtd)} />
        <StatTile icon={Wallet} label="Unpaid payments" value={formatNumber(data.poOpen)} />
        <StatTile label="Open payment value" value={formatCompactCurrency(data.openPoValue)} hint={currencyHint(data.openPoValue)} />
        <StatTile label="Receipts awaiting QC" value={formatNumber(data.grnPendingQc)} />
        <StatTile icon={Users} label="Suppliers" value={formatNumber(data.suppliers)} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable title="Requisitions by status" data={recordToChartData(data.prByStatus)} />
        <BreakdownTable title="Payments by status" data={recordToChartData(data.poByStatus)} />
      </div>
    </div>
  );
}

export function QualityTab({ data }: { data: QualityReport }) {
  const { data: defects = [], isLoading } = useQuery({
    queryKey: ['report-top-defects'],
    queryFn: () => reportApi.topDefects({ limit: 8 }),
  });
  const outcomes = [
    { name: 'Passed', value: data.passed ?? 0 },
    { name: 'Failed', value: data.failed ?? 0 },
    { name: 'Partial', value: data.partial ?? 0 },
    { name: 'Rework', value: data.rework ?? 0 },
  ].filter((r) => r.value > 0);
  return (
    <div className="space-y-4">
      <KpiGrid cols={6}>
        <StatTile icon={ShieldCheck} label="First-pass yield" value={outcomes.length ? formatPct(data.firstPassYield) : '—'} />
        <StatTile label="Pending inspections" value={formatNumber(data.pending)} />
        <StatTile label="Open CAPA" value={formatNumber(data.openCapa)} highlight={(data.openCapa ?? 0) > 0 ? 'warn' : undefined} />
        <StatTile label="Defects logged" value={formatNumber(data.defectsLogged)} />
        <StatTile icon={CheckCircle2} label="Passed" value={formatNumber(data.passed)} />
        <StatTile label="Receipts awaiting QC" value={formatNumber(data.pendingGrns)} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-3">
        <DonutChart title="Inspection outcomes" data={outcomes} link="/quality/inspections" emptyTitle="No inspections in this period" />
        <DonutChart title="Inspections by type" data={recordToChartData(data.inspectionsByType)} link="/quality/inspections" emptyTitle="No inspections in this period" />
        <Section title="Top defect categories" flush>
          <ErpDataTable>
            <thead><tr><th>Defect</th><th className="erp-num">Qty</th></tr></thead>
            <tbody>
              {isLoading ? <TableSkeleton asRows rows={4} columns={2} /> : defects.length === 0 ? (
                <EmptyRow colSpan={2} icon={ShieldCheck} title="No defects logged" />
              ) : defects.map((d) => (
                <tr key={d.code}>
                  <td><span className="erp-cell-primary">{d.name || d.code}</span> <span className="font-mono text-xs text-erp-text-muted">{d.code}</span></td>
                  <td className="erp-num">{formatNumber(d.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        </Section>
      </div>
    </div>
  );
}

export function WasteTab({ data }: { data: WasteReport }) {
  return (
    <div className="space-y-4">
      <KpiGrid cols={3}>
        <StatTile icon={Trash2} label="Waste records" value={formatNumber(data.count)} />
        <StatTile icon={IndianRupee} label="Total cost" value={formatCompactCurrency(data.totalCost)} hint={currencyHint(data.totalCost)} />
        <StatTile label="Recovered" value={formatNumber(data.recovered)} />
      </KpiGrid>
      <BarStatusChart title="Waste by type" data={recordToChartData(data.byType)} link="/waste" emptyTitle="No waste recorded in this period" />
    </div>
  );
}

export function MachineTab({ data }: { data: MachineReport }) {
  return (
    <div className="space-y-4">
      <KpiGrid cols={6}>
        <StatTile icon={Cog} label="Machines" value={formatNumber(data.total)} />
        <StatTile label="Active" value={formatNumber(data.active)} />
        <StatTile label="In maintenance" value={formatNumber(data.maintenance)} highlight={(data.maintenance ?? 0) > 0 ? 'warn' : undefined} />
        <StatTile icon={Percent} label="Utilization" value={formatPct(data.utilizationPct)} />
        <StatTile label="Capacity per hour" value={formatNumber(data.totalCapacityPerHour)} />
        <StatTile label="Production lines" value={formatNumber(data.lineCount)} />
      </KpiGrid>
      <DonutChart title="Machines by status" data={recordToChartData(data.machinesByStatus)} link="/production/machines" emptyTitle="No machines registered" />
    </div>
  );
}

export function EmployeeTab({ data }: { data: EmployeeReport }) {
  return (
    <div className="space-y-4">
      <KpiGrid cols={3}>
        <StatTile icon={Users} label="People with roles" value={formatNumber(data.assignedUsers)} />
        <StatTile label="Active" value={formatNumber(data.activeUsers)} />
        <StatTile label="Inactive" value={formatNumber(data.inactiveUsers)} />
      </KpiGrid>
      <BarStatusChart title="People by role" data={recordToChartData(data.usersByRole)} link="/users" horizontal emptyTitle="No role assignments" />
    </div>
  );
}

function paymentInvoiceFiles(po: PurchaseOrder, grns: GoodsReceipt[]) {
  const fromPo = (po.receipts || [])
    .map((r, index) => ({ ...r, kind: 'po' as const, docId: po._id, index }))
    .filter((r) => r.url);
  const fromGrn = grns.flatMap((g) => {
    const id = typeof g.poId === 'string' ? g.poId : g.poId?._id;
    if (id !== po._id) return [];
    return (g.receipts || [])
      .map((r, index) => ({ ...r, kind: 'grn' as const, docId: g._id, index }))
      .filter((r) => r.url);
  });
  return [...fromPo, ...fromGrn];
}

export function FinancialTab({ data }: { data: FinancialReport }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { permissions } = useAuth();
  const canMarkPaid = permissions.includes('*') || permissions.includes('purchase.pay');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['finance-payments'],
    queryFn: () => purchaseApi.listPOs({ limit: 50, excludeStatus: 'CANCELLED' }),
  });
  const { data: grns = [] } = useQuery({
    queryKey: ['finance-grns'],
    queryFn: () => purchaseApi.listGRNs({ limit: 200 }),
  });

  const markPaid = useMutation({
    mutationFn: (id: string) => purchaseApi.markPoPaid(id),
    meta: { successMessage: 'Payment marked as paid' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-payments'] });
      qc.invalidateQueries({ queryKey: ['purchase-stats'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['purchase-list'] });
    },
  });

  const downloadInvoice = (kind: 'po' | 'grn', id: string, index: number, fileName?: string) => {
    purchaseApi.downloadReceipt(kind, id, index, fileName).catch((e: unknown) => toast.error(getApiErrorMessage(e)));
  };

  const supplierName = (po: PurchaseOrder) => {
    const s = po.supplierId;
    if (!s || typeof s === 'string') return s || '—';
    return s.name || s.supplierCode;
  };

  const askMarkPaid = async (po: PurchaseOrder) => {
    const ok = await confirm({
      title: `Mark ${po.poNumber} as paid?`,
      message: `${formatCurrency(po.totalAmount)} to ${supplierName(po)}. Check the invoice and payment reference first — this cannot be undone here.`,
      confirmLabel: 'Mark paid',
      tone: 'primary',
    });
    if (ok) markPaid.mutate(po._id);
  };

  return (
    <div className="space-y-4">
      <KpiGrid cols={4}>
        <StatTile icon={IndianRupee} label="Purchase spend" value={formatCompactCurrency(data.purchaseSpend)} hint={currencyHint(data.purchaseSpend)} />
        <StatTile icon={Trash2} label="Waste cost" value={formatCompactCurrency(data.wasteCostTotal)} hint={currencyHint(data.wasteCostTotal)} />
        <StatTile icon={Package} label="Stock value" value={formatCompactCurrency(data.stockValue)} hint={currencyHint(data.stockValue)} />
        <StatTile label="Net exposure" value={formatCompactCurrency(data.netExposure)} hint={currencyHint(data.netExposure)} />
      </KpiGrid>

      <Section
        title="Supplier payments"
        description="Check the invoice, then mark the payment as paid."
        actions={<Button size="sm" variant="ghost" onClick={() => navigate('/purchase?tab=po')}>Open purchase payments</Button>}
        flush
      >
        <ErpDataTable>
          <thead>
            <tr>
              <th>Payment</th>
              <th>Supplier</th>
              <th className="erp-num">Amount</th>
              <th>Invoice</th>
              <th>Status</th>
              <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableSkeleton asRows rows={4} columns={6} /> : payments.length === 0 ? (
              <EmptyRow colSpan={6} icon={Wallet} title="No supplier payments yet">Payments appear once a requisition is approved and converted.</EmptyRow>
            ) : payments.map((po) => {
              const paid = po.paymentStatus === 'PAID';
              const invoices = paymentInvoiceFiles(po, grns as GoodsReceipt[]);
              return (
                <tr key={po._id}>
                  <td className="erp-cell-primary font-mono">{po.poNumber}</td>
                  <td>{supplierName(po)}</td>
                  <td className="erp-num">{formatCurrency(po.totalAmount)}</td>
                  <td>
                    {invoices.length === 0 ? (
                      <span className="text-erp-text-muted">None uploaded</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {invoices.map((inv) => {
                          const href = mediaUrl(inv.url);
                          const isPdf = /\.pdf($|\?)/i.test(inv.fileName || inv.url || '');
                          return (
                            <div key={`${inv.kind}-${inv.docId}-${inv.index}`} className="flex items-center gap-1.5">
                              {isPdf ? (
                                <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-[12rem] items-center gap-1 truncate text-[13px] text-erp-text-secondary hover:text-[var(--erp-accent)]" title={inv.fileName || 'Invoice PDF'}>
                                  <FileText size={14} aria-hidden="true" />{inv.fileName || 'PDF'}
                                </a>
                              ) : (
                                <PreviewableImage
                                  src={href}
                                  alt={inv.fileName || 'Invoice'}
                                  className="h-8 w-8 object-cover"
                                  onDownload={() => downloadInvoice(inv.kind, inv.docId, inv.index, inv.fileName)}
                                />
                              )}
                              <IconButton aria-label={`Download ${inv.fileName || 'invoice'}`} size="sm" onClick={() => downloadInvoice(inv.kind, inv.docId, inv.index, inv.fileName)}>
                                <Download size={16} />
                              </IconButton>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td><StatusBadge status={paid ? 'PAID' : 'PENDING'} label={paid ? 'Paid' : 'Unpaid'} /></td>
                  <td className="erp-cell-actions">
                    {canMarkPaid && !paid && (
                      <Button size="sm" variant="secondary" disabled={markPaid.isPending} onClick={() => askMarkPaid(po)}>Mark paid</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ErpDataTable>
      </Section>
    </div>
  );
}

export function ApprovalTab({ data }: { data: ApprovalReport }) {
  const navigate = useNavigate();
  const { data: pendingPage, isLoading } = useQuery({
    queryKey: ['report-pending-approvals'],
    queryFn: () => reportApi.pendingApprovalsPage({ page: 1, limit: 10 }),
  });
  const rows = pendingPage?.items ?? [];
  return (
    <div className="space-y-4">
      <KpiGrid cols={4}>
        <StatTile icon={Clock} label="Pending" value={formatNumber(data.pending)} />
        <StatTile icon={CheckCircle2} label="Approved" value={formatNumber(data.approved)} />
        <StatTile label="Rejected" value={formatNumber(data.rejected)} />
        <StatTile icon={Percent} label="Approval rate" value={(data.approved ?? 0) + (data.rejected ?? 0) > 0 ? formatPct(data.approvalRate) : '—'} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarStatusChart
          title="Pending by document type"
          data={Object.entries(data.pendingByType ?? {}).filter(([, v]) => v > 0).map(([k, v]) => ({ name: documentTypeLabel(k), value: v }))}
          link="/approvals"
          horizontal
          emptyTitle="Nothing waiting for approval"
        />
        <Section
          title="Oldest pending approvals"
          actions={<Button size="sm" variant="ghost" onClick={() => navigate('/approvals?tab=inbox')}>Open inbox</Button>}
          flush
        >
          <ErpDataTable>
            <thead><tr><th>Document type</th><th>Level</th><th>Submitted</th></tr></thead>
            <tbody>
              {isLoading ? <TableSkeleton asRows rows={4} columns={3} /> : rows.length === 0 ? (
                <EmptyRow colSpan={3} icon={CheckCircle2} title="Nothing waiting for approval" />
              ) : rows.map((a) => (
                <tr key={a._id}>
                  <td className="erp-cell-primary">{documentTypeLabel(a.documentType) || statusLabel(a.documentType)}</td>
                  <td>Level {a.currentLevel ?? 1}</td>
                  <td className="text-erp-text-muted">{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        </Section>
      </div>
    </div>
  );
}
