import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ClipboardList, Layers, MapPin, Package, Shirt, Warehouse } from 'lucide-react';
import {
  Button, EmptyState, ErpDataTable, FilterBar, KpiGrid, RowActionsMenu, SearchInput, Section, StatTile,
  StatusBadge, TablePager,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { inventoryApi, skuApi } from '../../services/manufacturing';
import type { InventoryBalance, Sku } from '../../types/api';
import { useDebounced } from '../purchase/purchaseShared';
import { colorSwatch, designIdOf, designLabel, formatPrice, sampleLabel } from '../sku/skuUtils';
import { stockLocatorPath } from './inventoryUtils';
import { INVENTORY_PAGE_SIZE } from './inventoryLayout';

function skuIdOfBalance(b: InventoryBalance & { skuId?: string | Sku }): string {
  const s = b.skuId;
  if (!s) return '';
  return typeof s === 'string' ? s : s._id;
}

/** Finished-goods view of the inventory page: SKUs with on-hand/available summed over locations. */
export function FinishedGoodsView({ canRead }: { canRead: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search]);

  const { data: stats } = useQuery({ queryKey: ['sku-stats'], queryFn: skuApi.stats, enabled: canRead });
  const list = useQuery({
    queryKey: ['inventory-fg-skus', page, search],
    queryFn: () => skuApi.listPage({ page, limit: INVENTORY_PAGE_SIZE, search: search || undefined }),
    enabled: canRead,
  });
  const { data: balances } = useQuery({
    queryKey: ['inventory-fg-balances'],
    queryFn: () => inventoryApi.listBalancesPage({ inventoryType: 'FINISHED_GOODS', limit: 500 }),
    enabled: canRead,
  });
  const stockBySku = useMemo(() => {
    const map = new Map<string, { onHand: number; available: number; unit: string }>();
    for (const b of (balances?.items ?? []) as Array<InventoryBalance & { skuId?: string | Sku }>) {
      const id = skuIdOfBalance(b);
      if (!id) continue;
      const prev = map.get(id) || { onHand: 0, available: 0, unit: b.unit || 'PIECES' };
      map.set(id, { onHand: prev.onHand + (b.onHand || 0), available: prev.available + (b.available || 0), unit: b.unit || prev.unit });
    }
    return map;
  }, [balances]);

  if (!canRead) {
    return (
      <Section>
        <EmptyState icon={Shirt} title="No access to finished products" description="Viewing finished SKUs needs SKU or inventory read access." />
      </Section>
    );
  }

  const rows = list.data?.items ?? [];
  const meta = list.data?.meta;

  return (
    <div className="space-y-4">
      <KpiGrid cols={4}>
        <StatTile icon={Package} label="SKUs" value={stats?.total ?? '—'} />
        <StatTile icon={Check} label="Active" value={stats?.active ?? '—'} />
        <StatTile icon={ClipboardList} label="Draft" value={stats?.draft ?? '—'} />
        <StatTile icon={Warehouse} label="Stock locations" value={balances?.meta?.total ?? balances?.items?.length ?? '—'} />
      </KpiGrid>

      <Section flush>
        <FilterBar
          search={<SearchInput value={q} onChange={setQ} placeholder="Search SKU code, name or design…" inputSize="sm" />}
          onClear={q ? () => setQ('') : undefined}
          actions={<Button size="sm" variant="secondary" onClick={() => navigate('/products/skus')}>Manage SKUs</Button>}
        />
        <QueryState
          skeleton="table"
          skeletonColumns={8}
          isLoading={list.isLoading}
          isError={list.isError}
          error={list.error}
          onRetry={list.refetch}
          isEmpty={!rows.length}
          emptyIcon={Shirt}
          emptyMessage={search ? 'No SKUs match this search' : 'No finished SKUs yet'}
          emptyDescription={search ? undefined : 'SKUs are created from approved samples in Products.'}
          emptyAction={search
            ? <Button size="sm" variant="secondary" onClick={() => setQ('')}>Clear search</Button>
            : <Button size="sm" onClick={() => navigate('/products/skus')}>Go to SKUs</Button>}
        >
          <div className="erp-table-wrap">
            <ErpDataTable className="w-full min-w-[960px]">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Design</th>
                  <th>Sample</th>
                  <th>Size / colour</th>
                  <th className="erp-num">Price</th>
                  <th className="erp-num">On hand</th>
                  <th className="erp-num">Available</th>
                  <th>Status</th>
                  <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s: Sku) => {
                  const stock = stockBySku.get(s._id);
                  const locate = stockLocatorPath({ inventoryType: 'FINISHED_GOODS', skuId: s._id, search: s.skuCode });
                  return (
                    <tr key={s._id}>
                      <td>
                        <p className="font-mono text-[13px] font-medium text-erp-text-primary">{s.skuCode}</p>
                        <p className="text-[13px] text-erp-text-muted">{s.name}</p>
                      </td>
                      <td>
                        {designIdOf(s) ? (
                          <Link to={`/designs/${designIdOf(s)}/edit`} className="text-[var(--erp-accent)] hover:underline">{designLabel(s.designId)}</Link>
                        ) : '—'}
                      </td>
                      <td className="text-erp-text-muted">{sampleLabel(s.sampleId)}</td>
                      <td>{s.size} / {colorSwatch(s.color)}</td>
                      <td className="erp-num">{formatPrice(s.basePrice)}</td>
                      <td className="erp-num">{stock ? stock.onHand.toLocaleString() : '—'}</td>
                      <td className="erp-num font-medium">{stock ? stock.available.toLocaleString() : '—'}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td className="erp-cell-actions">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="secondary" icon={<MapPin size={14} />} onClick={() => navigate(locate)}>Locate</Button>
                          <RowActionsMenu items={[{ label: 'Bills of materials', icon: Layers, onSelect: () => navigate('/boms') }]} />
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
              itemLabel="SKUs"
              onPrev={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </QueryState>
      </Section>
    </div>
  );
}
