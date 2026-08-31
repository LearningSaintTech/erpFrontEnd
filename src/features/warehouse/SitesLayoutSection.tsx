import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown, ChevronRight, Package, Plus, Scan, Search, Warehouse as WhIcon, X,
} from 'lucide-react';
import { warehouseApi } from '../../services/operations';
import { inventoryApi } from '../../services/manufacturing';
import type { Material, StorageBin, Warehouse } from '../../types/api';
import type { WarehouseRack, WarehouseZone } from '../../types/api.extended';
import {
  ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  binLabel, materialLabel, materialRowId, skuLabel, statusLabel, transferableQty,
  unallocatedBalance, warehouseTypeLabel,
} from './warehouseUtils';

const btnSm = '!px-2 !py-1 text-[10px]';
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const PAGE_SIZE = 20;
const STOCK_PAGE_SIZE = 12;

type AddKind = 'warehouse' | 'zone' | 'rack' | 'shelf' | 'bin' | null;

type TreeSel =
  | { kind: 'all' }
  | { kind: 'unassigned' }
  | { kind: 'zone'; zoneId: string }
  | { kind: 'rack'; zoneId: string; rackId: string }
  | { kind: 'shelf'; zoneId: string; rackId: string; shelfId: string };

type StockRow = {
  key: string;
  kind: 'RM' | 'FG';
  code: string;
  label: string;
  onHand: number;
  available: number;
  unit?: string;
  dispatchStatus?: string;
  materialId?: string;
};

function sortCode(a: string, b: string) {
  const na = a.match(/\d+/);
  const nb = b.match(/\d+/);
  if (na && nb && a.replace(na[0], '') === b.replace(nb[0], '')) {
    return Number(na[0]) - Number(nb[0]);
  }
  return a.localeCompare(b);
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return createPortal(
    <div
      className="erp-modal-overlay fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/45 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="my-auto w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SitesLayoutSection() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('warehouse.create');
  const canUpdate = permissions.includes('*') || permissions.includes('warehouse.update');
  const canConfigure = permissions.includes('*') || permissions.includes('warehouse.configure');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedWh, setSelectedWh] = useState(searchParams.get('warehouseId') || '');
  const [selectedBinId, setSelectedBinId] = useState<string | null>(searchParams.get('binId'));
  const [treeSel, setTreeSel] = useState<TreeSel>({ kind: 'all' });
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [expandedRacks, setExpandedRacks] = useState<Set<string>>(new Set());
  const [binSearch, setBinSearch] = useState('');
  const [binPage, setBinPage] = useState(1);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [addKind, setAddKind] = useState<AddKind>(null);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; fn: () => void } | null>(null);

  const [whForm, setWhForm] = useState({ warehouseCode: '', name: '', type: 'RAW_MATERIAL', isDefault: false });
  const [zoneForm, setZoneForm] = useState({ zoneCode: '', name: '' });
  const [rackForm, setRackForm] = useState({ zoneId: '', rackCode: '' });
  const [shelfForm, setShelfForm] = useState({ zoneId: '', rackId: '', shelfCode: '' });
  const [binForm, setBinForm] = useState({ zoneId: '', rackId: '', shelfId: '', binCode: '', capacity: '' });
  const [stockQuickMaterialId, setStockQuickMaterialId] = useState('');
  const [stockQuickQty, setStockQuickQty] = useState('10');
  const [stockSearch, setStockSearch] = useState('');
  const [stockPage, setStockPage] = useState(1);
  const [stockModalOpen, setStockModalOpen] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['warehouse-stats'] });
    qc.invalidateQueries({ queryKey: ['warehouses'] });
    qc.invalidateQueries({ queryKey: ['warehouses-all'] });
    qc.invalidateQueries({ queryKey: ['warehouses-sites'] });
    qc.invalidateQueries({ queryKey: ['warehouse-layout'] });
    qc.invalidateQueries({ queryKey: ['zones'] });
    qc.invalidateQueries({ queryKey: ['bins'] });
    qc.invalidateQueries({ queryKey: ['bin-contents'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances-mat'] });
  };

  const { data: warehouses = [], isFetching, refetch } = useQuery({
    queryKey: ['warehouses-sites'],
    queryFn: () => warehouseApi.list({ limit: 100 }),
  });

  const whId = selectedWh || warehouses[0]?._id || '';
  const selectedWarehouse = warehouses.find((w) => w._id === whId);
  const isRmWarehouse = selectedWarehouse?.type === 'RAW_MATERIAL';

  useEffect(() => {
    if (!selectedWh && warehouses[0]?._id) setSelectedWh(warehouses[0]._id);
  }, [warehouses, selectedWh]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (whId) params.set('warehouseId', whId);
    if (selectedBinId) params.set('binId', selectedBinId);
    setSearchParams(params, { replace: true });
  }, [whId, selectedBinId, setSearchParams]);

  useEffect(() => {
    const binFromUrl = searchParams.get('binId');
    if (binFromUrl && !stockModalOpen) {
      setSelectedBinId(binFromUrl);
      setStockModalOpen(true);
    }
    // only on first mount / deep-link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: layout, isLoading: layoutLoading } = useQuery({
    queryKey: ['warehouse-layout', whId],
    queryFn: () => warehouseApi.layout(whId),
    enabled: !!whId,
  });

  const { data: binContents, isFetching: binContentsLoading } = useQuery({
    queryKey: ['bin-contents', whId, selectedBinId],
    queryFn: () => warehouseApi.binContents(whId, selectedBinId!),
    enabled: !!whId && !!selectedBinId && stockModalOpen,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['materials-wh'],
    queryFn: () => inventoryApi.listMaterialsPage({ limit: 200 }).then((r) => r.items),
    enabled: isRmWarehouse && !!selectedBinId && stockModalOpen,
  });

  const stockMatId = stockQuickMaterialId;
  const { data: stockMatBalances = [] } = useQuery({
    queryKey: ['inventory-balances-mat', stockMatId],
    queryFn: async () => {
      const mat = materials.find((m) => m._id === stockMatId);
      const { items } = await inventoryApi.listBalancesPage({
        search: mat?.materialCode,
        limit: 50,
      });
      return items.filter((b) => {
        const mid = typeof b.materialId === 'object' ? b.materialId._id : b.materialId;
        return mid === stockMatId;
      });
    },
    enabled: !!stockMatId && isRmWarehouse && !!selectedBinId && stockModalOpen,
  });
  const stockUnalloc = transferableQty(unallocatedBalance(stockMatBalances));
  const stockQuickQtyNum = Math.max(1, Number(stockQuickQty) || 1);
  const stockPutQty = stockQuickQty.trim() ? stockQuickQtyNum : stockUnalloc;

  const stockRows = useMemo((): StockRow[] => {
    if (!binContents) return [];
    const rows: StockRow[] = [];
    for (const r of binContents.rawMaterials ?? []) {
      const mat = r.materialId;
      const mid = materialRowId(mat as string | Material);
      const code = typeof mat === 'object' && mat
        ? String(mat.materialCode || '')
        : materialLabel(mat as string | Material);
      const name = typeof mat === 'object' && mat
        ? String(mat.name || '')
        : '';
      rows.push({
        key: `rm-${mid || code}`,
        kind: 'RM',
        code: code || '—',
        label: name || code || '—',
        onHand: r.onHand ?? 0,
        available: (r as { available?: number }).available ?? (r.onHand ?? 0),
        unit: r.unit,
        materialId: mid || undefined,
      });
    }
    for (const r of binContents.finishedGoods ?? []) {
      const sku = r.skuId;
      const code = typeof sku === 'object' && sku
        ? String((sku as { skuCode?: string }).skuCode || '')
        : skuLabel(sku);
      const name = typeof sku === 'object' && sku
        ? String((sku as { name?: string }).name || '')
        : '';
      rows.push({
        key: `fg-${code}-${r.onHand}`,
        kind: 'FG',
        code: code || '—',
        label: name || code || '—',
        onHand: r.onHand ?? 0,
        available: r.onHand ?? 0,
        unit: r.unit,
        dispatchStatus: r.dispatchStatus,
      });
    }
    return rows;
  }, [binContents]);

  const filteredStockRows = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return stockRows;
    return stockRows.filter((r) => (
      r.code.toLowerCase().includes(q)
      || r.label.toLowerCase().includes(q)
      || r.kind.toLowerCase().includes(q)
      || (r.dispatchStatus || '').toLowerCase().includes(q)
    ));
  }, [stockRows, stockSearch]);

  const stockTotalPages = Math.max(1, Math.ceil(filteredStockRows.length / STOCK_PAGE_SIZE));
  const pagedStockRows = useMemo(() => {
    const page = Math.min(stockPage, stockTotalPages);
    const start = (page - 1) * STOCK_PAGE_SIZE;
    return filteredStockRows.slice(start, start + STOCK_PAGE_SIZE);
  }, [filteredStockRows, stockPage, stockTotalPages]);

  useEffect(() => {
    setStockPage(1);
  }, [stockSearch, selectedBinId]);

  const openBinStock = (binId: string) => {
    setSelectedBinId(binId);
    setStockSearch('');
    setStockPage(1);
    setStockModalOpen(true);
  };

  const closeBinStock = () => {
    setStockModalOpen(false);
    setStockQuickMaterialId('');
  };

  const zones = layout?.zones ?? [];
  const layoutRacks = useMemo(() => {
    const racks: Array<WarehouseRack & { zoneId: string }> = [];
    for (const zone of zones) {
      for (const rack of zone.racks ?? []) {
        racks.push({ ...rack, zoneId: zone._id });
      }
    }
    return racks;
  }, [zones]);

  const racksForBin = useMemo(
    () => layoutRacks.filter((r) => r.zoneId === binForm.zoneId).sort((a, b) => sortCode(a.rackCode, b.rackCode)),
    [layoutRacks, binForm.zoneId],
  );
  const shelvesForBin = useMemo(
    () => (racksForBin.find((r) => r._id === binForm.rackId)?.shelves ?? [])
      .slice()
      .sort((a, b) => sortCode(a.shelfCode, b.shelfCode)),
    [racksForBin, binForm.rackId],
  );
  const racksForShelf = useMemo(
    () => layoutRacks.filter((r) => r.zoneId === shelfForm.zoneId).sort((a, b) => sortCode(a.rackCode, b.rackCode)),
    [layoutRacks, shelfForm.zoneId],
  );

  const allBins = useMemo(() => {
    const list: StorageBin[] = [];
    for (const zone of zones) {
      for (const b of zone.bins ?? []) list.push(b);
    }
    for (const b of layout?.unassignedBins ?? []) list.push(b);
    return list;
  }, [layout, zones]);

  const filteredBins = useMemo(() => {
    let list = allBins;
    if (treeSel.kind === 'unassigned') {
      list = layout?.unassignedBins ?? [];
    } else if (treeSel.kind === 'zone') {
      const zone = zones.find((z) => z._id === treeSel.zoneId);
      list = zone?.bins ?? [];
    } else if (treeSel.kind === 'rack') {
      const zone = zones.find((z) => z._id === treeSel.zoneId);
      list = (zone?.bins ?? []).filter((b) => b.rackId === treeSel.rackId);
    } else if (treeSel.kind === 'shelf') {
      const zone = zones.find((z) => z._id === treeSel.zoneId);
      list = (zone?.bins ?? []).filter((b) => b.shelfId === treeSel.shelfId);
    }
    const q = binSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((b) =>
        b.binCode?.toLowerCase().includes(q)
        || b.barcode?.toLowerCase().includes(q)
        || b.zoneCode?.toLowerCase().includes(q)
        || binLabel(b).toLowerCase().includes(q));
    }
    return list.slice().sort((a, b) => sortCode(a.binCode, b.binCode));
  }, [allBins, treeSel, zones, layout, binSearch]);

  const pageBins = filteredBins.slice((binPage - 1) * PAGE_SIZE, binPage * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredBins.length / PAGE_SIZE));

  useEffect(() => { setBinPage(1); }, [treeSel, binSearch, whId]);

  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (selectedWarehouse) parts.push(selectedWarehouse.warehouseCode);
    if (treeSel.kind === 'all') parts.push('All bins');
    else if (treeSel.kind === 'unassigned') parts.push('Unassigned');
    else if (treeSel.kind === 'zone' || treeSel.kind === 'rack' || treeSel.kind === 'shelf') {
      const zone = zones.find((z) => z._id === treeSel.zoneId);
      if (zone) parts.push(zone.zoneCode || '—');
      if (treeSel.kind === 'rack' || treeSel.kind === 'shelf') {
        const rack = (zone?.racks ?? []).find((r) => r._id === treeSel.rackId);
        if (rack) parts.push(rack.rackCode);
      }
      if (treeSel.kind === 'shelf') {
        const zone = zones.find((z) => z._id === treeSel.zoneId);
        const rack = (zone?.racks ?? []).find((r) => r._id === treeSel.rackId);
        const shelf = (rack?.shelves ?? []).find((s) => s._id === treeSel.shelfId);
        if (shelf) parts.push(shelf.shelfCode);
      }
    }
    return parts;
  }, [selectedWarehouse, treeSel, zones]);

  const mut = useMutation({
    mutationFn: async (action: { type: string; payload?: Record<string, unknown> }) => {
      const { type, payload = {} } = action;
      switch (type) {
        case 'createWh': return warehouseApi.create(payload);
        case 'createZone': return warehouseApi.createZone(whId, payload);
        case 'createRack': return warehouseApi.createRack(payload.zoneId as string, {
          rackCode: payload.rackCode as string,
        });
        case 'createShelf': return warehouseApi.createShelf(payload.rackId as string, {
          shelfCode: payload.shelfCode as string,
        });
        case 'createBin': return warehouseApi.createBin(whId, payload);
        case 'assignBinZone': return warehouseApi.updateBin(whId, payload.binId as string, {
          zoneId: payload.zoneId as string,
        });
        case 'lookupBin': return warehouseApi.lookupBin(barcodeInput.trim());
        case 'putAway': return warehouseApi.putAway({
          materialId: payload.materialId as string,
          binId: payload.binId as string,
          quantity: payload.quantity as number,
        });
        case 'pick': return warehouseApi.pick({
          materialId: payload.materialId as string,
          binId: payload.binId as string,
          quantity: payload.quantity as number,
        });
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (data, vars) => {
      setError('');
      invalidate();
      if (vars.type === 'lookupBin' && data && typeof data === 'object' && 'bin' in data) {
        const contents = data as { bin: StorageBin };
        setSelectedWh(contents.bin.warehouseId);
        setSelectedBinId(contents.bin._id);
        setTreeSel({ kind: 'all' });
        showSuccess(`Found bin ${binLabel(contents.bin)}`);
        return;
      }
      if (vars.type === 'createWh') {
        setWhForm({ warehouseCode: '', name: '', type: 'RAW_MATERIAL', isDefault: false });
        setAddKind(null);
        showSuccess('Warehouse created');
        return;
      }
      if (vars.type === 'createZone') {
        setZoneForm({ zoneCode: '', name: '' });
        setAddKind(null);
        showSuccess('Zone created');
        return;
      }
      if (vars.type === 'createRack') {
        setRackForm((f) => ({ ...f, rackCode: '' }));
        setAddKind(null);
        showSuccess('Rack created');
        return;
      }
      if (vars.type === 'createShelf') {
        setShelfForm((f) => ({ ...f, shelfCode: '' }));
        setAddKind(null);
        showSuccess('Shelf created');
        return;
      }
      if (vars.type === 'createBin') {
        setBinForm((f) => ({ ...f, binCode: '', capacity: '' }));
        setAddKind(null);
        showSuccess('Bin created');
        return;
      }
      if (vars.type === 'assignBinZone') showSuccess('Bin assigned to zone');
      if (vars.type === 'putAway') showSuccess('Put away complete');
      if (vars.type === 'pick') showSuccess('Pick complete');
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggleZone = (id: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleRack = (id: string) => {
    setExpandedRacks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectTree = (sel: TreeSel) => {
    setTreeSel(sel);
    setSelectedBinId(null);
    if (sel.kind === 'zone') {
      setExpandedZones((p) => new Set(p).add(sel.zoneId));
    }
    if (sel.kind === 'rack' || sel.kind === 'shelf') {
      setExpandedZones((p) => new Set(p).add(sel.zoneId));
      setExpandedRacks((p) => new Set(p).add(sel.rackId));
    }
  };

  const openAdd = (kind: AddKind) => {
    setAddKind(kind);
    if (kind === 'rack' && treeSel.kind !== 'all' && treeSel.kind !== 'unassigned') {
      setRackForm((f) => ({ ...f, zoneId: treeSel.zoneId || f.zoneId }));
    }
    if (kind === 'shelf') {
      if (treeSel.kind === 'rack' || treeSel.kind === 'shelf') {
        setShelfForm((f) => ({
          ...f,
          zoneId: treeSel.zoneId,
          rackId: treeSel.rackId,
        }));
      } else if (treeSel.kind === 'zone') {
        setShelfForm((f) => ({ ...f, zoneId: treeSel.zoneId, rackId: '' }));
      }
    }
    if (kind === 'bin') {
      if (treeSel.kind === 'shelf') {
        setBinForm((f) => ({
          ...f,
          zoneId: treeSel.zoneId,
          rackId: treeSel.rackId,
          shelfId: treeSel.shelfId,
        }));
      } else if (treeSel.kind === 'rack') {
        setBinForm((f) => ({
          ...f,
          zoneId: treeSel.zoneId,
          rackId: treeSel.rackId,
          shelfId: '',
        }));
      } else if (treeSel.kind === 'zone') {
        setBinForm((f) => ({ ...f, zoneId: treeSel.zoneId, rackId: '', shelfId: '' }));
      }
    }
  };

  const zoneBinCount = (zone: WarehouseZone & { bins?: StorageBin[]; racks?: WarehouseRack[] }) =>
    zone.bins?.length ?? 0;

  return (
    <>
      <AlertBanner message={error} onDismiss={() => setError('')} />
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess('')} />}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? 'Confirm'}
        message={confirmAction?.message ?? 'Continue?'}
        loading={mut.isPending}
        onConfirm={() => { confirmAction?.fn(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Warehouse picker + toolbar */}
      <ErpCard className="mb-3 !p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]">
            <label className={fieldLabel}>Warehouse</label>
            <ErpSelect
              className="!py-1.5 text-[11px]"
              value={whId}
              onChange={(e) => {
                setSelectedWh(e.target.value);
                setTreeSel({ kind: 'all' });
                setSelectedBinId(null);
                setExpandedZones(new Set());
                setExpandedRacks(new Set());
              }}
            >
              {warehouses.length === 0 && <option value="">No warehouses</option>}
              {warehouses.map((w: Warehouse) => (
                <option key={w._id} value={w._id}>
                  {w.warehouseCode} · {warehouseTypeLabel(w.type)}{w.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </ErpSelect>
          </div>
          <div className="relative min-w-[160px] flex-1">
            <label className={fieldLabel}>Search bins</label>
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
              <ErpInput
                className="!py-1.5 !pl-7 text-[11px]"
                placeholder="Code or barcode…"
                value={binSearch}
                onChange={(e) => setBinSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="min-w-[140px]">
            <label className={fieldLabel}>Scan barcode</label>
            <div className="flex gap-1">
              <ErpInput
                className="!py-1.5 text-[11px]"
                placeholder="BIN-…"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && barcodeInput.trim()) mut.mutate({ type: 'lookupBin' });
                }}
              />
              <ErpButton
                variant="secondary"
                className={btnSm}
                disabled={!barcodeInput.trim() || mut.isPending}
                onClick={() => mut.mutate({ type: 'lookupBin' })}
              >
                <Scan className="h-3 w-3" />
              </ErpButton>
            </div>
          </div>
          <ErpButton variant="secondary" className={`${btnSm} self-end`} onClick={() => { refetch(); invalidate(); }} disabled={isFetching}>
            Refresh
          </ErpButton>
          <Link to="/warehouse/stock-locator" className="self-end">
            <ErpButton variant="secondary" className={btnSm}>Find stock →</ErpButton>
          </Link>
          {(canCreate || canConfigure) && (
            <div className="flex flex-wrap gap-1 self-end">
              {canCreate && (
                <ErpButton className={btnSm} variant={addKind === 'warehouse' ? 'primary' : 'secondary'} onClick={() => openAdd(addKind === 'warehouse' ? null : 'warehouse')}>
                  <Plus className="mr-0.5 inline h-3 w-3" />Warehouse
                </ErpButton>
              )}
              {canConfigure && !!whId && (
                <>
                  <ErpButton className={btnSm} variant={addKind === 'zone' ? 'primary' : 'secondary'} onClick={() => openAdd(addKind === 'zone' ? null : 'zone')}>
                    <Plus className="mr-0.5 inline h-3 w-3" />Zone
                  </ErpButton>
                  <ErpButton className={btnSm} variant={addKind === 'rack' ? 'primary' : 'secondary'} onClick={() => openAdd(addKind === 'rack' ? null : 'rack')}>
                    <Plus className="mr-0.5 inline h-3 w-3" />Rack
                  </ErpButton>
                  <ErpButton className={btnSm} variant={addKind === 'shelf' ? 'primary' : 'secondary'} onClick={() => openAdd(addKind === 'shelf' ? null : 'shelf')}>
                    <Plus className="mr-0.5 inline h-3 w-3" />Shelf
                  </ErpButton>
                </>
              )}
              {canCreate && !!whId && (
                <ErpButton className={btnSm} variant={addKind === 'bin' ? 'primary' : 'secondary'} onClick={() => openAdd(addKind === 'bin' ? null : 'bin')}>
                  <Plus className="mr-0.5 inline h-3 w-3" />Bin
                </ErpButton>
              )}
            </div>
          )}
        </div>
      </ErpCard>

      {/* Collapsible add form */}
      {addKind && (
        <ErpCard className="mb-3 !p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold">
              Add {addKind}
            </h3>
            <ErpButton variant="secondary" className={btnSm} onClick={() => setAddKind(null)}>
              <X className="h-3 w-3" />
            </ErpButton>
          </div>

          {addKind === 'warehouse' && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className={fieldLabel}>Code</label>
                <ErpInput className="w-28 !py-1.5 text-[11px]" value={whForm.warehouseCode} onChange={(e) => setWhForm({ ...whForm, warehouseCode: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabel}>Name</label>
                <ErpInput className="w-40 !py-1.5 text-[11px]" value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabel}>Type</label>
                <ErpSelect className="w-36 !py-1.5 text-[11px]" value={whForm.type} onChange={(e) => setWhForm({ ...whForm, type: e.target.value })}>
                  <option value="RAW_MATERIAL">Raw material</option>
                  <option value="WIP">WIP</option>
                  <option value="FINISHED_GOODS">Finished goods</option>
                </ErpSelect>
              </div>
              <label className="flex items-center gap-1 text-[10px]">
                <input type="checkbox" checked={whForm.isDefault} onChange={(e) => setWhForm({ ...whForm, isDefault: e.target.checked })} />
                Default
              </label>
              <ErpButton
                className={btnSm}
                disabled={!whForm.warehouseCode.trim() || !whForm.name.trim() || mut.isPending}
                onClick={() => mut.mutate({ type: 'createWh', payload: whForm })}
              >
                Save
              </ErpButton>
            </div>
          )}

          {addKind === 'zone' && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className={fieldLabel}>Zone code</label>
                <ErpInput className="w-24 !py-1.5 text-[11px] font-mono" value={zoneForm.zoneCode} onChange={(e) => setZoneForm({ ...zoneForm, zoneCode: e.target.value })} placeholder="Z1" />
              </div>
              <div>
                <label className={fieldLabel}>Name</label>
                <ErpInput className="w-36 !py-1.5 text-[11px]" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="Zone 1" />
              </div>
              <ErpButton
                className={btnSm}
                disabled={!zoneForm.zoneCode.trim() || !zoneForm.name.trim() || mut.isPending}
                onClick={() => mut.mutate({ type: 'createZone', payload: zoneForm })}
              >
                Save
              </ErpButton>
            </div>
          )}

          {addKind === 'rack' && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className={fieldLabel}>Zone</label>
                <ErpSelect className="w-32 !py-1.5 text-[11px]" value={rackForm.zoneId} onChange={(e) => setRackForm({ ...rackForm, zoneId: e.target.value })}>
                  <option value="">Select…</option>
                  {zones.map((z) => <option key={z._id} value={z._id}>{z.zoneCode}</option>)}
                </ErpSelect>
              </div>
              <div>
                <label className={fieldLabel}>Rack code</label>
                <ErpInput className="w-24 !py-1.5 text-[11px] font-mono" value={rackForm.rackCode} onChange={(e) => setRackForm({ ...rackForm, rackCode: e.target.value })} placeholder="R-11" />
              </div>
              <ErpButton
                className={btnSm}
                disabled={!rackForm.zoneId || !rackForm.rackCode.trim() || mut.isPending}
                onClick={() => mut.mutate({ type: 'createRack', payload: rackForm })}
              >
                Save
              </ErpButton>
              {zones.length === 0 && <p className="text-[10px] text-amber-700">Create a zone first</p>}
            </div>
          )}

          {addKind === 'shelf' && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className={fieldLabel}>Zone</label>
                <ErpSelect
                  className="w-28 !py-1.5 text-[11px]"
                  value={shelfForm.zoneId}
                  onChange={(e) => setShelfForm({ zoneId: e.target.value, rackId: '', shelfCode: shelfForm.shelfCode })}
                >
                  <option value="">Select…</option>
                  {zones.map((z) => <option key={z._id} value={z._id}>{z.zoneCode}</option>)}
                </ErpSelect>
              </div>
              <div>
                <label className={fieldLabel}>Rack</label>
                <ErpSelect
                  className="w-28 !py-1.5 text-[11px]"
                  value={shelfForm.rackId}
                  disabled={!shelfForm.zoneId}
                  onChange={(e) => setShelfForm({ ...shelfForm, rackId: e.target.value })}
                >
                  <option value="">Select…</option>
                  {racksForShelf.map((r) => <option key={r._id} value={r._id}>{r.rackCode}</option>)}
                </ErpSelect>
              </div>
              <div>
                <label className={fieldLabel}>Shelf code</label>
                <ErpInput className="w-24 !py-1.5 text-[11px] font-mono" value={shelfForm.shelfCode} onChange={(e) => setShelfForm({ ...shelfForm, shelfCode: e.target.value })} placeholder="S-8" />
              </div>
              <ErpButton
                className={btnSm}
                disabled={!shelfForm.rackId || !shelfForm.shelfCode.trim() || mut.isPending}
                onClick={() => mut.mutate({ type: 'createShelf', payload: shelfForm })}
              >
                Save
              </ErpButton>
            </div>
          )}

          {addKind === 'bin' && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className={fieldLabel}>Zone</label>
                <ErpSelect
                  className="w-28 !py-1.5 text-[11px]"
                  value={binForm.zoneId}
                  onChange={(e) => setBinForm({ ...binForm, zoneId: e.target.value, rackId: '', shelfId: '' })}
                >
                  <option value="">Select…</option>
                  {zones.map((z) => <option key={z._id} value={z._id}>{z.zoneCode}</option>)}
                </ErpSelect>
              </div>
              <div>
                <label className={fieldLabel}>Rack</label>
                <ErpSelect
                  className="w-28 !py-1.5 text-[11px]"
                  value={binForm.rackId}
                  disabled={!binForm.zoneId}
                  onChange={(e) => setBinForm({ ...binForm, rackId: e.target.value, shelfId: '' })}
                >
                  <option value="">—</option>
                  {racksForBin.map((r) => <option key={r._id} value={r._id}>{r.rackCode}</option>)}
                </ErpSelect>
              </div>
              <div>
                <label className={fieldLabel}>Shelf</label>
                <ErpSelect
                  className="w-28 !py-1.5 text-[11px]"
                  value={binForm.shelfId}
                  disabled={!binForm.rackId}
                  onChange={(e) => setBinForm({ ...binForm, shelfId: e.target.value })}
                >
                  <option value="">—</option>
                  {shelvesForBin.map((s) => <option key={s._id} value={s._id}>{s.shelfCode}</option>)}
                </ErpSelect>
              </div>
              <div>
                <label className={fieldLabel}>Bin code</label>
                <ErpInput className="w-32 !py-1.5 text-[11px] font-mono" value={binForm.binCode} onChange={(e) => setBinForm({ ...binForm, binCode: e.target.value })} placeholder="Z1-R-11-S-8" />
              </div>
              <div>
                <label className={fieldLabel}>Capacity</label>
                <ErpInput type="number" className="w-20 !py-1.5 text-[11px]" value={binForm.capacity} onChange={(e) => setBinForm({ ...binForm, capacity: e.target.value })} />
              </div>
              <ErpButton
                className={btnSm}
                disabled={!binForm.zoneId || !binForm.binCode.trim() || mut.isPending}
                onClick={() => mut.mutate({
                  type: 'createBin',
                  payload: {
                    zoneId: binForm.zoneId,
                    rackId: binForm.rackId || undefined,
                    shelfId: binForm.shelfId || undefined,
                    binCode: binForm.binCode.trim(),
                    capacity: binForm.capacity ? Number(binForm.capacity) : undefined,
                  },
                })}
              >
                Save
              </ErpButton>
            </div>
          )}
        </ErpCard>
      )}

      {!whId ? (
        <ErpCard className="!p-6 text-center text-[11px] text-erp-text-muted">
          <WhIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
          No warehouse yet — click <strong>Warehouse</strong> to create one.
        </ErpCard>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Tree */}
          <ErpCard className="!p-0 overflow-hidden max-h-[70vh] flex flex-col">
            <div className="border-b border-[var(--erp-border)] px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Layout</p>
              <p className="truncate font-mono text-[11px]">{selectedWarehouse?.warehouseCode}</p>
            </div>
            <div className="overflow-y-auto p-2 text-[11px]">
              {layoutLoading ? (
                <p className="p-2 text-erp-text-muted">Loading layout…</p>
              ) : (
                <ul className="space-y-0.5">
                  <li>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left hover:bg-[var(--erp-surface-muted)] ${treeSel.kind === 'all' ? 'bg-[var(--erp-accent-muted)] font-medium' : ''}`}
                      onClick={() => selectTree({ kind: 'all' })}
                    >
                      All bins
                      <span className="ml-auto text-[10px] text-erp-text-muted">{allBins.length}</span>
                    </button>
                  </li>
                  {(layout?.unassignedBins?.length ?? 0) > 0 && (
                    <li>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-amber-800 hover:bg-amber-500/10 ${treeSel.kind === 'unassigned' ? 'bg-amber-500/15 font-medium' : ''}`}
                        onClick={() => selectTree({ kind: 'unassigned' })}
                      >
                        Unassigned
                        <span className="ml-auto text-[10px]">{layout?.unassignedBins?.length}</span>
                      </button>
                    </li>
                  )}
                  {zones.slice().sort((a, b) => sortCode(a.zoneCode || '', b.zoneCode || '')).map((zone) => {
                    const open = expandedZones.has(zone._id);
                    const racks = (zone.racks ?? []).slice().sort((a, b) => sortCode(a.rackCode, b.rackCode));
                    const selected = treeSel.kind === 'zone' && treeSel.zoneId === zone._id;
                    return (
                      <li key={zone._id}>
                        <div className="flex items-center">
                          <button type="button" className="rounded p-1 hover:bg-[var(--erp-surface-muted)]" onClick={() => toggleZone(zone._id)}>
                            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>
                          <button
                            type="button"
                            className={`flex flex-1 items-center gap-1 rounded px-1 py-1 text-left hover:bg-[var(--erp-surface-muted)] ${selected ? 'bg-[var(--erp-accent-muted)] font-medium' : ''}`}
                            onClick={() => selectTree({ kind: 'zone', zoneId: zone._id })}
                          >
                            <span className="font-mono">{zone.zoneCode || '—'}</span>
                            {zone.name && <span className="truncate text-erp-text-muted">· {zone.name}</span>}
                            <span className="ml-auto text-[10px] text-erp-text-muted">{zoneBinCount(zone)}</span>
                          </button>
                        </div>
                        {open && (
                          <ul className="ml-4 border-l border-[var(--erp-border)] pl-1">
                            {racks.length === 0 && (
                              <li className="px-2 py-1 text-[10px] text-erp-text-muted">No racks</li>
                            )}
                            {racks.map((rack) => {
                              const rackOpen = expandedRacks.has(rack._id);
                              const shelves = (rack.shelves ?? []).slice().sort((a, b) => sortCode(a.shelfCode, b.shelfCode));
                              const rackSel = treeSel.kind === 'rack' && treeSel.rackId === rack._id;
                              const rackBinCount = (zone.bins ?? []).filter((b) => b.rackId === rack._id).length;
                              return (
                                <li key={rack._id}>
                                  <div className="flex items-center">
                                    <button type="button" className="rounded p-1 hover:bg-[var(--erp-surface-muted)]" onClick={() => toggleRack(rack._id)}>
                                      {rackOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </button>
                                    <button
                                      type="button"
                                      className={`flex flex-1 items-center gap-1 rounded px-1 py-0.5 text-left font-mono hover:bg-[var(--erp-surface-muted)] ${rackSel ? 'bg-[var(--erp-accent-muted)] font-medium' : ''}`}
                                      onClick={() => selectTree({ kind: 'rack', zoneId: zone._id, rackId: rack._id })}
                                    >
                                      {rack.rackCode}
                                      <span className="ml-auto text-[10px] font-sans text-erp-text-muted">
                                        {shelves.length}s · {rackBinCount}b
                                      </span>
                                    </button>
                                  </div>
                                  {rackOpen && (
                                    <ul className="ml-4 border-l border-[var(--erp-border)] pl-1">
                                      {shelves.length === 0 && (
                                        <li className="px-2 py-0.5 text-[10px] text-erp-text-muted">No shelves</li>
                                      )}
                                      {shelves.map((shelf) => {
                                        const shelfSel = treeSel.kind === 'shelf' && treeSel.shelfId === shelf._id;
                                        const shelfBinCount = (zone.bins ?? []).filter((b) => b.shelfId === shelf._id).length;
                                        return (
                                          <li key={shelf._id}>
                                            <button
                                              type="button"
                                              className={`flex w-full items-center gap-1 rounded px-2 py-0.5 text-left font-mono hover:bg-[var(--erp-surface-muted)] ${shelfSel ? 'bg-[var(--erp-accent-muted)] font-medium' : ''}`}
                                              onClick={() => selectTree({
                                                kind: 'shelf',
                                                zoneId: zone._id,
                                                rackId: rack._id,
                                                shelfId: shelf._id,
                                              })}
                                            >
                                              {shelf.shelfCode}
                                              <span className="ml-auto text-[10px] font-sans text-erp-text-muted">{shelfBinCount}</span>
                                            </button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                  {zones.length === 0 && (
                    <li className="px-2 py-3 text-erp-text-muted">No zones — add a Zone to start.</li>
                  )}
                </ul>
              )}
            </div>
          </ErpCard>

          {/* Bins + stock */}
          <div className="space-y-3 min-w-0">
            <ErpCard className="!p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--erp-border)] px-3 py-2">
                <div>
                  <p className="text-[10px] text-erp-text-muted">{breadcrumb.join(' / ')}</p>
                  <p className="text-[11px] font-medium">{filteredBins.length} bin{filteredBins.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[42vh]">
                <ErpDataTable className="w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left">Bin</th>
                      <th className="px-3 py-2 text-left">Location</th>
                      <th className="px-3 py-2 text-left">Barcode</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageBins.map((b) => {
                      const zone = zones.find((z) => z._id === b.zoneId);
                      const rack = (zone?.racks ?? []).find((r) => r._id === b.rackId);
                      const shelf = (rack?.shelves ?? []).find((s) => s._id === b.shelfId);
                      const loc = [zone?.zoneCode, rack?.rackCode, shelf?.shelfCode].filter(Boolean).join(' / ') || '—';
                      const active = selectedBinId === b._id;
                      return (
                        <tr
                          key={b._id}
                          className={`border-t border-[var(--erp-border)] ${active ? 'bg-[var(--erp-accent-muted)]' : ''}`}
                        >
                          <td className="px-3 py-2 font-mono">{binLabel(b)}</td>
                          <td className="px-3 py-2 font-mono text-[10px] text-erp-text-muted">{loc}</td>
                          <td className="px-3 py-2 text-[10px] text-erp-text-muted">{b.barcode || '—'}</td>
                          <td className="px-3 py-2"><ErpStatusBadge status={b.status} label={statusLabel(b.status)} /></td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              {!b.zoneId && canCreate && zones[0] && (
                                <ErpButton
                                  className={btnSm}
                                  variant="secondary"
                                  onClick={() => mut.mutate({
                                    type: 'assignBinZone',
                                    payload: { binId: b._id, zoneId: zones[0]._id },
                                  })}
                                >
                                  Assign {zones[0].zoneCode}
                                </ErpButton>
                              )}
                              <ErpButton
                                className={btnSm}
                                variant="secondary"
                                onClick={() => openBinStock(b._id)}
                              >
                                Stock
                              </ErpButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {pageBins.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-erp-text-muted">
                          {treeSel.kind === 'all' && zones.length === 0
                            ? 'No layout yet — add a Zone, then Rack / Shelf / Bin.'
                            : 'No bins in this selection.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </ErpDataTable>
              </div>
              {filteredBins.length > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2 text-[10px] text-erp-text-muted">
                  <span>{binPage}/{totalPages} · {filteredBins.length}</span>
                  <div className="flex gap-1">
                    <ErpButton className={btnSm} variant="secondary" disabled={binPage <= 1} onClick={() => setBinPage((p) => p - 1)}>Prev</ErpButton>
                    <ErpButton className={btnSm} variant="secondary" disabled={binPage >= totalPages} onClick={() => setBinPage((p) => p + 1)}>Next</ErpButton>
                  </div>
                </div>
              )}
            </ErpCard>
          </div>
        </div>
      )}

      {stockModalOpen && selectedBinId && (
        <ModalShell onClose={closeBinStock}>
          <div className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface,var(--erp-header-bg,#fff))] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--erp-border)] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-erp-text-primary">
                  <Package className="mr-1.5 inline h-4 w-4" />
                  Bin stock — {binLabel(binContents?.bin || allBins.find((b) => b._id === selectedBinId))}
                </h3>
                <p className="mt-0.5 text-[10px] text-erp-text-muted">
                  {filteredStockRows.length} item{filteredStockRows.length === 1 ? '' : 's'}
                  {stockSearch.trim() ? ` matching “${stockSearch.trim()}”` : ''}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-erp-text-muted hover:bg-[var(--erp-surface-muted)] hover:text-erp-text-primary"
                onClick={closeBinStock}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-4 py-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <label className={fieldLabel}>Search stock</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-erp-text-muted" />
                    <ErpInput
                      className="!py-1.5 !pl-7 text-[11px]"
                      placeholder="Material / SKU code or name…"
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                {isRmWarehouse && (
                  <div className="flex gap-1">
                    <Link to="/warehouse/operations/put-away"><ErpButton variant="secondary" className={btnSm}>Put-away</ErpButton></Link>
                    <Link to="/warehouse/operations/picking"><ErpButton variant="secondary" className={btnSm}>Picking</ErpButton></Link>
                  </div>
                )}
                {selectedWarehouse?.type === 'FINISHED_GOODS' && (binContents?.finishedGoods?.length ?? 0) > 0 && (
                  <Link to="/warehouse/operations/dispatch">
                    <ErpButton variant="secondary" className={btnSm}>Dispatch →</ErpButton>
                  </Link>
                )}
              </div>

              {isRmWarehouse && canUpdate && (
                <div className="flex flex-wrap items-end gap-2 rounded border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] p-2">
                  <div className="min-w-[120px]">
                    <label className={fieldLabel}>Material</label>
                    <ErpSelect className="!py-1 text-[11px]" value={stockQuickMaterialId} onChange={(e) => setStockQuickMaterialId(e.target.value)}>
                      <option value="">Select…</option>
                      {materials.map((m: Material) => (
                        <option key={m._id} value={m._id}>{m.materialCode}</option>
                      ))}
                    </ErpSelect>
                  </div>
                  <div>
                    <label className={fieldLabel}>Qty</label>
                    <ErpInput type="number" min={1} className="w-20 !py-1 text-[11px]" value={stockQuickQty} onChange={(e) => setStockQuickQty(e.target.value)} />
                  </div>
                  {stockMatId && (
                    <p className="text-[10px] text-erp-text-muted">Dock: {stockUnalloc}</p>
                  )}
                  <ErpButton
                    variant="secondary"
                    className={btnSm}
                    disabled={!stockMatId || stockUnalloc <= 0 || stockPutQty <= 0 || stockPutQty > stockUnalloc || mut.isPending}
                    onClick={() => setConfirmAction({
                      title: 'Put away to bin',
                      message: `Move ${stockPutQty} from dock → ${binLabel(binContents?.bin)}?`,
                      fn: () => mut.mutate({
                        type: 'putAway',
                        payload: { materialId: stockMatId, binId: selectedBinId, quantity: stockPutQty },
                      }),
                    })}
                  >
                    Put away here
                  </ErpButton>
                </div>
              )}

              <div className="overflow-hidden rounded border border-[var(--erp-border)]">
                <ErpDataTable className="w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-right">On hand</th>
                      <th className="px-3 py-2 text-right">Avail</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {binContentsLoading && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-erp-text-muted">Loading…</td></tr>
                    )}
                    {!binContentsLoading && pagedStockRows.map((row) => {
                      const pickQty = Math.min(stockQuickQtyNum, row.available);
                      return (
                        <tr key={row.key} className="border-t border-[var(--erp-border)]">
                          <td className="px-3 py-2">
                            <span className="rounded bg-[var(--erp-surface-muted)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-erp-text-muted">
                              {row.kind === 'RM' ? 'Raw' : 'FG'}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">{row.code}</td>
                          <td className="px-3 py-2 text-erp-text-primary">{row.label}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {row.onHand}{row.unit ? ` ${row.unit}` : ''}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{row.available}</td>
                          <td className="px-3 py-2 text-[10px] text-erp-text-muted">
                            {row.dispatchStatus ? statusLabel(row.dispatchStatus) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.kind === 'RM' && isRmWarehouse && canUpdate && row.materialId && (
                              <ErpButton
                                className={btnSm}
                                disabled={row.available <= 0 || mut.isPending}
                                onClick={() => setConfirmAction({
                                  title: 'Pick from bin',
                                  message: `Pick ${pickQty} from ${binLabel(binContents?.bin)}?`,
                                  fn: () => mut.mutate({
                                    type: 'pick',
                                    payload: { materialId: row.materialId, binId: selectedBinId, quantity: pickQty },
                                  }),
                                })}
                              >
                                Pick {pickQty}
                              </ErpButton>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!binContentsLoading && pagedStockRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-erp-text-muted">
                          {stockRows.length === 0 ? 'This bin is empty.' : 'No stock matches your search.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </ErpDataTable>
                {filteredStockRows.length > STOCK_PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2 text-[10px] text-erp-text-muted">
                    <span>
                      Page {Math.min(stockPage, stockTotalPages)} / {stockTotalPages} · {filteredStockRows.length} items
                    </span>
                    <div className="flex gap-1">
                      <ErpButton
                        className={btnSm}
                        variant="secondary"
                        disabled={stockPage <= 1}
                        onClick={() => setStockPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </ErpButton>
                      <ErpButton
                        className={btnSm}
                        variant="secondary"
                        disabled={stockPage >= stockTotalPages}
                        onClick={() => setStockPage((p) => Math.min(stockTotalPages, p + 1))}
                      >
                        Next
                      </ErpButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
