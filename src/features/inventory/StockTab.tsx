import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowDownToLine, ArrowRight, Boxes, Download, Hand, History, MapPin, ShoppingCart,
} from 'lucide-react';
import {
  Button, ErpDataTable, Field, FilterBar, InfoBanner, Modal, RowActionsMenu, SearchInput, StatusBadge,
  TablePager, toast,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { inventoryApi } from '../../services/manufacturing';
import { purchaseApi } from '../../services/operations';
import type { InventoryBalance, PurchaseRequisition } from '../../types/api';
import { downloadCsv, fetchAllPages } from '../../utils/csvExport';
import { UnitInput, useDebounced } from '../purchase/purchaseShared';
import {
  balanceLocationLabel, formatCurrency, materialDisplayName, materialIdFromBalance, putAwayPath,
  stockLocatorPath, stockWorkflowHint, suggestedPrQty, unitLabel,
} from './inventoryUtils';
import {
  INVENTORY_PAGE_SIZE, LocationPill, MaterialCell, useInvalidateInventory, type InventoryPerms,
} from './inventoryLayout';

const OPEN_PR_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'APPROVED']);
type OpenPr = { prNumber: string; status: string; prId: string };

function prLineMaterialId(line: { materialId?: string | { _id: string } }): string {
  if (!line.materialId) return '';
  return typeof line.materialId === 'string' ? line.materialId : line.materialId._id;
}

/** Qty already on open PRs / unreceived POs / GRNs awaiting QC (from the API). */
const onOrderOf = (b: InventoryBalance) => (b as InventoryBalance & { onOrderQty?: number }).onOrderQty ?? 0;
const needsPurchase = (b: InventoryBalance) => Boolean(b.isLowStock || b.isOutOfStock);

function stockStatus(b: InventoryBalance) {
  if (b.isOutOfStock) return { status: 'OUT', tone: 'danger' as const, label: 'Out of stock' };
  if (b.isLowStock) return { status: 'LOW', tone: 'warning' as const, label: 'Low stock' };
  return { status: 'OK', tone: 'success' as const, label: 'In stock' };
}

/* ───────────────────────── Request purchase ───────────────────────── */

function RequestPurchaseModal({
  balance, onClose, onRequested,
}: {
  balance: InventoryBalance | null;
  onClose: () => void;
  onRequested: (materialId: string, pr: PurchaseRequisition) => void;
}) {
  const invalidate = useInvalidateInventory();
  const navigate = useNavigate();
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const suggested = balance ? suggestedPrQty(balance) : 0;

  useEffect(() => {
    if (balance) { setQty(String(suggestedPrQty(balance))); setError(''); }
  }, [balance]);

  const request = useMutation({
    mutationFn: async () => {
      const b = balance!;
      const materialId = materialIdFromBalance(b);
      if (!materialId) throw new Error('Material missing on this balance');
      const mat = typeof b.materialId === 'object' ? b.materialId : undefined;
      const pr = await purchaseApi.createPR({
        lines: [{
          materialId,
          requiredQty: Number(qty),
          unit: mat?.unit || b.unit || 'PIECES',
          estimatedUnitCost: mat?.unitCost ?? 0,
        }],
      });
      const submitted = await purchaseApi.submitPR(pr._id);
      return { pr: submitted, materialId };
    },
    onSuccess: ({ pr, materialId }) => {
      onRequested(materialId, pr);
      invalidate();
      toast.success(`${pr.prNumber} sent for approval`, {
        description: 'The factory admin approves it, then purchase records the payment.',
        action: { label: 'Open', onClick: () => navigate('/purchase') },
      });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!(Number(qty) > 0)) { setError('Enter a quantity above 0.'); return; }
    request.mutate();
  };

  return (
    <Modal
      open={!!balance}
      onClose={onClose}
      size="sm"
      title="Request purchase"
      description={balance ? materialDisplayName(balance.materialId) : undefined}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="request-pr-form" icon={<ShoppingCart size={16} />} loading={request.isPending} disabled={!(Number(qty) > 0)}>
            Send for approval
          </Button>
        </>
      )}
    >
      {balance && (
        <form id="request-pr-form" onSubmit={submit} noValidate className="space-y-4">
          <p className="text-[13px] text-erp-text-secondary">
            Available <span className="erp-tabular font-medium text-erp-text-primary">{(balance.available ?? 0).toLocaleString()} {unitLabel(balance.unit)}</span>
            {balance.reorderLevel ? <> · reorder level <span className="erp-tabular font-medium text-erp-text-primary">{balance.reorderLevel.toLocaleString()}</span></> : null}
          </p>
          <Field
            label="Quantity to buy"
            required
            error={error}
            hint={balance.isLowStock || balance.isOutOfStock
              ? `Suggested: ${suggested.toLocaleString()} ${unitLabel(balance.unit).toLowerCase()} to get back above the reorder level.`
              : undefined}
          >
            <UnitInput min={0} step="any" unit={unitLabel(balance.unit)} value={qty} onChange={(e) => { setQty(e.target.value); setError(''); }} autoFocus />
          </Field>
          <p className="text-[13px] text-erp-text-muted">A purchase requisition is created and sent to the factory admin for approval.</p>
        </form>
      )}
    </Modal>
  );
}

/* ───────────────────────── Stock / alerts list ───────────────────────── */

export function StockTab({
  perms, alertsOnly, materialCount, dockCount, onAddMaterial, onReceive, onReserve, onMovements,
}: {
  perms: InventoryPerms;
  alertsOnly: boolean;
  materialCount?: number;
  dockCount?: number;
  onAddMaterial: () => void;
  onReceive: (materialId: string) => void;
  onReserve: (materialId: string) => void;
  onMovements: (materialId: string) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  const [requesting, setRequesting] = useState<InventoryBalance | null>(null);
  const [justRequested, setJustRequested] = useState<Record<string, OpenPr>>({});
  useEffect(() => { setPage(1); }, [search, alertsOnly]);

  const list = useQuery({
    queryKey: ['inventory-balances-page', page, search, alertsOnly ? 'alerts' : 'stock'],
    queryFn: () => inventoryApi.listBalancesPage({ page, limit: INVENTORY_PAGE_SIZE, search: search || undefined, lowStockOnly: alertsOnly }),
  });
  const rows = list.data?.items ?? [];
  const meta = list.data?.meta;

  const { data: openPrs = [] } = useQuery({
    queryKey: ['prs-open-for-alerts'],
    queryFn: () => purchaseApi.listPRs({ limit: 200 }),
    enabled: perms.canRequestPurchase,
    select: (prs) => (prs as PurchaseRequisition[]).filter((p) => OPEN_PR_STATUSES.has(p.status)),
  });
  const requestedByMaterial = useMemo(() => {
    const map = new Map<string, OpenPr>();
    for (const pr of openPrs) {
      for (const line of pr.lines || []) {
        const mid = prLineMaterialId(line);
        if (mid && !map.has(mid)) map.set(mid, { prNumber: pr.prNumber, status: pr.status, prId: pr._id });
      }
    }
    return map;
  }, [openPrs]);

  const onDockRows = rows.filter((b) => !b.storageBinId && (b.available ?? 0) > 0);

  // Every row matching the current search / alerts filter — not just the page on screen.
  const exportCsv = async () => {
    try {
      const all = await fetchAllPages((p) => inventoryApi.listBalancesPage({ ...p, search: search || undefined, lowStockOnly: alertsOnly }));
      downloadCsv(
        alertsOnly ? 'inventory-alerts.csv' : 'inventory-stock.csv',
        ['Material', 'Location', 'On hand', 'Reserved', 'Available', 'Unit', 'Reorder level', 'Value', 'Status'],
        all.map((b) => [
          materialDisplayName(b.materialId), balanceLocationLabel(b), b.onHand ?? 0, b.reserved ?? 0, b.available ?? 0,
          unitLabel(b.unit), b.reorderLevel ?? '', b.stockValue != null ? Math.round(b.stockValue) : '', stockStatus(b).label,
        ]),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  return (
    <>
      {!alertsOnly && (materialCount ?? 1) === 0 && (
        <InfoBanner tone="info" title="Start by adding materials" action={perms.canCreate ? <Button size="sm" onClick={onAddMaterial}>Add material</Button> : undefined}>
          Stock appears here after a purchase receipt passes QC, or after a manual receipt for opening balances.
        </InfoBanner>
      )}
      {!alertsOnly && onDockRows.length > 0 && perms.canPutAway && (
        <InfoBanner
          tone="info"
          title={`${onDockRows.length} material${onDockRows.length === 1 ? '' : 's'} waiting on the dock`}
          action={<Button size="sm" variant="secondary" iconRight={<ArrowRight size={14} />} onClick={() => navigate('/warehouse/operations/put-away')}>Put away</Button>}
        >
          QC-passed goods land on the unallocated dock. Put them into a storage bin so pickers can find them.
        </InfoBanner>
      )}

      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="Search material code or name…" inputSize="sm" />}
        onClear={q ? () => setQ('') : undefined}
        actions={perms.canExport ? (
          <Button size="sm" variant="secondary" icon={<Download size={16} />} disabled={!rows.length} onClick={exportCsv}>Export</Button>
        ) : undefined}
      />

      <QueryState
        skeleton="table"
        skeletonColumns={8}
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        isEmpty={!rows.length}
        emptyIcon={alertsOnly ? AlertTriangle : Boxes}
        emptyMessage={search ? 'No stock matches this search' : alertsOnly ? 'No stock alerts' : 'No stock yet'}
        emptyDescription={search ? undefined : alertsOnly
          ? 'Every material is above its reorder level.'
          : <>Stock arrives through a <Link to="/purchase?tab=grn" className="text-[var(--erp-accent)] hover:underline">purchase goods receipt</Link> and incoming QC.</>}
        emptyAction={search ? <Button size="sm" variant="secondary" onClick={() => setQ('')}>Clear search</Button> : undefined}
      >
        <div className="erp-table-wrap">
          <ErpDataTable className="w-full min-w-[980px]">
            <thead>
              <tr>
                <th>Material</th>
                <th>Location</th>
                <th className="erp-num">On hand</th>
                <th className="erp-num">Reserved</th>
                <th className="erp-num">Available</th>
                <th className="erp-num">Reorder</th>
                <th className="erp-num">Value</th>
                <th>Status</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const st = stockStatus(b);
                const onDock = !b.storageBinId;
                const materialId = materialIdFromBalance(b);
                const existingPr = materialId ? (requestedByMaterial.get(materialId) || justRequested[materialId]) : undefined;
                const onOrder = onOrderOf(b);
                const canRequest = perms.canRequestPurchase && needsPurchase(b) && !existingPr && onOrder <= 0;
                const canPutAwayRow = perms.canPutAway && onDock && (b.available ?? 0) > 0;
                const canPickRow = perms.canPutAway && !onDock && (b.available ?? 0) > 0;
                const hint = stockWorkflowHint(b);
                return (
                  <tr key={b._id} title={hint || undefined}>
                    <td><MaterialCell materialId={b.materialId} /></td>
                    <td><LocationPill label={balanceLocationLabel(b)} onDock={onDock} /></td>
                    <td className="erp-num">{(b.onHand ?? 0).toLocaleString()} <span className="text-xs text-erp-text-muted">{unitLabel(b.unit)}</span></td>
                    <td className="erp-num text-erp-text-muted">{(b.reserved ?? 0).toLocaleString()}</td>
                    <td className="erp-num font-medium">{(b.available ?? 0).toLocaleString()}</td>
                    <td className="erp-num text-erp-text-muted">{b.reorderLevel != null ? b.reorderLevel.toLocaleString() : '—'}</td>
                    <td className="erp-num">{b.stockValue != null ? formatCurrency(b.stockValue) : '—'}</td>
                    <td className="max-w-[200px]">
                      <StatusBadge status={st.status} tone={st.tone} label={st.label} />
                      {existingPr && needsPurchase(b) && (
                        <p className="mt-1 text-xs text-erp-text-muted">
                          Requested on <Link to="/purchase" className="font-medium text-[var(--erp-accent)] hover:underline">{existingPr.prNumber}</Link>
                        </p>
                      )}
                      {!existingPr && onOrder > 0 && needsPurchase(b) && (
                        <p className="mt-1 text-xs text-erp-text-muted">On order: {onOrder.toLocaleString()} {unitLabel(b.unit).toLowerCase()}</p>
                      )}
                    </td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {canRequest ? (
                          <Button size="sm" variant="secondary" icon={<ShoppingCart size={14} />} onClick={() => setRequesting(b)}>Request</Button>
                        ) : canPutAwayRow ? (
                          <Button size="sm" variant="secondary" iconRight={<ArrowRight size={14} />} onClick={() => navigate(putAwayPath(materialId))}>Put away</Button>
                        ) : null}
                        <RowActionsMenu items={[
                          // Buying ahead of an alert (e.g. a known order) — the button only shows for low / out of stock.
                          {
                            label: 'Request purchase',
                            icon: ShoppingCart,
                            hidden: !perms.canRequestPurchase || canRequest || !materialId,
                            // Keep it visible so the user learns why they can't request again.
                            disabled: !!existingPr,
                            disabledReason: existingPr ? `Already requested on ${existingPr.prNumber}` : undefined,
                            onSelect: () => setRequesting(b),
                          },
                          { label: 'Locate in warehouse', icon: MapPin, onSelect: () => navigate(stockLocatorPath({ materialId })) },
                          { label: 'Put away', icon: ArrowRight, hidden: !canPutAwayRow || !canRequest, onSelect: () => navigate(putAwayPath(materialId)) },
                          { label: 'Pick', icon: Hand, hidden: !canPickRow, onSelect: () => navigate(`/warehouse/operations/picking?materialId=${materialId}`) },
                          { label: 'Reserve stock', icon: Boxes, hidden: !perms.canUpdate || (b.available ?? 0) <= 0, onSelect: () => onReserve(materialId) },
                          { label: 'Manual receipt', icon: ArrowDownToLine, hidden: !perms.canUpdate, onSelect: () => onReceive(materialId) },
                          { label: 'Movement history', icon: History, onSelect: () => onMovements(materialId) },
                        ]}
                        />
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
            pageSize={INVENTORY_PAGE_SIZE}
            itemLabel={alertsOnly ? 'alerts' : 'balances'}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </QueryState>

      <RequestPurchaseModal
        balance={requesting}
        onClose={() => setRequesting(null)}
        onRequested={(materialId, pr) => {
          setJustRequested((prev) => ({ ...prev, [materialId]: { prNumber: pr.prNumber, status: pr.status || 'SUBMITTED', prId: pr._id } }));
          qc.setQueryData(['prs-open-for-alerts'], (prev: PurchaseRequisition[] | undefined) => {
            const next = { ...pr, lines: pr.lines?.length ? pr.lines : [{ materialId, requiredQty: 0 }] } as PurchaseRequisition;
            return [...(prev || []).filter((p) => p._id !== pr._id), next];
          });
        }}
      />
    </>
  );
}
