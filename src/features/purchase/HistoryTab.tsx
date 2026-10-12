import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, Eye, History, ShieldCheck } from 'lucide-react';
import {
  Button, ErpDataTable, FilterBar, RowActionsMenu, SearchInput, StatusBadge, TablePager,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { purchaseApi } from '../../services/operations';
import type { PurchaseOrder } from '../../types/api';
import { findGrnsForPo, findPoForPr, formatCurrency, historyPurchaseLabel, supplierLabel } from './purchaseUtils';
import { LinesList, PURCHASE_PAGE_SIZE } from './purchaseShared';
import { PrDetailDrawer, type PrRow } from './RequisitionsTab';

/** Converted requisitions with their payment and goods receipt. */
export function HistoryTab({
  search, onSearch, page, onPage, selectedId, onSelect, onViewPayment,
}: {
  search: string;
  onSearch: (s: string) => void;
  page: number;
  onPage: (p: number) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onViewPayment: (po: PurchaseOrder) => void;
}) {
  const navigate = useNavigate();
  const list = useQuery({
    queryKey: ['purchase-list', 'history', page, search],
    queryFn: () => purchaseApi.listPRsPage({ page, limit: PURCHASE_PAGE_SIZE, search: search || undefined, status: 'CONVERTED' }),
  });
  const { data: pos = [] } = useQuery({ queryKey: ['pos-pr-link'], queryFn: () => purchaseApi.listPOs({ limit: 500 }) });
  const { data: grns = [] } = useQuery({ queryKey: ['grns-history-link'], queryFn: () => purchaseApi.listGRNs({ limit: 500 }) });
  const rows = (list.data?.items ?? []) as PrRow[];
  const meta = list.data?.meta;
  const selected = rows.find((r) => r._id === selectedId) ?? null;

  return (
    <>
      <FilterBar
        search={<SearchInput value={search} onChange={onSearch} placeholder="Search PR number…" inputSize="sm" />}
        onClear={search ? () => onSearch('') : undefined}
      />
      <QueryState
        skeleton="table"
        skeletonColumns={6}
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        isEmpty={!rows.length}
        emptyIcon={History}
        emptyMessage={search ? 'No past purchases match this search' : 'No past purchases yet'}
        emptyDescription={search ? undefined : 'Requisitions move here once a payment has been created for them.'}
      >
        <div className="erp-table-wrap">
          <ErpDataTable className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th>Requisition</th>
                <th>Payment</th>
                <th className="erp-num">Amount</th>
                <th>Items</th>
                <th>Progress</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pr) => {
                const po = findPoForPr(pos, pr);
                const linked = po ? findGrnsForPo(grns, po._id) : [];
                const latest = linked[0];
                const done = latest?.status === 'COMPLETED';
                return (
                  <tr key={pr._id} className={`erp-row-clickable${selectedId === pr._id ? ' erp-row-selected' : ''}`} onClick={() => onSelect(pr._id)}>
                    <td className="erp-cell-primary whitespace-nowrap font-mono">{pr.prNumber}</td>
                    <td>
                      {po ? (
                        <>
                          <p className="font-mono text-[13px] font-medium">{po.poNumber}</p>
                          <p className="max-w-[200px] truncate text-xs text-erp-text-muted">{supplierLabel(po.supplierId)}</p>
                        </>
                      ) : <span className="text-erp-text-muted">Not found</span>}
                    </td>
                    <td className="erp-num">{po ? formatCurrency(po.totalAmount) : '—'}</td>
                    <td><LinesList lines={pr.lines} /></td>
                    <td className="max-w-[240px]">
                      <StatusBadge status={done ? 'COMPLETED' : 'IN_PROGRESS'} label={done ? 'Completed' : 'In progress'} />
                      <p className="mt-1 line-clamp-2 text-xs text-erp-text-muted">{historyPurchaseLabel(po, linked)}</p>
                    </td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {po && (
                          <Button size="sm" variant="secondary" iconRight={<ArrowRight size={14} />} onClick={(e) => { e.stopPropagation(); onViewPayment(po); }}>
                            Payment
                          </Button>
                        )}
                        <RowActionsMenu items={[
                          { label: 'View details', icon: Eye, onSelect: () => onSelect(pr._id) },
                          { label: 'Open incoming QC', icon: ShieldCheck, hidden: latest?.status !== 'PENDING_QC', onSelect: () => navigate('/quality/inspections') },
                          { label: 'View stock', icon: Boxes, hidden: !done, onSelect: () => navigate('/inventory?tab=stock') },
                          { label: 'Put away', icon: ArrowRight, hidden: !done, onSelect: () => navigate('/warehouse/operations/put-away') },
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
            pageSize={PURCHASE_PAGE_SIZE}
            itemLabel="purchases"
            onPrev={() => onPage(page - 1)}
            onNext={() => onPage(page + 1)}
          />
        )}
      </QueryState>
      <PrDetailDrawer pr={selected} onClose={() => onSelect(null)} />
    </>
  );
}
