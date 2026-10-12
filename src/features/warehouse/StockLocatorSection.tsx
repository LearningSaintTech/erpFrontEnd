import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpFromLine, Eye, MapPin, PackagePlus, Search, Truck } from 'lucide-react';
import {
  Button, EmptyRow, ErpDataTable, ErpInput, ErpSearchSelect, ErpSelect, Field, IconButton, RowActionsMenu, Section, StatusBadge,
  TableSkeleton, type DropdownMenuItem,
} from '../../components/erp';
import { RefreshCw } from 'lucide-react';
import { inventoryApi, skuApi } from '../../services/manufacturing';
import { warehouseApi } from '../../services/operations';
import type { Material, StockLocatorRow } from '../../types/api';
import { putAwayPath } from '../inventory/inventoryUtils';
import {
  dispatchPath, materialLabel, materialRowId, pickPath, skuLabel, statusLabel, warehouseTypeLabel,
} from './warehouseUtils';

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = (searchParams.get('inventoryType') === 'FINISHED_GOODS' ? 'FINISHED_GOODS' : 'RAW_MATERIAL') as LocatorType;

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

  const canQuery = Boolean(
    (invType === 'RAW_MATERIAL' && (selectedMaterialId || search.trim()))
    || (invType === 'FINISHED_GOODS' && (selectedSkuId || search.trim())),
  );

  const { data, isFetching, refetch } = useQuery({
    queryKey: invType === 'RAW_MATERIAL' ? ['stock-locator', invType, search, selectedMaterialId] : ['stock-locator', invType, search, selectedSkuId],
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
    // Only while still on this page — a late replace must not hijack a navigation away.
    if (!window.location.pathname.startsWith('/warehouse/stock-locator')) return;
    const params = new URLSearchParams();
    params.set('inventoryType', invType);
    if (invType === 'RAW_MATERIAL' && selectedMaterialId) params.set('materialId', selectedMaterialId);
    if (invType === 'FINISHED_GOODS' && selectedSkuId) params.set('skuId', selectedSkuId);
    if (search.trim() && !selectedMaterialId && !selectedSkuId) params.set('search', search.trim());
    setSearchParams(params, { replace: true });
  }, [invType, selectedMaterialId, selectedSkuId, search, setSearchParams]);

  const runSearch = (e?: FormEvent) => {
    e?.preventDefault();
    setSearch(searchInput.trim());
    if (invType === 'RAW_MATERIAL') setSelectedMaterialId('');
    else setSelectedSkuId('');
  };

  const counts = useMemo(() => ({ dock: rows.filter((r) => r.location.isDock).length, bins: rows.filter((r) => !r.location.isDock).length }), [rows]);

  const rowActions = (row: StockLocatorRow): { primary?: { label: string; to: string }; menu: DropdownMenuItem[] } => {
    const id = itemId(row);
    const deepLink = binDeepLink(row);
    const menu: DropdownMenuItem[] = [{ label: 'View bin', icon: Eye, hidden: !deepLink, onSelect: () => deepLink && navigate(deepLink) }];
    if (!id) return { menu };
    if (invType === 'RAW_MATERIAL') {
      return row.location.isDock
        ? { primary: { label: 'Put away', to: putAwayPath(id) }, menu }
        : { primary: { label: 'Pick', to: pickPath(id) }, menu };
    }
    menu.push({ label: 'Dispatch', icon: Truck, onSelect: () => navigate(dispatchPath(id)) });
    return row.location.binId
      ? { primary: { label: 'Pick', to: pickPath(undefined, id) }, menu }
      : { primary: { label: 'Put away', to: `/warehouse/operations/put-away?inventoryType=FINISHED_GOODS&skuId=${id}` }, menu };
  };

  return (
    <div className="space-y-4">
      <Section>
        <form className="flex flex-wrap items-end gap-4" onSubmit={runSearch}>
          <Field label="Stock type" className="w-44">
            <ErpSelect
              value={invType}
              onChange={(e) => {
                setInvType(e.target.value as LocatorType);
                setSelectedMaterialId('');
                setSelectedSkuId('');
                setSearch('');
                setSearchInput('');
              }}
            >
              <option value="RAW_MATERIAL">Raw material</option>
              <option value="FINISHED_GOODS">Finished goods</option>
            </ErpSelect>
          </Field>
          <Field label={invType === 'RAW_MATERIAL' ? 'Material' : 'SKU'} className="min-w-[240px] flex-1">
            <ErpSearchSelect
              value={invType === 'RAW_MATERIAL' ? selectedMaterialId : selectedSkuId}
              allowClear
              placeholder={invType === 'RAW_MATERIAL' ? 'Pick a material…' : 'Pick a SKU…'}
              options={invType === 'RAW_MATERIAL'
                ? materials.map((m: Material) => ({ value: m._id, label: `${m.materialCode} — ${m.name}` }))
                : skus.map((s) => ({ value: s._id, label: `${s.skuCode} — ${s.name}` }))}
              onChange={(v) => {
                if (invType === 'RAW_MATERIAL') setSelectedMaterialId(v); else setSelectedSkuId(v);
                setSearch('');
                setSearchInput('');
              }}
            />
          </Field>
          <span className="pb-2.5 text-[13px] text-erp-text-muted">or</span>
          <Field label="Search code or name" className="min-w-[200px] flex-1">
            <ErpInput placeholder={invType === 'RAW_MATERIAL' ? 'e.g. FAB-ALKA' : 'e.g. SKU code'} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </Field>
          <Button type="submit" icon={<Search size={16} />} disabled={!searchInput.trim()}>Locate</Button>
        </form>
      </Section>

      <Section
        flush
        title={canQuery && totals ? `${rows.length} location${rows.length === 1 ? '' : 's'}` : 'Locations'}
        description={canQuery && totals ? `${totals.onHand} on hand · ${totals.reserved} reserved · ${totals.available} available${counts.dock ? ` · ${counts.dock} on dock` : ''}` : undefined}
        actions={canQuery ? <IconButton aria-label="Refresh results" size="sm" loading={isFetching} onClick={() => refetch()}><RefreshCw size={14} /></IconButton> : undefined}
      >
        <ErpDataTable className="min-w-[960px]">
          <thead>
            <tr>
              <th>Item</th>
              <th>Warehouse</th>
              <th>Location</th>
              <th className="erp-num">On hand</th>
              <th className="erp-num">Reserved</th>
              <th className="erp-num">Available</th>
              <th>Status</th>
              <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {isFetching && canQuery ? <TableSkeleton asRows rows={4} columns={8} /> : !canQuery ? (
              <EmptyRow colSpan={8} icon={MapPin} title="Find where stock is kept">Pick a material or SKU, or search by code, to list every location holding it.</EmptyRow>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={8} title="No stock found" icon={MapPin}>Nothing is on hand for this search.</EmptyRow>
            ) : rows.map((row) => {
              const { primary, menu } = rowActions(row);
              const loc = row.location;
              const path = [loc.zoneCode, loc.rackCode, loc.shelfCode].filter((x) => x && x !== '—').join(' / ');
              return (
                <tr key={row.balanceId}>
                  <td className="erp-cell-primary">{itemLabel(row)}</td>
                  <td className="text-erp-text-muted">
                    {loc.warehouse ? `${loc.warehouse.warehouseCode || loc.warehouse.warehouseName || '—'}` : '—'}
                    {loc.warehouse?.warehouseType && <span className="block text-xs">{warehouseTypeLabel(loc.warehouse.warehouseType)}</span>}
                  </td>
                  <td>
                    <span className="font-mono">{loc.binLabel}</span>
                    {path && <span className="block font-mono text-xs text-erp-text-muted">{path}</span>}
                  </td>
                  <td className="erp-num">{row.onHand}{row.unit ? <span className="text-erp-text-muted"> {row.unit}</span> : ''}</td>
                  <td className="erp-num text-erp-text-muted">{row.reserved}</td>
                  <td className="erp-num font-medium">{row.available}</td>
                  <td>
                    {loc.isDock ? <StatusBadge status="STAGED" tone="warning" label="On dock" />
                      : row.dispatchStatus ? <StatusBadge status={row.dispatchStatus} label={statusLabel(row.dispatchStatus)} />
                        : <StatusBadge status="ACTIVE" label="In bin" />}
                  </td>
                  <td className="erp-cell-actions">
                    <div className="flex items-center justify-end gap-1">
                      {primary && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={primary.label === 'Pick' ? <ArrowUpFromLine size={14} /> : <PackagePlus size={14} />}
                          onClick={() => navigate(primary.to)}
                        >
                          {primary.label}
                        </Button>
                      )}
                      <RowActionsMenu items={menu} label={`More for ${itemLabel(row)}`} />
                    </div>
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
