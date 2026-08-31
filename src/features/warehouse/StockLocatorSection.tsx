import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search } from 'lucide-react';
import { ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge } from '../../components/erp';
import { inventoryApi, skuApi } from '../../services/manufacturing';
import { warehouseApi } from '../../services/operations';
import type { Material, StockLocatorRow } from '../../types/api';
import { putAwayPath } from '../inventory/inventoryUtils';
import {
  dispatchPath, materialLabel, materialRowId, pickPath, skuLabel, statusLabel, warehouseTypeLabel,
} from './warehouseUtils';

const btnSm = '!px-2 !py-1 text-[10px]';
const fieldLabel = 'mb-0.5 block text-[9px] uppercase tracking-wide text-erp-text-muted';

type LocatorType = 'RAW_MATERIAL' | 'FINISHED_GOODS';

function itemLabel(row: StockLocatorRow): string {
  if (row.inventoryType === 'FINISHED_GOODS') return skuLabel(row.skuId);
  return materialLabel(row.materialId);
}

function itemId(row: StockLocatorRow): string {
  if (row.inventoryType === 'FINISHED_GOODS') {
    const s = row.skuId;
    return typeof s === 'string' ? s : s?._id || '';
  }
  return materialRowId(row.materialId);
}

function binDeepLink(row: StockLocatorRow): string | null {
  const whId = row.location.warehouse?.warehouseId;
  const binId = row.location.binId;
  if (!whId || !binId) return null;
  return `/warehouse/warehouses?warehouseId=${whId}&binId=${binId}`;
}

export function StockLocatorSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = (searchParams.get('inventoryType') === 'FINISHED_GOODS'
    ? 'FINISHED_GOODS'
    : 'RAW_MATERIAL') as LocatorType;

  const [invType, setInvType] = useState<LocatorType>(initialType);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || searchParams.get('q') || '');
  const [search, setSearch] = useState(searchInput);
  const [selectedMaterialId, setSelectedMaterialId] = useState(searchParams.get('materialId') || '');
  const [selectedSkuId, setSelectedSkuId] = useState(searchParams.get('skuId') || '');

  const { data: materials = [] } = useQuery({
    queryKey: ['materials-locator'],
    queryFn: () => inventoryApi.listMaterials(),
    enabled: invType === 'RAW_MATERIAL',
  });

  const { data: skusPage } = useQuery({
    queryKey: ['skus-locator'],
    queryFn: () => skuApi.listPage({ limit: 200 }),
    enabled: invType === 'FINISHED_GOODS',
  });
  const skus = skusPage?.items ?? [];

  const queryKey = invType === 'RAW_MATERIAL'
    ? ['stock-locator', invType, search, selectedMaterialId]
    : ['stock-locator', invType, search, selectedSkuId];

  const canQuery = Boolean(
    (invType === 'RAW_MATERIAL' && (selectedMaterialId || search.trim()))
    || (invType === 'FINISHED_GOODS' && (selectedSkuId || search.trim())),
  );

  const { data, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => warehouseApi.stockLocator({
      inventoryType: invType,
      materialId: invType === 'RAW_MATERIAL' && selectedMaterialId ? selectedMaterialId : undefined,
      skuId: invType === 'FINISHED_GOODS' && selectedSkuId ? selectedSkuId : undefined,
      search: !selectedMaterialId && !selectedSkuId ? search.trim() || undefined : undefined,
    }),
    enabled: canQuery,
  });

  const rows = data?.items ?? [];
  const totals = data?.totals;

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('inventoryType', invType);
    if (invType === 'RAW_MATERIAL' && selectedMaterialId) params.set('materialId', selectedMaterialId);
    if (invType === 'FINISHED_GOODS' && selectedSkuId) params.set('skuId', selectedSkuId);
    if (search.trim() && !selectedMaterialId && !selectedSkuId) params.set('search', search.trim());
    setSearchParams(params, { replace: true });
  }, [invType, selectedMaterialId, selectedSkuId, search, setSearchParams]);

  const runSearch = () => {
    setSearch(searchInput.trim());
    if (invType === 'RAW_MATERIAL') setSelectedMaterialId('');
    else setSelectedSkuId('');
  };

  const groupedHint = useMemo(() => {
    if (!rows.length) return null;
    const dock = rows.filter((r) => r.location.isDock);
    const bins = rows.filter((r) => !r.location.isDock);
    return { dock: dock.length, bins: bins.length };
  }, [rows]);

  return (
    <>
      <ErpCard className="mb-4 p-4">
        <div className="mb-3 flex items-start gap-2 text-[11px] text-erp-text-muted">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--erp-accent)]" />
          <p>
            Search a raw material or finished SKU to see every location — unallocated dock, zone, rack, shelf, and bin — in one table.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={fieldLabel}>Stock type</label>
            <ErpSelect
              value={invType}
              onChange={(e) => {
                setInvType(e.target.value as LocatorType);
                setSelectedMaterialId('');
                setSelectedSkuId('');
                setSearch('');
                setSearchInput('');
              }}
              className="w-40"
            >
              <option value="RAW_MATERIAL">Raw material</option>
              <option value="FINISHED_GOODS">Finished goods</option>
            </ErpSelect>
          </div>
          {invType === 'RAW_MATERIAL' ? (
            <div>
              <label className={fieldLabel}>Material</label>
              <ErpSelect
                value={selectedMaterialId}
                onChange={(e) => {
                  setSelectedMaterialId(e.target.value);
                  setSearch('');
                  setSearchInput('');
                }}
                className="min-w-[200px]"
              >
                <option value="">Search or pick…</option>
                {materials.map((m: Material) => (
                  <option key={m._id} value={m._id}>{m.materialCode} — {m.name}</option>
                ))}
              </ErpSelect>
            </div>
          ) : (
            <div>
              <label className={fieldLabel}>SKU</label>
              <ErpSelect
                value={selectedSkuId}
                onChange={(e) => {
                  setSelectedSkuId(e.target.value);
                  setSearch('');
                  setSearchInput('');
                }}
                className="min-w-[200px]"
              >
                <option value="">Search or pick…</option>
                {skus.map((s) => (
                  <option key={s._id} value={s._id}>{s.skuCode} — {s.name}</option>
                ))}
              </ErpSelect>
            </div>
          )}
          <div className="flex-1 min-w-[180px]">
            <label className={fieldLabel}>Search code or name</label>
            <ErpInput
              placeholder={invType === 'RAW_MATERIAL' ? 'e.g. FAB-ALKA' : 'e.g. SKU code'}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            />
          </div>
          <ErpButton className={btnSm} onClick={runSearch} disabled={!searchInput.trim() && !selectedMaterialId && !selectedSkuId}>
            <Search className="mr-1 inline h-3 w-3" />Locate
          </ErpButton>
        </div>
      </ErpCard>

      {totals && canQuery && (
        <div className="mb-3 flex flex-wrap gap-4 text-[11px]">
          <span><strong>On hand:</strong> {totals.onHand}</span>
          <span><strong>Reserved:</strong> {totals.reserved}</span>
          <span><strong>Available:</strong> {totals.available}</span>
          {groupedHint && (
            <span className="text-erp-text-muted">
              {groupedHint.dock > 0 && `${groupedHint.dock} dock`}
              {groupedHint.dock > 0 && groupedHint.bins > 0 && ' · '}
              {groupedHint.bins > 0 && `${groupedHint.bins} bin${groupedHint.bins > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
      )}

      <ErpCard className="overflow-hidden p-0">
        <ErpDataTable className="w-full text-[11px]">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-left">Warehouse</th>
              <th className="px-3 py-2 text-left">Zone</th>
              <th className="px-3 py-2 text-left">Rack</th>
              <th className="px-3 py-2 text-left">Shelf</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-right">On hand</th>
              <th className="px-3 py-2 text-right">Reserved</th>
              <th className="px-3 py-2 text-right">Available</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isFetching && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-erp-text-muted">Searching locations…</td></tr>
            )}
            {!isFetching && !canQuery && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-erp-text-muted">
                  Pick a material/SKU or enter a search term, then click Locate.
                </td>
              </tr>
            )}
            {!isFetching && canQuery && rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-erp-text-muted">
                  No stock found for this search.
                </td>
              </tr>
            )}
            {!isFetching && rows.map((row) => {
              const deepLink = binDeepLink(row);
              const mid = itemId(row);
              return (
                <tr key={row.balanceId} className="border-t border-[var(--erp-border)]">
                  <td className="px-3 py-2">{itemLabel(row)}</td>
                  <td className="px-3 py-2 text-erp-text-muted">
                    {row.location.warehouse
                      ? `${row.location.warehouse.warehouseCode || row.location.warehouse.warehouseName || '—'} (${warehouseTypeLabel(row.location.warehouse.warehouseType || '')})`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono">{row.location.zoneCode}</td>
                  <td className="px-3 py-2 font-mono">{row.location.rackCode}</td>
                  <td className="px-3 py-2 font-mono">{row.location.shelfCode}</td>
                  <td className="px-3 py-2 font-mono">{row.location.binLabel}</td>
                  <td className="px-3 py-2 text-right">{row.onHand} {row.unit || ''}</td>
                  <td className="px-3 py-2 text-right text-erp-text-muted">{row.reserved}</td>
                  <td className="px-3 py-2 text-right font-medium">{row.available}</td>
                  <td className="px-3 py-2">
                    {row.location.isDock ? (
                      <ErpStatusBadge status="STAGED" label="Dock" />
                    ) : row.dispatchStatus ? (
                      <ErpStatusBadge status={row.dispatchStatus} label={statusLabel(row.dispatchStatus)} />
                    ) : (
                      <ErpStatusBadge status="ACTIVE" label="In bin" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-[10px]">
                    {deepLink && (
                      <Link to={deepLink} className="text-[var(--erp-accent)]">View bin</Link>
                    )}
                    {row.location.isDock && invType === 'RAW_MATERIAL' && mid && (
                      <Link to={putAwayPath(mid)} className={deepLink ? 'ml-2 text-[var(--erp-accent)]' : 'text-[var(--erp-accent)]'}>
                        Put away
                      </Link>
                    )}
                    {!row.location.isDock && invType === 'RAW_MATERIAL' && mid && (
                      <Link to={pickPath(mid)} className="ml-2 text-[var(--erp-accent)]">Pick</Link>
                    )}
                    {invType === 'FINISHED_GOODS' && (() => {
                      const sid = typeof row.skuId === 'string' ? row.skuId : row.skuId?._id;
                      if (!sid) return null;
                      return (
                        <>
                          {!row.location.binId && (
                            <Link to={`/warehouse/operations/put-away?inventoryType=FINISHED_GOODS&skuId=${sid}`} className="ml-2 text-[var(--erp-accent)]">
                              Put away
                            </Link>
                          )}
                          {row.location.binId && (
                            <Link to={pickPath(undefined, sid)} className="ml-2 text-[var(--erp-accent)]">Pick</Link>
                          )}
                          <Link to={dispatchPath(sid)} className="ml-2 text-[var(--erp-accent)]">Dispatch</Link>
                        </>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ErpDataTable>
        {canQuery && (
          <div className="border-t px-3 py-2 text-right">
            <ErpButton variant="secondary" className={btnSm} onClick={() => refetch()}>Refresh</ErpButton>
          </div>
        )}
      </ErpCard>
    </>
  );
}
