import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import {
  Button, ErpDataTable, ErpSearchSelect, ErpSelect, FilterBar, TablePager, type ErpSearchOption,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { inventoryApi } from '../../services/manufacturing';
import type { InventoryTransaction, Material } from '../../types/api';
import {
  TRANSACTION_TYPES, formatDateTime, performerName, transactionReferenceLabel, unitLabel,
} from './inventoryUtils';
import { INVENTORY_PAGE_SIZE, MaterialCell, TxTypeBadge } from './inventoryLayout';

export function MovementsTab({ materialId, onMaterial }: { materialId: string; onMaterial: (id: string) => void }) {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [type, materialId]);

  const { data: materials = [], isLoading: materialsLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => inventoryApi.listMaterials(),
  });
  const options: ErpSearchOption[] = useMemo(
    () => materials.map((m: Material) => ({ value: m._id, label: `${m.materialCode} — ${m.name}` })),
    [materials],
  );

  const list = useQuery({
    queryKey: ['inventory-transactions', page, type, materialId],
    queryFn: () => inventoryApi.listTransactionsPage({ page, limit: INVENTORY_PAGE_SIZE, type: type || undefined, materialId: materialId || undefined }),
  });
  const rows = list.data?.items ?? [];
  const meta = list.data?.meta;
  const filtered = !!type || !!materialId;
  const clear = () => { setType(''); onMaterial(''); };

  return (
    <>
      <FilterBar
        search={(
          <ErpSearchSelect
            className="w-full erp-input-sm"
            value={materialId}
            onChange={(v) => onMaterial(v)}
            options={options}
            loading={materialsLoading}
            placeholder="All materials"
            searchPlaceholder="Search material…"
          />
        )}
        filters={(
          <ErpSelect inputSize="sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Movement type">
            {TRANSACTION_TYPES.map((t) => <option key={t.value || 'all'} value={t.value}>{t.label}</option>)}
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
        emptyIcon={History}
        emptyMessage={filtered ? 'No movements match these filters' : 'No stock movements yet'}
        emptyDescription={filtered ? undefined : 'Every receipt, issue, reservation and transfer is logged here.'}
        emptyAction={filtered ? <Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button> : undefined}
      >
        <div className="erp-table-wrap">
          <ErpDataTable className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Material</th>
                <th className="erp-num">Quantity</th>
                <th>Reference</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t: InventoryTransaction) => {
                // Adjustments (cycle counts, manual corrections) carry their own direction.
                const direction = (t as InventoryTransaction & { direction?: 'IN' | 'OUT' }).direction;
                const inbound = t.type === 'RECEIPT' || t.type === 'RESERVATION_RELEASE' || (t.type === 'ADJUSTMENT' && direction === 'IN');
                const outbound = t.type === 'ISSUE' || t.type === 'RESERVATION' || (t.type === 'ADJUSTMENT' && direction === 'OUT');
                return (
                  <tr key={t._id}>
                    <td className="whitespace-nowrap text-erp-text-muted">{formatDateTime(t.createdAt)}</td>
                    <td><TxTypeBadge type={t.type} /></td>
                    <td>
                      {t.materialId ? <MaterialCell materialId={t.materialId as Material} /> : (() => {
                        // Finished-goods / work-in-progress rows carry a SKU instead of a material.
                        const sku = (t as InventoryTransaction & { skuId?: { skuCode?: string; name?: string } | string }).skuId;
                        return sku && typeof sku === 'object'
                          ? <><span className="block font-mono text-[13px]">{sku.skuCode}</span>{sku.name && <span className="block text-xs text-erp-text-muted">{sku.name}</span>}</>
                          : <span className="text-erp-text-muted">—</span>;
                      })()}
                    </td>
                    <td
                      className="erp-num font-medium"
                      style={{ color: inbound ? 'var(--erp-success-text)' : outbound ? 'var(--erp-danger-text)' : undefined }}
                    >
                      {inbound ? '+' : outbound ? '−' : ''}{(t.quantity ?? 0).toLocaleString()} <span className="text-xs font-normal text-erp-text-muted">{unitLabel(t.unit)}</span>
                    </td>
                    <td className="text-[13px] text-erp-text-muted">
                      {transactionReferenceLabel(t)}
                      {(t as InventoryTransaction & { note?: string }).note && (
                        <span className="block font-sans text-xs">{(t as InventoryTransaction & { note?: string }).note}</span>
                      )}
                    </td>
                    <td className="text-erp-text-muted">{performerName(t.performedBy)}</td>
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
            itemLabel="movements"
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </QueryState>
    </>
  );
}
