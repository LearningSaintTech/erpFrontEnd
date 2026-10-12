import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, History, MapPin, Package, Pencil, Plus } from 'lucide-react';
import {
  Button, ErpDataTable, ErpSelect, FilterBar, InfoBanner, RowActionsMenu, SearchInput, TablePager,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { PreviewableImage } from '../../components/ImagePreview';
import { inventoryApi } from '../../services/manufacturing';
import type { Material } from '../../types/api';
import { useDebounced } from '../purchase/purchaseShared';
import {
  MATERIAL_CATEGORIES, categoryLabel, formatCurrency, mediaUrl, stockLocatorPath, unitLabel,
} from './inventoryUtils';
import { INVENTORY_PAGE_SIZE, type InventoryPerms } from './inventoryLayout';

export function MaterialsTab({
  perms, highlightId, onAdd, onEdit, onReceive, onMovements,
}: {
  perms: InventoryPerms;
  highlightId?: string | null;
  onAdd: () => void;
  onEdit: (m: Material) => void;
  onReceive: (materialId: string) => void;
  onMovements: (materialId: string) => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim());
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, category]);

  const list = useQuery({
    queryKey: ['materials-page', page, search, category],
    queryFn: () => inventoryApi.listMaterialsPage({ page, limit: INVENTORY_PAGE_SIZE, search: search || undefined, category: category || undefined }),
  });
  const rows = list.data?.items ?? [];
  const meta = list.data?.meta;
  const filtered = !!search || !!category;
  const clear = () => { setQ(''); setCategory(''); };

  return (
    <>
      {!perms.canCreate && (
        <InfoBanner tone="muted">
          Only inventory managers and store keepers can add materials.
          {perms.canUpdate ? ' You can still edit costs and post stock receipts.' : ' Your role can view the material list.'}
        </InfoBanner>
      )}
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="Search code or name…" inputSize="sm" />}
        filters={(
          <ErpSelect inputSize="sm" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {MATERIAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
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
        emptyIcon={Package}
        emptyMessage={filtered ? 'No materials match these filters' : 'No materials yet'}
        emptyDescription={filtered
          ? 'Try another category or clear the search.'
          : perms.canCreate ? 'Add the fabrics, trims and packaging you stock. Then post opening stock with a manual receipt.' : 'Ask a store keeper or inventory manager to add the material master.'}
        emptyAction={filtered
          ? <Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button>
          : perms.canCreate ? <Button size="sm" icon={<Plus size={16} />} onClick={onAdd}>Add material</Button> : undefined}
      >
        <div className="erp-table-wrap">
          <ErpDataTable className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th>Material</th>
                <th>Category</th>
                <th>Unit</th>
                <th className="erp-num">Unit cost</th>
                <th className="erp-num">Reorder level</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m: Material) => {
                const images = (m.images || []).filter((img) => img.url);
                return (
                  <tr
                    key={m._id}
                    className={`${perms.canUpdate ? 'erp-row-clickable' : ''}${highlightId === m._id ? ' erp-row-selected' : ''}`}
                    onClick={perms.canUpdate ? () => onEdit(m) : undefined}
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        {images[0]?.url ? (
                          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                          <span onClick={(e) => e.stopPropagation()}>
                            <PreviewableImage
                              src={mediaUrl(images[0].url)}
                              alt={m.name}
                              className="h-9 w-9 shrink-0 rounded-md object-cover"
                              gallery={images.map((img) => ({ src: mediaUrl(img.url), alt: img.fileName || m.name }))}
                              galleryIndex={0}
                            />
                          </span>
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--erp-surface-muted)] text-erp-text-muted" aria-hidden="true">
                            <Package size={16} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-mono text-[13px] font-medium text-erp-text-primary">{m.materialCode}</p>
                          <p className="truncate text-[13px] text-erp-text-muted">{m.name}</p>
                        </div>
                      </div>
                    </td>
                    <td>{categoryLabel(m.category)}</td>
                    <td>{unitLabel(m.unit)}</td>
                    <td className="erp-num">{formatCurrency(m.unitCost || 0)}</td>
                    <td className="erp-num">{(m.reorderLevel ?? 0).toLocaleString()}</td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {perms.canUpdate && (
                          <Button size="sm" variant="secondary" icon={<ArrowDownToLine size={14} />} onClick={(e) => { e.stopPropagation(); onReceive(m._id); }}>
                            Receive
                          </Button>
                        )}
                        <RowActionsMenu items={[
                          { label: 'Edit', icon: Pencil, hidden: !perms.canUpdate, onSelect: () => onEdit(m) },
                          { label: 'Locate stock', icon: MapPin, onSelect: () => navigate(stockLocatorPath({ materialId: m._id })) },
                          { label: 'Movement history', icon: History, onSelect: () => onMovements(m._id) },
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
            itemLabel="materials"
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </QueryState>
    </>
  );
}
