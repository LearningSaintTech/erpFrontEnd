import { type ReactNode } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Ban, Boxes, Eye, Factory, PackageCheck, Send, ShieldCheck, Truck,
} from 'lucide-react';
import {
  Button, DescriptionList, Drawer, ErpDataTable, ErpSelect, FilterBar, RowActionsMenu, SearchInput, StatusBadge,
  StepFlow, TablePager,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { purchaseApi } from '../../services/operations';
import type { GoodsReceipt, Material, PurchaseLine } from '../../types/api';
import { unitLabel } from '../inventory/inventoryUtils';
import { materialLabel, poNumber, workflowHint } from './purchaseUtils';
import { formatDate, PURCHASE_PAGE_SIZE, ReceiptThumbs, type PurchasePerms } from './purchaseShared';
import { downloadReceipt, useAttachReceipts, usePurchaseDialogs, type WorkflowAction } from './purchaseActions';
import type { MoreItem } from './RequisitionsTab';

export const GRN_STATUS_FILTERS = [
  { value: 'DRAFT,PENDING_QC,COMPLETED', label: 'All active' },
  { value: 'DRAFT', label: 'Draft — submit for QC' },
  { value: 'PENDING_QC', label: 'Awaiting QC' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

type GrnLine = { materialId?: string | Material; receivedQty?: number; acceptedQty?: number; unit?: string };
type GrnRow = Omit<GoodsReceipt, 'lines'> & { createdAt?: string; lines?: GrnLine[] };

type GrnCtx = {
  perms: PurchasePerms;
  run: (a: WorkflowAction) => void;
  dialogs: ReturnType<typeof usePurchaseDialogs>;
  navigate: NavigateFunction;
};

function grnActions(grn: GrnRow, ctx: GrnCtx) {
  const { perms, run, dialogs, navigate } = ctx;
  let primary: { label: string; icon: ReactNode; onClick: () => void } | null = null;
  if (grn.status === 'DRAFT' && perms.canUpdate) {
    primary = { label: 'Submit for QC', icon: <Send size={14} />, onClick: () => run({ type: 'submitGrn', id: grn._id, number: grn.grnNumber }) };
  } else if (grn.status === 'PENDING_QC' && perms.canOpenQc) {
    primary = { label: 'Open QC', icon: <ShieldCheck size={14} />, onClick: () => navigate('/quality/inspections?tab=incoming') };
  } else if (grn.status === 'COMPLETED' && perms.canPutAway) {
    // Land on put-away with this receipt's material already chosen.
    const first = grn.lines?.[0]?.materialId as PurchaseLine['materialId'] | undefined;
    const materialId = typeof first === 'string' ? first : first?._id;
    primary = {
      label: 'Put away',
      icon: <ArrowRight size={14} />,
      onClick: () => navigate(`/warehouse/operations/put-away${materialId ? `?materialId=${materialId}` : ''}`),
    };
  }
  const more: MoreItem[] = [
    { label: 'View stock', icon: Boxes, hidden: grn.status !== 'COMPLETED', onSelect: () => navigate('/inventory?tab=stock') },
    { label: 'Production orders', icon: Factory, hidden: grn.status !== 'COMPLETED' || !perms.canSeeProduction, onSelect: () => navigate('/production/orders') },
    { label: 'Cancel receipt', icon: Ban, danger: true, hidden: !(grn.status === 'DRAFT' && perms.canUpdate), onSelect: () => dialogs.cancelGrn(grn) },
  ];
  return { primary, more };
}

function itemsSummary(grn: GrnRow) {
  const lines = grn.lines || [];
  if (!lines.length) return <span className="text-erp-text-muted">—</span>;
  const shown = lines.slice(0, 2);
  return (
    <ul className="space-y-0.5">
      {shown.map((l, i) => {
        const qty = grn.status === 'COMPLETED' && l.acceptedQty != null ? l.acceptedQty : l.receivedQty;
        return (
          <li key={i} className="max-w-[280px] truncate text-[13px]">
            {materialLabel(l.materialId as PurchaseLine['materialId'])}
            <span className="erp-tabular text-erp-text-muted"> · {(qty ?? 0).toLocaleString()}</span>
          </li>
        );
      })}
      {lines.length > 2 && <li className="text-xs text-erp-text-muted">+{lines.length - 2} more</li>}
    </ul>
  );
}

export function ReceiptsTab({
  perms, status, onStatus, search, onSearch, page, onPage, highlightId, selectedId, onSelect, onNewGrn, run,
}: {
  perms: PurchasePerms;
  status: string;
  onStatus: (s: string) => void;
  search: string;
  onSearch: (s: string) => void;
  page: number;
  onPage: (p: number) => void;
  highlightId?: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNewGrn: () => void;
  run: (a: WorkflowAction) => void;
}) {
  const navigate = useNavigate();
  const dialogs = usePurchaseDialogs(run);
  const attach = useAttachReceipts();
  const defaultStatus = GRN_STATUS_FILTERS[0].value;
  const list = useQuery({
    queryKey: ['purchase-list', 'grn', page, search, status],
    queryFn: () => purchaseApi.listGRNsPage({
      page,
      limit: PURCHASE_PAGE_SIZE,
      search: search || undefined,
      ...(search && status === defaultStatus ? {} : { status }),
    }),
  });
  const rows = (list.data?.items ?? []) as GrnRow[];
  const meta = list.data?.meta;
  const filtered = !!search || status !== defaultStatus;
  const clear = () => { onSearch(''); onStatus(defaultStatus); };
  const ctx: GrnCtx = { perms, run, dialogs, navigate };
  const selected = rows.find((r) => r._id === selectedId) ?? null;

  return (
    <>
      <FilterBar
        search={<SearchInput value={search} onChange={onSearch} placeholder="Search GRN number…" inputSize="sm" />}
        filters={(
          <ErpSelect inputSize="sm" value={status} onChange={(e) => onStatus(e.target.value)} aria-label="Status">
            {GRN_STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </ErpSelect>
        )}
        onClear={filtered ? clear : undefined}
      />
      <QueryState
        skeleton="table"
        skeletonColumns={6}
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        isEmpty={!rows.length}
        emptyIcon={Truck}
        emptyMessage={filtered ? 'No goods receipts match these filters' : 'No goods received yet'}
        emptyDescription={filtered ? 'Try another status or clear the search.' : 'Record a receipt when a supplier delivery arrives.'}
        emptyAction={filtered
          ? <Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button>
          : perms.canReceive ? <Button size="sm" icon={<PackageCheck size={16} />} onClick={onNewGrn}>Receive goods</Button> : undefined}
      >
        <div className="erp-table-wrap">
          <ErpDataTable className="w-full min-w-[860px]">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Payment</th>
                <th>Items</th>
                <th>Invoice</th>
                <th>Status</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((grn) => {
                const a = grnActions(grn, ctx);
                const sel = selectedId === grn._id || highlightId === grn._id;
                return (
                  <tr key={grn._id} className={`erp-row-clickable${sel ? ' erp-row-selected' : ''}`} onClick={() => onSelect(grn._id)}>
                    <td className="whitespace-nowrap">
                      <span className="erp-cell-primary font-mono">{grn.grnNumber}</span>
                      {grn.createdAt && <p className="text-xs text-erp-text-muted">{formatDate(grn.createdAt)}</p>}
                    </td>
                    <td className="font-mono text-erp-text-secondary">{poNumber(grn.poId)}</td>
                    <td>{itemsSummary(grn)}</td>
                    <td>
                      <ReceiptThumbs
                        items={(grn.receipts || []).map((r, index) => ({ ...r, kind: 'grn' as const, docId: grn._id, index }))}
                        canAdd={perms.canReceive && (grn.receipts?.length || 0) < 12}
                        onAdd={(files) => attach.mutate({ kind: 'grn', id: grn._id, current: grn.receipts || [], files })}
                        onDownload={downloadReceipt}
                      />
                    </td>
                    <td className="max-w-[240px]">
                      <StatusBadge status={grn.status} />
                      {grn.status === 'DRAFT' && !(grn.receipts?.length) && (
                        <p className="mt-1 text-xs text-[var(--erp-warning-text)]">No invoice attached</p>
                      )}
                    </td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {a.primary && (
                          <Button size="sm" variant="secondary" icon={a.primary.icon} onClick={(e) => { e.stopPropagation(); a.primary?.onClick(); }}>
                            {a.primary.label}
                          </Button>
                        )}
                        <RowActionsMenu items={[{ label: 'View details', icon: Eye, onSelect: () => onSelect(grn._id) }, ...a.more]} />
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
            itemLabel="receipts"
            onPrev={() => onPage(page - 1)}
            onNext={() => onPage(page + 1)}
          />
        )}
      </QueryState>

      <GrnDetailDrawer grn={selected} onClose={() => onSelect(null)} ctx={ctx} />
    </>
  );
}

function GrnDetailDrawer({ grn, onClose, ctx }: { grn: GrnRow | null; onClose: () => void; ctx: GrnCtx }) {
  const attach = useAttachReceipts();
  if (!grn) return <Drawer open={false} onClose={onClose} title="" />;
  const a = grnActions(grn, ctx);
  const visibleMore = a.more.filter((m) => !m.hidden);
  const current = grn.status === 'DRAFT' ? 'received' : grn.status === 'PENDING_QC' ? 'qc' : 'stock';
  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={`Goods receipt ${grn.grnNumber}`}
      description={`Against payment ${poNumber(grn.poId)}`}
      headerExtra={<StatusBadge status={grn.status} />}
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
        <StepFlow
          size="sm"
          current={current}
          steps={grn.status === 'CANCELLED'
            ? [{ id: 'received', label: 'Received', state: 'done' }, { id: 'qc', label: 'Cancelled', state: 'blocked' }, { id: 'stock', label: 'In stock' }]
            : [
              { id: 'received', label: 'Received', description: grn.createdAt ? formatDate(grn.createdAt) : undefined },
              { id: 'qc', label: 'Incoming QC' },
              { id: 'stock', label: 'In stock', ...(grn.status === 'COMPLETED' ? { state: 'done' as const } : {}) },
            ]}
        />
        <p className="text-[13px] text-erp-text-muted">{workflowHint('grn', grn.status)}</p>
        <DescriptionList
          columns={2}
          items={[
            { label: 'Payment', value: poNumber(grn.poId) },
            { label: 'Incoming QC', value: grn.qcInspectionId && typeof grn.qcInspectionId === 'object' ? grn.qcInspectionId.inspectionNumber : undefined },
          ]}
        />
        <div>
          <h3 className="mb-2 text-sm font-semibold text-erp-text-primary">Items</h3>
          <div className="erp-table-wrap rounded-lg border border-[var(--erp-border)]">
            <ErpDataTable className="w-full">
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="erp-num">Received</th>
                  <th className="erp-num">Accepted</th>
                </tr>
              </thead>
              <tbody>
                {(grn.lines || []).map((l, i) => (
                  <tr key={i}>
                    <td className="min-w-[160px]">{materialLabel(l.materialId as PurchaseLine['materialId'])}</td>
                    <td className="erp-num">{(l.receivedQty ?? 0).toLocaleString()} {l.unit ? unitLabel(l.unit) : ''}</td>
                    <td className="erp-num">{l.acceptedQty != null ? l.acceptedQty.toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-erp-text-primary">Supplier invoice</h3>
          <ReceiptThumbs
            items={(grn.receipts || []).map((r, index) => ({ ...r, kind: 'grn' as const, docId: grn._id, index }))}
            canAdd={ctx.perms.canReceive && (grn.receipts?.length || 0) < 12}
            addLabel="Upload invoice"
            onAdd={(files) => attach.mutate({ kind: 'grn', id: grn._id, current: grn.receipts || [], files })}
            onDownload={downloadReceipt}
          />
        </div>
      </div>
    </Drawer>
  );
}
