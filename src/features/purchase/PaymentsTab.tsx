import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Ban, CheckCircle2, CircleSlash, Eye, IndianRupee, PackageCheck, Wallet,
} from 'lucide-react';
import {
  Button, DescriptionList, Drawer, ErpDataTable, ErpSelect, FilterBar, RowActionsMenu, SearchInput, StatusBadge,
  StepFlow, TablePager, type Step,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { purchaseApi } from '../../services/operations';
import type { GoodsReceipt, PurchaseOrder } from '../../types/api';
import { unitLabel } from '../inventory/inventoryUtils';
import {
  canCancelPo, canClosePo, findGrnsForPo, formatCurrency, materialLabel, PO_OPEN_STATUSES, prNumber, supplierLabel,
  workflowHint,
} from './purchaseUtils';
import {
  formatDate, LinesList, lineQty, PURCHASE_PAGE_SIZE, ReceiptThumbs, type PurchasePerms, type ReceiptFile,
} from './purchaseShared';
import { downloadReceipt, useAttachReceipts, usePurchaseDialogs, type WorkflowAction } from './purchaseActions';
import type { MoreItem } from './RequisitionsTab';

export const PO_STATUS_FILTERS = [
  { value: 'DRAFT,APPROVED,SENT,PARTIAL,RECEIVED,CLOSED', label: 'All active' },
  { value: 'DRAFT', label: 'Awaiting approval' },
  { value: 'APPROVED,SENT,PARTIAL', label: 'To receive' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CLOSED', label: 'Short-closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

type PoCtx = {
  perms: PurchasePerms;
  run: (a: WorkflowAction) => void;
  dialogs: ReturnType<typeof usePurchaseDialogs>;
  onReceive: (poId: string) => void;
  /** Upload supplier invoice files onto the payment (resolves when saved). */
  uploadInvoice: (po: PurchaseOrder, files: File[]) => Promise<unknown>;
};

function poActions(po: PurchaseOrder, grns: GoodsReceipt[], ctx: PoCtx) {
  const { perms, run, dialogs, onReceive } = ctx;
  const paid = po.paymentStatus === 'PAID';
  const hasInvoice = (po.receipts?.length || 0) + grns.reduce((n, g) => n + (g.receipts?.length || 0), 0) > 0;
  const canApproveIt = perms.canApprove && po.status === 'DRAFT';
  const canReceiveIt = perms.canReceive && PO_OPEN_STATUSES.includes(po.status);
  const canPayIt = perms.canMarkPaid && !paid && po.status !== 'CANCELLED';
  const receive = { label: 'Receive goods', icon: <PackageCheck size={14} />, onClick: () => onReceive(po._id) };
  const pay = { label: 'Mark paid', icon: <IndianRupee size={14} />, onClick: () => dialogs.markPaid(po, hasInvoice, (files) => ctx.uploadInvoice(po, files)) };
  let primary: { label: string; icon: ReactNode; onClick: () => void } | null = null;
  if (canApproveIt) primary = { label: 'Approve', icon: <CheckCircle2 size={14} />, onClick: () => run({ type: 'approvePo', id: po._id, number: po.poNumber }) };
  else if (canReceiveIt) primary = receive;
  else if (canPayIt) primary = pay;
  const more: MoreItem[] = [
    { label: 'Receive goods', icon: PackageCheck, hidden: !canReceiveIt || primary === receive, onSelect: receive.onClick },
    { label: 'Mark paid', icon: Wallet, hidden: !canPayIt || primary === pay, onSelect: pay.onClick },
    {
      label: 'Short-close',
      icon: CircleSlash,
      hidden: !(perms.canUpdate && perms.canApprove && canClosePo(po)),
      onSelect: () => dialogs.closePo(po),
    },
    {
      label: 'Cancel payment',
      icon: Ban,
      danger: true,
      hidden: !(perms.canUpdate && perms.canApprove && canCancelPo(po) && !grns.some((g) => g.status !== 'CANCELLED')),
      onSelect: () => dialogs.cancelPo(po),
    },
  ];
  return { primary, more, paid };
}

function invoiceItemsOf(po: PurchaseOrder, grns: GoodsReceipt[]): ReceiptFile[] {
  return [
    ...(po.receipts || []).map((r, index) => ({ ...r, kind: 'po' as const, docId: po._id, index })),
    ...grns.flatMap((g) => (g.receipts || []).map((r, index) => ({ ...r, kind: 'grn' as const, docId: g._id, index }))),
  ];
}

export function PaymentsTab({
  perms, status, onStatus, pay, onPay, search, onSearch, page, onPage, highlightId, selectedId, onSelect,
  onReceive, onNewPayment, run,
}: {
  perms: PurchasePerms;
  status: string;
  onStatus: (s: string) => void;
  pay: string;
  onPay: (s: string) => void;
  search: string;
  onSearch: (s: string) => void;
  page: number;
  onPage: (p: number) => void;
  highlightId?: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReceive: (poId: string) => void;
  onNewPayment: () => void;
  run: (a: WorkflowAction) => void;
}) {
  const dialogs = usePurchaseDialogs(run);
  const attach = useAttachReceipts();
  const defaultStatus = PO_STATUS_FILTERS[0].value;
  const list = useQuery({
    queryKey: ['purchase-list', 'po', page, search, status, pay],
    queryFn: () => purchaseApi.listPOsPage({
      page,
      limit: PURCHASE_PAGE_SIZE,
      search: search || undefined,
      // A search by number should also find cancelled payments.
      ...(search && status === defaultStatus ? {} : { status }),
      paymentStatus: pay || undefined,
    }),
  });
  const { data: grns = [] } = useQuery({
    queryKey: ['grns-history-link'],
    queryFn: () => purchaseApi.listGRNs({ limit: 500 }),
  });
  const rows = (list.data?.items ?? []) as PurchaseOrder[];
  const meta = list.data?.meta;
  const filtered = !!search || status !== defaultStatus || !!pay;
  const clear = () => { onSearch(''); onStatus(defaultStatus); onPay(''); };
  const ctx: PoCtx = {
    perms, run, dialogs, onReceive,
    uploadInvoice: (po, files) => attach.mutateAsync({ kind: 'po', id: po._id, current: po.receipts || [], files }),
  };
  const selected = rows.find((r) => r._id === selectedId) ?? null;

  return (
    <>
      <FilterBar
        search={<SearchInput value={search} onChange={onSearch} placeholder="Search payment number…" inputSize="sm" />}
        filters={(
          <>
            <ErpSelect inputSize="sm" value={status} onChange={(e) => onStatus(e.target.value)} aria-label="Status">
              {PO_STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </ErpSelect>
            <ErpSelect inputSize="sm" value={pay} onChange={(e) => onPay(e.target.value)} aria-label="Payment">
              <option value="">Paid and unpaid</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PAID">Paid</option>
            </ErpSelect>
          </>
        )}
        onClear={filtered ? clear : undefined}
      />
      <QueryState
        skeleton="table"
        skeletonColumns={7}
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        isEmpty={!rows.length}
        emptyIcon={Wallet}
        emptyMessage={filtered ? 'No payments match these filters' : 'No payments yet'}
        emptyDescription={filtered ? 'Try another status or clear the filters.' : 'Payments are created from approved requisitions after you agree a price with the supplier.'}
        emptyAction={filtered
          ? <Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button>
          : perms.canExecute ? <Button size="sm" onClick={onNewPayment}>Create payment</Button> : undefined}
      >
        <div className="erp-table-wrap">
          <ErpDataTable className="w-full min-w-[960px]">
            <thead>
              <tr>
                <th>Payment</th>
                <th>Supplier</th>
                <th className="erp-num">Amount</th>
                <th>Items</th>
                <th>Invoice</th>
                <th>Status</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((po) => {
                const linked = findGrnsForPo(grns, po._id);
                const a = poActions(po, linked, ctx);
                const sel = selectedId === po._id || highlightId === po._id;
                return (
                  <tr key={po._id} className={`erp-row-clickable${sel ? ' erp-row-selected' : ''}`} onClick={() => onSelect(po._id)}>
                    <td className="whitespace-nowrap">
                      <span className="erp-cell-primary font-mono">{po.poNumber}</span>
                      <p className="text-xs text-erp-text-muted">
                        {po.prId ? `${prNumber(po.prId)} · ` : ''}{formatDate(po.createdAt)}
                      </p>
                    </td>
                    <td className="max-w-[200px] truncate" title={supplierLabel(po.supplierId)}>{supplierLabel(po.supplierId)}</td>
                    <td className="erp-num font-medium">{formatCurrency(po.totalAmount)}</td>
                    <td><LinesList lines={po.lines} itemWidth="max-w-[220px]" /></td>
                    <td>
                      <ReceiptThumbs
                        items={invoiceItemsOf(po, linked)}
                        canAdd={(perms.canReceive || perms.canMarkPaid) && (po.receipts?.length || 0) < 12}
                        onAdd={(files) => attach.mutate({ kind: 'po', id: po._id, current: po.receipts || [], files })}
                        onDownload={downloadReceipt}
                      />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge status={po.status} />
                        {po.status !== 'CANCELLED' && (
                          <StatusBadge status={a.paid ? 'PAID' : 'UNPAID'} tone={a.paid ? 'success' : 'warning'} label={a.paid ? 'Paid' : 'Unpaid'} />
                        )}
                      </div>
                    </td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {a.primary && (
                          <Button size="sm" variant="secondary" icon={a.primary.icon} onClick={(e) => { e.stopPropagation(); a.primary?.onClick(); }}>
                            {a.primary.label}
                          </Button>
                        )}
                        <RowActionsMenu items={[{ label: 'View details', icon: Eye, onSelect: () => onSelect(po._id) }, ...a.more]} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
        </div>
        {meta && (
          <TablePager
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={PURCHASE_PAGE_SIZE}
            itemLabel="payments"
            onPrev={() => onPage(page - 1)}
            onNext={() => onPage(page + 1)}
          />
        )}
      </QueryState>

      <PoDetailDrawer po={selected} grns={selected ? findGrnsForPo(grns, selected._id) : []} onClose={() => onSelect(null)} ctx={ctx} />
    </>
  );
}

function poSteps(po: PurchaseOrder, grns: GoodsReceipt[]): { steps: Step[]; current: string } {
  const paid = po.paymentStatus === 'PAID';
  const qcDone = grns.some((g) => g.status === 'COMPLETED');
  const order = ['created', 'approved', 'received', 'qc', 'paid'];
  let current = 'approved';
  if (po.status === 'DRAFT') current = 'created';
  else if (['RECEIVED', 'CLOSED'].includes(po.status) || grns.some((g) => g.status !== 'CANCELLED')) current = qcDone ? 'paid' : 'qc';
  else current = 'received';
  if (paid) current = 'paid';
  const steps: Step[] = [
    { id: 'created', label: 'Created', description: formatDate(po.createdAt) },
    { id: 'approved', label: 'Approved' },
    { id: 'received', label: 'Goods received', description: po.status === 'PARTIAL' ? 'Partly' : undefined },
    { id: 'qc', label: 'Incoming QC' },
    { id: 'paid', label: 'Paid', description: paid && po.paidAt ? formatDate(po.paidAt) : undefined, ...(paid ? { state: 'done' as const } : {}) },
  ];
  if (po.status === 'CANCELLED') {
    return { steps: steps.map((s) => (s.id === 'approved' ? { ...s, label: 'Cancelled', state: 'blocked' as const } : s)), current: 'approved' };
  }
  return { steps, current: order.includes(current) ? current : 'approved' };
}

export function PoDetailDrawer({
  po, grns, onClose, ctx,
}: {
  po: PurchaseOrder | null;
  grns: GoodsReceipt[];
  onClose: () => void;
  ctx: PoCtx;
}) {
  const attach = useAttachReceipts();
  if (!po) return <Drawer open={false} onClose={onClose} title="" />;
  const a = poActions(po, grns, ctx);
  const visibleMore = a.more.filter((m) => !m.hidden);
  const { steps, current } = poSteps(po, grns);
  const lines = (po.lines || []) as Array<NonNullable<PurchaseOrder['lines']>[number]>;

  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={`Payment ${po.poNumber}`}
      description={`${supplierLabel(po.supplierId)} · ${formatCurrency(po.totalAmount)}`}
      headerExtra={<StatusBadge status={po.status} />}
      footer={a.primary || visibleMore.length ? (
        <>
          {visibleMore.map((m, i) => (
            <Button key={m.label} variant={m.danger ? 'danger' : 'secondary'} className={i === 0 ? 'mr-auto' : undefined} onClick={m.onSelect}>
              {m.label}
            </Button>
          ))}
          {a.primary && <Button icon={a.primary.icon} onClick={a.primary.onClick}>{a.primary.label}</Button>}
        </>
      ) : undefined}
    >
      <div className="space-y-5">
        <StepFlow steps={steps} current={current} size="sm" />
        <p className="text-[13px] text-erp-text-muted">{workflowHint('po', po.status)}</p>
        <DescriptionList
          columns={2}
          items={[
            { label: 'Supplier', value: supplierLabel(po.supplierId) },
            { label: 'Requisition', value: po.prId ? prNumber(po.prId) : undefined },
            { label: 'Amount', value: <span className="erp-tabular">{formatCurrency(po.totalAmount)}</span> },
            {
              label: 'Payment',
              value: a.paid
                ? `Paid${po.paidAt ? ` on ${formatDate(po.paidAt)}` : ''}`
                : po.status === 'CANCELLED' ? 'Cancelled' : 'Not paid yet',
            },
          ]}
        />

        <div>
          <h3 className="mb-2 text-sm font-semibold text-erp-text-primary">Items</h3>
          <div className="erp-table-wrap rounded-lg border border-[var(--erp-border)]">
            <ErpDataTable className="w-full">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="erp-num">Ordered</th>
                  <th className="erp-num">Received</th>
                  <th className="erp-num">Unit price</th>
                  <th className="erp-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const qty = l.orderedQty ?? lineQty(l);
                  return (
                    <tr key={i}>
                      <td className="min-w-[160px]">{materialLabel(l.materialId)}</td>
                      <td className="erp-num">{qty.toLocaleString()} {unitLabel(l.unit)}</td>
                      <td className="erp-num">{(l.receivedQty ?? 0).toLocaleString()}</td>
                      <td className="erp-num">{formatCurrency(l.unitPrice ?? 0)}</td>
                      <td className="erp-num">{formatCurrency(qty * (l.unitPrice ?? 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </ErpDataTable>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-erp-text-primary">Invoices &amp; documents</h3>
          <ReceiptThumbs
            items={invoiceItemsOf(po, grns)}
            canAdd={(ctx.perms.canReceive || ctx.perms.canMarkPaid) && (po.receipts?.length || 0) < 12}
            addLabel="Upload"
            onAdd={(files) => attach.mutate({ kind: 'po', id: po._id, current: po.receipts || [], files })}
            onDownload={downloadReceipt}
          />
        </div>

        {grns.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-erp-text-primary">Goods receipts</h3>
            <ul className="divide-y divide-[var(--erp-border)] rounded-lg border border-[var(--erp-border)]">
              {grns.map((g) => (
                <li key={g._id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="font-mono text-[13px] font-medium">{g.grnNumber}</span>
                  <StatusBadge status={g.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  );
}
