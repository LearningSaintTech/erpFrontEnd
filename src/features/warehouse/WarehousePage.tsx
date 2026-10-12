import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft, Boxes, ClipboardCheck, ClipboardList, Package, PackageOpen, Plus, RefreshCw, Truck,
} from 'lucide-react';
import { warehouseApi } from '../../services/operations';
import { inventoryApi, skuApi } from '../../services/manufacturing';
import type {
  CycleCount, CycleCountLine, DispatchReadyBalance, InventoryBalance, StorageBin,
} from '../../types/api';
import {
  Badge, Button, Drawer, EmptyRow, ErpDataTable, ErpInput, ErpSearchSelect, ErpSelect, Field, IconButton, InfoBanner, KpiGrid,
  PageHeader, Section, StatTile, StatusBadge, StepFlow, TableSkeleton, toast, useConfirm,
} from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  binBalanceRow, binLabel, cycleLineMaterial, dispatchBinId as getDispatchBinId, dispatchRowQty,
  dispatchRowSku, indexBalancesByBin, materialLabel, materialRowId, statusLabel, stockOpSuccessMessage, transferableQty, unallocatedBalance,
  warehouseLabel, warehouseTypeLabel,
} from './warehouseUtils';
import { StockLocatorSection } from './StockLocatorSection';
import { SitesLayoutSection } from './SitesLayoutSection';
import { QueryErrorRow } from '../production/QueryErrorRow';

type WarehouseSection = 'warehouses' | 'stock-locator' | 'put-away' | 'picking' | 'transfer' | 'dispatch' | 'cycle-counts';
type OpsInvType = 'RAW_MATERIAL' | 'FINISHED_GOODS';

const OPS_SECTIONS: WarehouseSection[] = ['put-away', 'picking', 'transfer', 'dispatch', 'cycle-counts'];
const BIN_OPS: WarehouseSection[] = ['put-away', 'picking', 'transfer'];

const sectionMeta: Record<WarehouseSection, { title: string; description: string }> = {
  warehouses: { title: 'Sites & layout', description: '' },
  'stock-locator': { title: 'Find stock', description: 'See every location holding a material or SKU — dock, zone, rack, shelf and bin.' },
  'put-away': { title: 'Put away', description: 'Move received stock from the dock into storage bins.' },
  picking: { title: 'Picking', description: 'Take stock out of bins for production, sampling or outbound.' },
  transfer: { title: 'Bin transfer', description: 'Move stock between bins, or from the dock into a bin.' },
  dispatch: { title: 'Dispatch', description: 'Stage finished goods, mark them ready and ship.' },
  'cycle-counts': { title: 'Cycle counts', description: 'Count bins physically and post the differences.' },
};

function varianceTone(v: number) {
  if (v > 0) return 'text-[var(--erp-success-text)]';
  if (v < 0) return 'text-[var(--erp-danger-text)]';
  return 'text-erp-text-muted';
}

/** Two-option segmented control (large enough for touch). */
function TypeToggle({ value, onChange }: { value: OpsInvType; onChange: (v: OpsInvType) => void }) {
  const opts: { id: OpsInvType; label: string }[] = [
    { id: 'RAW_MATERIAL', label: 'Raw materials' },
    { id: 'FINISHED_GOODS', label: 'Finished goods' },
  ];
  return (
    <div role="radiogroup" aria-label="Inventory type" className="inline-flex rounded-md border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] p-0.5">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-9 rounded px-3 text-sm font-medium transition-colors ${value === o.id ? 'bg-[var(--erp-surface)] text-erp-text-primary shadow-erp-xs' : 'text-erp-text-muted hover:text-erp-text-primary'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: 'warn' }) {
  return (
    <div className="min-w-[120px]">
      <p className="text-xs text-erp-text-muted">{label}</p>
      <p className={`erp-tabular text-lg font-semibold ${tone === 'warn' ? 'text-[var(--erp-warning-text)]' : ''}`}>{value}</p>
    </div>
  );
}

export function WarehousePage({ section = 'warehouses' }: { section?: WarehouseSection }) {
  if (section === 'warehouses') return <SitesLayoutSection />;
  // Keyed so each operation starts with its own defaults (e.g. dispatch → finished goods).
  return <WarehouseOps key={section} section={section} />;
}

function WarehouseOps({ section }: { section: Exclude<WarehouseSection, 'warehouses'> }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('warehouse.create');
  const canUpdate = permissions.includes('*') || permissions.includes('warehouse.update');

  const meta = sectionMeta[section];
  const [selectedWh, setSelectedWh] = useState('');

  const [opMaterialId, setOpMaterialId] = useState('');
  const [opSkuId, setOpSkuId] = useState('');
  const [opQty, setOpQty] = useState('10');
  const [putAwayQty, setPutAwayQty] = useState('');
  const [transferBinId, setTransferBinId] = useState('');
  const [transferFromBinId, setTransferFromBinId] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [dispatchSkuId, setDispatchSkuId] = useState('');
  const [dispatchBinId, setDispatchBinId] = useState('');
  const [dispatchQty, setDispatchQty] = useState('5');
  const [activeCountId, setActiveCountId] = useState<string | null>(null);
  const [countLines, setCountLines] = useState<CycleCountLine[]>([]);
  const [applyAdjustments, setApplyAdjustments] = useState(true);

  const isOpsSection = OPS_SECTIONS.includes(section);
  const isBinOps = BIN_OPS.includes(section);
  const initialOpsType: OpsInvType = (() => {
    const paramType = searchParams.get('inventoryType');
    if (paramType === 'FINISHED_GOODS' || paramType === 'RAW_MATERIAL') return paramType;
    if (searchParams.get('skuId')) return 'FINISHED_GOODS';
    if (searchParams.get('materialId') || searchParams.get('material')) return 'RAW_MATERIAL';
    return section === 'dispatch' ? 'FINISHED_GOODS' : 'RAW_MATERIAL';
  })();
  const [opsInvType, setOpsInvType] = useState<OpsInvType>(initialOpsType);
  const isFgOps = opsInvType === 'FINISHED_GOODS';
  const isRmOps = opsInvType === 'RAW_MATERIAL';

  const invalidate = () => {
    [
      'warehouse-stats', 'warehouses', 'warehouses-all', 'bins', 'bins-ops', 'bin-contents', 'dispatch-ready', 'cycle-counts',
      'cycle-count', 'warehouse-layout', 'zones', 'racks', 'shelves', 'inventory-availability', 'inventory-balances',
      'inventory-balances-mat', 'inventory-balances-page', 'inventory-stats', 'fg-balances-dispatch', 'fg-balances-ops', 'stock-locator',
    ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const statsQ = useQuery({ queryKey: ['warehouse-stats'], queryFn: () => warehouseApi.stats() });
  const stats = statsQ.data;

  const { data: allWarehouses = [], isFetching, refetch } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehouseApi.list({ limit: 100 }),
  });

  const rmWarehouse = useMemo(
    () => allWarehouses.find((w) => w.type === 'RAW_MATERIAL' && w.isDefault) || allWarehouses.find((w) => w.type === 'RAW_MATERIAL'),
    [allWarehouses],
  );
  const fgWarehouse = useMemo(
    () => allWarehouses.find((w) => w.type === 'FINISHED_GOODS' && w.isDefault) || allWarehouses.find((w) => w.type === 'FINISHED_GOODS'),
    [allWarehouses],
  );
  const typeDefaultWh = isFgOps ? fgWarehouse : rmWarehouse;

  const whId = isOpsSection ? (selectedWh || typeDefaultWh?._id || '') : (selectedWh || allWarehouses[0]?._id || '');
  const pickerWarehouses = isOpsSection ? allWarehouses.filter((w) => w.type === opsInvType) : allWarehouses;

  const { data: opsBins = [], isLoading: opsBinsLoading } = useQuery({
    queryKey: ['bins-ops', whId],
    queryFn: () => warehouseApi.listBins(whId, { limit: 200 }),
    enabled: !!whId && (isBinOps || section === 'dispatch' || section === 'cycle-counts'),
  });
  const bins = opsBins;
  const fgBins = isFgOps ? bins : [];

  const { data: dockQueue = [] } = useQuery({
    queryKey: ['wh-dock-queue'],
    queryFn: () => inventoryApi.listBalancesPage({ inventoryType: 'RAW_MATERIAL', limit: 200 })
      .then((r) => r.items.filter((b) => !b.storageBinId && transferableQty(b) > 0)),
    enabled: isRmOps && section === 'put-away',
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['materials-wh'],
    queryFn: () => inventoryApi.listMaterialsPage({ limit: 200 }).then((r) => r.items),
    enabled: isRmOps && isOpsSection,
  });

  useEffect(() => {
    if (!isBinOps || !isRmOps || opMaterialId) return;
    const paramId = searchParams.get('materialId');
    const paramCode = searchParams.get('material');
    if (paramId) {
      setOpMaterialId(paramId);
      return;
    }
    if (paramCode && materials.length) {
      const match = materials.find(
        (m) => m.materialCode?.toLowerCase() === paramCode.toLowerCase() || m.name?.toLowerCase() === paramCode.toLowerCase(),
      );
      if (match) setOpMaterialId(match._id);
    }
  }, [searchParams, materials, isBinOps, isRmOps, opMaterialId]);

  useEffect(() => {
    if ((!isBinOps && section !== 'dispatch') || !isFgOps || opSkuId || dispatchSkuId) return;
    const skuParam = searchParams.get('skuId');
    if (skuParam) {
      setOpSkuId(skuParam);
      setDispatchSkuId(skuParam);
    }
  }, [section, searchParams, isBinOps, isFgOps, opSkuId, dispatchSkuId]);

  const matId = opMaterialId;
  const skuId = opSkuId || dispatchSkuId;

  // Warehouse managers have no sku.read — only ask for the SKU master when allowed; the SKUs that
  // actually have finished-goods stock come from the FG balances below either way.
  const canReadSkus = permissions.includes('*') || permissions.includes('sku.read');
  const { data: skuMaster = [] } = useQuery({
    queryKey: ['skus-wh'],
    queryFn: () => skuApi.listPage({ limit: 200 }).then((r) => r.items),
    enabled: isFgOps && isOpsSection && canReadSkus,
  });

  const dispatchReadyQ = useQuery({
    queryKey: ['dispatch-ready'],
    queryFn: () => warehouseApi.listDispatchReady(),
    enabled: section === 'dispatch' && isFgOps,
  });
  const dispatchReady = dispatchReadyQ.data ?? [];

  const cycleCountsQ = useQuery({
    queryKey: ['cycle-counts'],
    queryFn: () => warehouseApi.listCycleCounts(),
    enabled: section === 'cycle-counts',
  });
  const cycleCounts = cycleCountsQ.data ?? [];

  const { data: activeCount, isLoading: activeCountLoading } = useQuery({
    queryKey: ['cycle-count', activeCountId],
    queryFn: () => warehouseApi.getCycleCount(activeCountId!),
    enabled: !!activeCountId,
  });

  const { data: matAvailability } = useQuery({
    queryKey: ['inventory-availability', matId],
    queryFn: () => inventoryApi.availability(matId),
    enabled: !!matId && isRmOps && (isBinOps || section === 'dispatch'),
  });

  const { data: matBalanceRows = [] } = useQuery({
    queryKey: ['inventory-balances-mat', matId],
    queryFn: async () => {
      const mat = materials.find((m) => m._id === matId);
      const { items } = await inventoryApi.listBalancesPage({ search: mat?.materialCode, limit: 50 });
      return items.filter((b) => {
        const mid = typeof b.materialId === 'object' ? b.materialId._id : b.materialId;
        return mid === matId;
      });
    },
    enabled: !!matId && isRmOps && (isBinOps || section === 'dispatch'),
  });

  const { data: fgBalances = [] } = useQuery({
    queryKey: ['fg-balances-ops', skuId],
    queryFn: () => inventoryApi.listBalancesPage({ inventoryType: 'FINISHED_GOODS', limit: 100 }).then((r) => r.items),
    enabled: isFgOps && isOpsSection,
  });

  type FgBalanceRow = InventoryBalance & { skuId?: string | { _id?: string; skuCode?: string; name?: string }; dispatchStatus?: string };
  const skus = useMemo(() => {
    const byId = new Map<string, { _id: string; skuCode: string; name?: string }>();
    for (const s of skuMaster) byId.set(s._id, { _id: s._id, skuCode: s.skuCode, name: s.name });
    for (const b of fgBalances as FgBalanceRow[]) {
      const ref = b.skuId;
      if (ref && typeof ref === 'object' && ref._id && !byId.has(ref._id)) {
        byId.set(ref._id, { _id: ref._id, skuCode: ref.skuCode || ref._id.slice(-6), name: ref.name });
      }
    }
    return [...byId.values()];
  }, [skuMaster, fgBalances]);
  const selectedFgBalance = (fgBalances as FgBalanceRow[]).find((b) => {
    const sid = typeof b.skuId === 'object' ? b.skuId?._id : b.skuId;
    return sid === skuId;
  });
  const fgOnHand = selectedFgBalance?.onHand ?? 0;
  const fgStatus = selectedFgBalance?.dispatchStatus || '';
  const fgBinId = selectedFgBalance?.storageBinId
    ? (typeof selectedFgBalance.storageBinId === 'string' ? selectedFgBalance.storageBinId : selectedFgBalance.storageBinId._id)
    : '';

  const unallocRow = isRmOps ? unallocatedBalance(matBalanceRows) : undefined;
  const unallocTransferable = isRmOps ? transferableQty(unallocRow) : (fgBinId ? 0 : transferableQty(selectedFgBalance));
  const binBalanceMap = useMemo(() => {
    if (isRmOps) return indexBalancesByBin(matBalanceRows);
    const map = new Map<string, InventoryBalance>();
    if (selectedFgBalance && fgBinId) map.set(fgBinId, selectedFgBalance);
    return map;
  }, [isRmOps, matBalanceRows, selectedFgBalance, fgBinId]);

  const itemSelected = isFgOps ? !!skuId : !!matId;

  const mut = useMutation({
    mutationFn: async (action: { type: string; payload?: Record<string, unknown> }) => {
      const { type, payload = {} } = action;
      const activeSku = (payload.skuId as string) || skuId || dispatchSkuId;
      switch (type) {
        case 'putAway':
          if (isFgOps) {
            return warehouseApi.fgPutAway({
              skuId: activeSku,
              binId: payload.binId as string,
              quantity: payload.quantity != null ? Number(payload.quantity) : (putAwayQty ? Number(putAwayQty) : Math.max(1, fgOnHand)),
            });
          }
          return warehouseApi.putAway({
            materialId: (payload.materialId as string) || matId,
            binId: payload.binId as string,
            quantity: payload.quantity != null ? (Number(payload.quantity) || undefined) : (putAwayQty ? Number(putAwayQty) : undefined),
          });
        case 'pick':
          return warehouseApi.pick({
            ...(isFgOps ? { skuId: activeSku } : { materialId: (payload.materialId as string) || matId }),
            binId: payload.binId as string,
            quantity: payload.quantity != null ? Number(payload.quantity) : (Number(opQty) || 1),
          });
        case 'transfer':
          return warehouseApi.transfer({
            ...(isFgOps ? { skuId: activeSku } : { materialId: matId }),
            toBinId: transferBinId,
            fromBinId: transferFromBinId || (isFgOps ? fgBinId || undefined : undefined),
            quantity: transferQty ? Number(transferQty) : undefined,
          });
        case 'fgPutAway': return warehouseApi.fgPutAway({
          skuId: dispatchSkuId || activeSku,
          binId: (payload.binId as string) || dispatchBinId || fgBinId,
          quantity: Number(dispatchQty) || 1,
        });
        case 'markReady': return warehouseApi.markDispatchReady({
          skuId: dispatchSkuId || activeSku,
          storageBinId: (payload.storageBinId as string) || dispatchBinId || fgBinId,
        });
        case 'dispatch': return warehouseApi.dispatch({
          skuId: payload.skuId as string,
          storageBinId: payload.storageBinId as string,
          quantity: payload.quantity as number,
        });
        case 'startCount': return warehouseApi.startCycleCount(payload.id as string);
        case 'createCount': return warehouseApi.createCycleCount({ warehouseId: whId });
        case 'completeCount': return warehouseApi.completeCycleCount(payload.id as string, {
          lines: payload.lines as CycleCountLine[],
          applyAdjustments: payload.applyAdjustments as boolean,
        });
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (data, vars) => {
      if (vars.type === 'completeCount') {
        setActiveCountId(null);
        setCountLines([]);
        toast.success('Cycle count completed', { description: applyAdjustments ? 'Differences were posted to inventory.' : undefined });
      } else if (['putAway', 'pick', 'transfer', 'fgPutAway', 'markReady', 'dispatch'].includes(vars.type)) {
        const bin = vars.type === 'putAway' ? bins.find((b) => b._id === (vars.payload as { binId?: string } | undefined)?.binId) : undefined;
        const mat = vars.type === 'putAway' ? materials.find((m) => m._id === opMaterialId) : undefined;
        toast.success(
          stockOpSuccessMessage(vars.type, data),
          bin ? { description: `${mat ? `${mat.materialCode} → ` : ''}${binLabel(bin)}` } : undefined,
        );
        if (vars.type === 'putAway') qc.invalidateQueries({ queryKey: ['wh-dock-queue'] });
        if (vars.type === 'transfer') { setTransferQty(''); setTransferBinId(''); }
        // Shipped: start the staging form fresh for the next item instead of the old SKU / bin.
        if (vars.type === 'dispatch') { setDispatchSkuId(''); setDispatchBinId(''); }
      } else if (vars.type === 'createCount') {
        toast.success('Cycle count created', { description: 'Start it, then enter the counted quantities.' });
      } else {
        toast.success('Count started');
      }
      invalidate();
    },
  });

  const openCount = (c: CycleCount) => {
    setActiveCountId(c._id);
    if (c.lines) setCountLines(c.lines.map((l) => ({ ...l })));
  };

  useEffect(() => {
    if (!isOpsSection || !typeDefaultWh) return;
    const current = allWarehouses.find((w) => w._id === selectedWh);
    if (!selectedWh || current?.type !== opsInvType) setSelectedWh(typeDefaultWh._id);
  }, [section, opsInvType, typeDefaultWh?._id, allWarehouses.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setOpMaterialId('');
    setOpSkuId('');
    setDispatchSkuId('');
    setTransferBinId('');
    setTransferFromBinId('');
    setPutAwayQty('');
  }, [opsInvType]);

  useEffect(() => {
    if (!activeCount?.lines) return;
    setCountLines(activeCount.lines.map((l) => ({
      ...l,
      countedQty: l.countedQty ?? l.systemQty ?? 0,
      variance: (l.countedQty ?? l.systemQty ?? 0) - (l.systemQty ?? 0),
    })));
  }, [activeCount]);

  const updateCountLine = (idx: number, countedQty: number) => {
    setCountLines((lines) => lines.map((l, i) => (i !== idx ? l : { ...l, countedQty, variance: countedQty - (l.systemQty ?? 0) })));
  };

  const ask = async (title: string, message: string, confirmLabel: string, fn: () => void, danger = false) => {
    if (await confirm({ title, message, confirmLabel, tone: danger ? 'danger' : 'primary' })) fn();
  };

  const pickQtyNum = Math.max(1, Number(opQty) || 1);
  const putAwayQtyNum = putAwayQty ? Math.max(1, Number(putAwayQty) || 0) : unallocTransferable;
  const transferQtyNum = transferQty ? Math.max(1, Number(transferQty) || 0) : 0;
  const transferSourceRow = isFgOps ? selectedFgBalance : (transferFromBinId ? binBalanceRow(matBalanceRows, transferFromBinId) : unallocRow);
  const transferSourceAvail = transferableQty(transferSourceRow);
  const transferBlocked = !transferBinId || !itemSelected || transferFromBinId === transferBinId
    || (isFgOps && fgBinId && transferBinId === fgBinId)
    || transferSourceAvail <= 0
    || (transferQtyNum > 0 && transferQtyNum > transferSourceAvail);
  const transferQtyError = transferQtyNum > 0 && transferQtyNum > transferSourceAvail ? `Only ${transferSourceAvail} available at the source.` : '';

  /* ── shared controls ── */
  const warehousePicker = (
    <Field label="Warehouse" className="min-w-[200px]">
      <ErpSelect value={whId} onChange={(e) => setSelectedWh(e.target.value)} disabled={pickerWarehouses.length === 0}>
        {pickerWarehouses.length === 0 && <option value="">No warehouse of this type</option>}
        {pickerWarehouses.map((w) => <option key={w._id} value={w._id}>{w.warehouseCode} · {warehouseTypeLabel(w.type)}</option>)}
      </ErpSelect>
    </Field>
  );

  const itemPicker = isFgOps ? (
    <Field label="SKU" className="min-w-[240px] flex-1">
      <ErpSearchSelect
        value={opSkuId || dispatchSkuId}
        onChange={(v) => { setOpSkuId(v); setDispatchSkuId(v); }}
        placeholder="Search SKU…"
        allowClear
        options={skus.map((s) => ({ value: s._id, label: `${s.skuCode}${s.name ? ` — ${s.name}` : ''}` }))}
      />
    </Field>
  ) : (
    <Field label="Material" className="min-w-[240px] flex-1">
      <ErpSearchSelect
        value={opMaterialId}
        onChange={(v) => setOpMaterialId(v)}
        placeholder="Search material…"
        allowClear
        options={materials.map((m) => ({ value: m._id, label: `${m.materialCode} — ${m.name}` }))}
      />
    </Field>
  );

  const stockSummary = itemSelected ? (
    <div className="flex flex-wrap gap-6 border-t border-[var(--erp-border)] pt-3">
      {isFgOps ? (
        <>
          <Metric label="On hand" value={fgOnHand.toLocaleString()} tone={fgOnHand <= 0 ? 'warn' : undefined} />
          <Metric label="Current bin" value={fgBinId ? binLabel(bins.find((b) => b._id === fgBinId)) : 'Not in a bin'} />
          <div className="min-w-[120px]">
            <p className="text-xs text-erp-text-muted">Status</p>
            <div className="mt-1">{fgStatus ? <StatusBadge status={fgStatus} label={statusLabel(fgStatus)} /> : <span className="text-erp-text-muted">—</span>}</div>
          </div>
        </>
      ) : (
        <>
          <Metric label="On the dock (free)" value={unallocTransferable.toLocaleString()} tone={section === 'put-away' && unallocTransferable <= 0 ? 'warn' : undefined} />
          {(unallocRow?.reserved ?? 0) > 0 && <Metric label="Reserved on dock" value={unallocRow?.reserved} />}
          {matAvailability && <Metric label="Available in factory" value={(matAvailability.available ?? 0).toLocaleString()} />}
          {matAvailability && <Metric label="Bin locations" value={matAvailability.locations?.length ?? 0} />}
        </>
      )}
    </div>
  ) : null;

  const renderBinsTable = (action?: 'put-away' | 'pick') => {
    // Put-away qty is the same for every bin (shown above), so only picking shows a per-bin column.
    const showQty = itemSelected && action === 'pick';
    const cols = showQty ? 5 : 4;
    return (
      <Section
        title={action === 'put-away' ? 'Choose a bin' : action === 'pick' ? 'Pick from a bin' : 'Bins'}
        description={action === 'put-away'
          ? (isFgOps ? 'Stages the finished goods into the bin you choose.' : 'Moves dock stock into the bin. Reserved stock cannot be put away.')
          : action === 'pick' ? 'Takes unreserved stock out of the bin.' : undefined}
        flush
      >
        <ErpDataTable className="min-w-[560px]">
          <thead>
            <tr>
              <th>Bin</th>
              <th>Barcode</th>
              {showQty && <th className="erp-num">In bin</th>}
              <th>Status</th>
              <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {opsBinsLoading ? <TableSkeleton asRows rows={5} columns={cols} /> : bins.length === 0 ? (
              <EmptyRow colSpan={cols} title="No bins in this warehouse" icon={Boxes}>
                Create zones and bins under <Link to="/warehouse/warehouses" className="font-medium text-[var(--erp-accent)]">Sites & layout</Link>.
              </EmptyRow>
            ) : bins.map((b: StorageBin) => {
              const binRow = binBalanceMap.get(b._id);
              const binAvail = transferableQty(binRow);
              const putQty = isFgOps ? (putAwayQty ? putAwayQtyNum : Math.max(1, fgOnHand)) : (putAwayQty ? putAwayQtyNum : unallocTransferable);
              const binActive = b.status === 'ACTIVE';
              const canPutAway = isFgOps
                ? (binActive && fgOnHand > 0 && putQty > 0 && putQty <= fgOnHand)
                : (binActive && unallocTransferable > 0 && putQty > 0 && putQty <= unallocTransferable);
              const canPick = isFgOps ? (binActive && fgBinId === b._id && binAvail >= pickQtyNum) : (binActive && binAvail >= pickQtyNum);
              return (
                <tr key={b._id}>
                  <td className="erp-cell-primary font-mono">{binLabel(b)}</td>
                  <td className="text-erp-text-muted">{b.barcode || '—'}</td>
                  {showQty && (
                    <td className="erp-num">
                      {binAvail > 0 ? binAvail : '—'}
                    </td>
                  )}
                  <td><StatusBadge status={b.status} /></td>
                  <td className="erp-cell-actions">
                    <div className="flex justify-end">
                      {action === 'put-away' && canUpdate && itemSelected && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canPutAway || mut.isPending}
                          title={!binActive ? 'Bin is not active' : undefined}
                          loading={mut.isPending && mut.variables?.type === 'putAway' && (mut.variables.payload as { binId?: string } | undefined)?.binId === b._id}
                          onClick={() => mut.mutate({ type: 'putAway', payload: { binId: b._id, quantity: putQty } })}
                        >
                          Put away {putQty > 0 ? putQty : ''}
                        </Button>
                      )}
                      {action === 'pick' && canUpdate && itemSelected && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canPick || mut.isPending}
                          title={!binActive ? 'Bin is not active' : undefined}
                          onClick={() => ask(
                            section === 'dispatch' ? `Dispatch ${pickQtyNum} from ${binLabel(b)}?` : `Pick ${pickQtyNum} from ${binLabel(b)}?`,
                            section === 'dispatch' ? 'Stock leaves the warehouse and on-hand goes down.' : 'Unreserved stock in this bin goes down.',
                            section === 'dispatch' ? 'Dispatch' : 'Pick',
                            () => mut.mutate({ type: 'pick', payload: { binId: b._id } }),
                          )}
                        >
                          {section === 'dispatch' ? 'Dispatch' : 'Pick'} {pickQtyNum}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ErpDataTable>
      </Section>
    );
  };

  const stageBinId = dispatchBinId || fgBinId;
  const stageBinLabel = binLabel(fgBins.find((b) => b._id === stageBinId));

  return (
    <>
      <PageHeader
        title={meta.title}
        description={meta.description}
        secondaryActions={(
          <>
            <IconButton aria-label="Refresh" loading={isFetching} onClick={() => { refetch(); invalidate(); }}><RefreshCw size={16} /></IconButton>
            <Button variant="secondary" icon={<Package size={16} />} onClick={() => navigate('/inventory')}>Inventory</Button>
          </>
        )}
        primaryAction={section === 'cycle-counts' && canCreate && whId ? (
          <Button icon={<Plus size={16} />} loading={mut.isPending && mut.variables?.type === 'createCount'} onClick={() => mut.mutate({ type: 'createCount' })}>New count</Button>
        ) : undefined}
      />

      {!['stock-locator', 'put-away', 'picking', 'transfer'].includes(section) && (
        <KpiGrid cols={4} className="mb-4">
          <StatTile icon={Boxes} label="Active bins" value={stats?.binsActive ?? '—'} hint={`${stats?.warehousesTotal ?? 0} warehouses`} onClick={() => navigate('/warehouse/warehouses')} />
          <StatTile icon={PackageOpen} label="Stock rows in bins" value={stats?.rmInBins ?? '—'} onClick={() => navigate('/warehouse/stock-locator')} />
          <StatTile
            icon={Truck} label="Ready to ship" value={stats?.dispatchReady ?? '—'}
            onClick={() => navigate('/warehouse/operations/dispatch')} active={section === 'dispatch'}
          />
          <StatTile
            icon={ClipboardCheck} label="Open counts" value={stats?.openCycleCounts ?? '—'}
            onClick={() => navigate('/warehouse/cycle-counts')} active={section === 'cycle-counts'}
          />
        </KpiGrid>
      )}

      {section === 'stock-locator' && <StockLocatorSection />}

      {(section === 'put-away' || section === 'picking') && (
        <div className="space-y-4">
          <Section>
            {section === 'put-away' && (
              <StepFlow
                size="sm"
                className="mb-4"
                current="putaway"
                steps={isFgOps
                  ? [{ id: 'qc', label: 'Final QC' }, { id: 'putaway', label: 'Put away' }, { id: 'bin', label: 'In bin' }]
                  : [{ id: 'dock', label: 'On dock', description: 'After incoming QC' }, { id: 'putaway', label: 'Put away' }, { id: 'bin', label: 'In bin', description: 'Ready to pick or issue' }]}
              />
            )}
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Stock type"><TypeToggle value={opsInvType} onChange={setOpsInvType} /></Field>
              {warehousePicker}
              {itemPicker}
              {section === 'put-away' ? (
                <Field label={isFgOps ? 'Quantity' : 'Quantity (blank = all)'} className="w-44">
                  <ErpInput
                    type="number" inputMode="decimal" min={1}
                    max={(isFgOps ? fgOnHand : unallocTransferable) || undefined}
                    value={putAwayQty}
                    onChange={(e) => setPutAwayQty(e.target.value)}
                    placeholder={isFgOps ? (fgOnHand > 0 ? String(fgOnHand) : 'Qty') : (unallocTransferable > 0 ? String(unallocTransferable) : 'All')}
                  />
                </Field>
              ) : (
                <Field label="Pick quantity" className="w-36">
                  <ErpInput type="number" inputMode="decimal" min={1} value={opQty} onChange={(e) => setOpQty(e.target.value)} />
                </Field>
              )}
            </div>
            {stockSummary && <div className="mt-4">{stockSummary}</div>}
          </Section>

          {!itemSelected && (
            <InfoBanner inset={false} tone="info">
              {isFgOps
                ? 'Choose a SKU to see its stock and the bins you can use.'
                : section === 'put-away'
                  ? 'Choose a material, or use "Put away" on a dock row in Inventory.'
                  : 'Choose a material, or use "Pick" from Find stock.'}
            </InfoBanner>
          )}
          {section === 'put-away' && itemSelected && (isFgOps ? fgOnHand <= 0 : unallocTransferable <= 0) && (() => {
            if (isFgOps) {
              return <InfoBanner inset={false} tone="warn">No finished-goods stock for this SKU yet. Complete final QC in Quality first.</InfoBanner>;
            }
            const next = dockQueue.filter((r) => materialRowId(r.materialId) !== opMaterialId).slice(0, 6);
            if (!next.length) {
              return (
                <InfoBanner inset={false} tone="success" title="The dock is clear">
                  Nothing else is waiting to be put away.
                </InfoBanner>
              );
            }
            return (
              <InfoBanner inset={false} tone="info" title="Nothing left on the dock for this material — next up:">
                <div className="mt-2 flex flex-wrap gap-2">
                  {next.map((r) => (
                    <Button key={r._id} size="sm" variant="secondary" onClick={() => { setOpMaterialId(materialRowId(r.materialId)); setPutAwayQty(''); }}>
                      {materialLabel(r.materialId)} · {transferableQty(r).toLocaleString()}
                    </Button>
                  ))}
                </div>
              </InfoBanner>
            );
          })()}
          {section === 'picking' && itemSelected && isRmOps && (matAvailability?.available ?? 0) <= 0 && (
            <InfoBanner inset={false} tone="warn">No available stock in bins for this material. Put away from the dock first, or release reservations.</InfoBanner>
          )}
          {section === 'picking' && itemSelected && isFgOps && (!fgBinId || fgOnHand <= 0) && (
            <InfoBanner inset={false} tone="warn">No finished goods in a bin for this SKU. Put them away first.</InfoBanner>
          )}
          {renderBinsTable(section === 'put-away' ? 'put-away' : 'pick')}
        </div>
      )}

      {section === 'transfer' && (
        <div className="space-y-4">
          <Section title="Move stock" description={isFgOps ? 'Finished goods move their full on-hand quantity to the new bin.' : 'Only unreserved stock can be moved.'}>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Stock type"><TypeToggle value={opsInvType} onChange={setOpsInvType} /></Field>
              {warehousePicker}
              {itemPicker}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr_140px] sm:items-end">
              <Field label="From">
                <ErpSelect value={transferFromBinId || (isFgOps ? fgBinId : '')} onChange={(e) => setTransferFromBinId(e.target.value)} disabled={!itemSelected}>
                  {!isFgOps && <option value="">Unallocated dock ({unallocTransferable} free)</option>}
                  {isFgOps && !fgBinId && <option value="">Not in a bin</option>}
                  {bins.filter((b) => b.status === 'ACTIVE').map((b) => {
                    const avail = isFgOps ? (fgBinId === b._id ? transferableQty(selectedFgBalance) : 0) : transferableQty(binBalanceMap.get(b._id));
                    return <option key={b._id} value={b._id} disabled={avail <= 0}>{binLabel(b)} ({avail} free)</option>;
                  })}
                </ErpSelect>
              </Field>
              <ArrowRightLeft className="mb-2.5 hidden h-4 w-4 text-erp-text-muted sm:block" aria-hidden="true" />
              <Field label="To bin" error={transferFromBinId && transferFromBinId === transferBinId ? 'Choose a different bin from the source.' : undefined}>
                <ErpSelect value={transferBinId} onChange={(e) => setTransferBinId(e.target.value)} disabled={!itemSelected}>
                  <option value="">Select bin…</option>
                  {bins.filter((b) => b._id !== (transferFromBinId || fgBinId) && b.status === 'ACTIVE').map((b) => (
                    <option key={b._id} value={b._id}>{binLabel(b)}</option>
                  ))}
                </ErpSelect>
              </Field>
              <Field label="Quantity" error={transferQtyError} hint={!transferQtyError && transferSourceAvail > 0 ? `Blank = all ${transferSourceAvail}` : undefined}>
                <ErpInput type="number" inputMode="decimal" min={1} max={transferSourceAvail || undefined} value={transferQty} onChange={(e) => setTransferQty(e.target.value)} placeholder={transferSourceAvail > 0 ? String(transferSourceAvail) : 'Max'} disabled={!itemSelected} />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                icon={<ArrowRightLeft size={16} />}
                disabled={!!transferBlocked || !canUpdate}
                loading={mut.isPending && mut.variables?.type === 'transfer'}
                onClick={() => {
                  const qtyLabel = transferQty || String(transferSourceAvail);
                  const fromId = transferFromBinId || (isFgOps ? fgBinId : '');
                  const fromLabel = fromId ? binLabel(bins.find((b) => b._id === fromId)) : 'the unallocated dock';
                  const toLabel = binLabel(bins.find((b) => b._id === transferBinId));
                  ask(`Move ${qtyLabel} to ${toLabel}?`, `Stock moves from ${fromLabel} to ${toLabel}.`, 'Transfer', () => mut.mutate({ type: 'transfer' }));
                }}
              >
                Transfer
              </Button>
            </div>
          </Section>
          {!itemSelected && <InfoBanner inset={false} tone="info">{isFgOps ? 'Choose a SKU to move between bins.' : 'Choose a material to move between the dock and bins.'}</InfoBanner>}
          {renderBinsTable()}
        </div>
      )}

      {section === 'dispatch' && (
        <div className="space-y-4">
          <Section>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Stock type"><TypeToggle value={opsInvType} onChange={setOpsInvType} /></Field>
              {warehousePicker}
            </div>
          </Section>

          {isFgOps ? (
            <>
              {!fgWarehouse && (
                <InfoBanner inset={false} tone="warn">No finished-goods warehouse yet. Create one under Sites & layout, then add bins.</InfoBanner>
              )}
              <Section flush title="Ready to ship" description="Finished goods marked ready. Dispatching reduces on-hand stock.">
                <ErpDataTable className="min-w-[520px]">
                  <thead><tr><th>SKU</th><th>Bin</th><th className="erp-num">Quantity</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {dispatchReadyQ.isLoading ? <TableSkeleton asRows rows={3} columns={4} /> : dispatchReadyQ.isError ? <QueryErrorRow colSpan={4} error={dispatchReadyQ.error} onRetry={() => dispatchReadyQ.refetch()} /> : dispatchReady.length === 0 ? (
                      <EmptyRow colSpan={4} title="Nothing ready to ship" icon={Truck}>Stage stock below and mark it ready.</EmptyRow>
                    ) : dispatchReady.map((row: DispatchReadyBalance) => (
                      <tr key={row._id}>
                        <td className="erp-cell-primary font-mono">{dispatchRowSku(row)}</td>
                        <td className="font-mono">{typeof row.storageBinId === 'object' ? binLabel(row.storageBinId) : '—'}</td>
                        <td className="erp-num">{dispatchRowQty(row).toLocaleString()}</td>
                        <td className="erp-cell-actions">
                          <div className="flex justify-end">
                            {canUpdate && (
                              <Button
                                size="sm"
                                icon={<Truck size={14} />}
                                disabled={mut.isPending}
                                onClick={() => ask(
                                  `Dispatch ${dispatchRowQty(row)} units of ${dispatchRowSku(row)}?`,
                                  'On-hand stock goes down by this quantity.',
                                  'Dispatch',
                                  () => mut.mutate({
                                    type: 'dispatch',
                                    payload: {
                                      skuId: row.skuId ? (typeof row.skuId === 'string' ? row.skuId : row.skuId._id) : '',
                                      storageBinId: getDispatchBinId(row),
                                      quantity: dispatchRowQty(row),
                                    },
                                  }),
                                )}
                              >
                                Dispatch
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ErpDataTable>
              </Section>

              <Section title="Stage and mark ready" description="Finished goods come from final QC. Stage them in a bin, then mark them ready to ship.">
                <StepFlow
                  size="sm"
                  className="mb-4"
                  current={fgStatus === 'READY_FOR_DISPATCH' ? 'ready' : fgBinId ? 'ready' : 'stage'}
                  steps={[{ id: 'stage', label: 'Stage in bin' }, { id: 'ready', label: 'Mark ready' }, { id: 'ship', label: 'Dispatch' }]}
                />
                <div className="flex flex-wrap items-end gap-4">
                  {itemPicker}
                  <Field label="Bin" className="min-w-[160px]">
                    <ErpSelect value={stageBinId} onChange={(e) => setDispatchBinId(e.target.value)}>
                      <option value="">Select bin…</option>
                      {fgBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
                    </ErpSelect>
                  </Field>
                  <Field label="Quantity" className="w-32">
                    <ErpInput type="number" inputMode="numeric" min={1} max={fgOnHand || undefined} value={dispatchQty} onChange={(e) => setDispatchQty(e.target.value)} />
                  </Field>
                </div>
                {stockSummary && <div className="mt-4">{stockSummary}</div>}
                {skuId && fgOnHand <= 0 && (
                  <InfoBanner inset={false} tone="warn" className="mt-3">No stock for this SKU. Complete final QC in Quality first.</InfoBanner>
                )}
                {skuId && stageBinId && canUpdate && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                      variant="secondary"
                      disabled={fgOnHand < (Number(dispatchQty) || 1) || mut.isPending}
                      onClick={() => {
                        if (!dispatchBinId && fgBinId) setDispatchBinId(fgBinId);
                        ask(`Stage ${dispatchQty || 1} in ${stageBinLabel}?`, 'The units are assigned to this bin for dispatch.', 'Stage', () => mut.mutate({ type: 'fgPutAway' }));
                      }}
                    >
                      Stage in bin
                    </Button>
                    <Button
                      icon={<ClipboardList size={16} />}
                      disabled={fgOnHand <= 0 || mut.isPending}
                      onClick={() => ask(`Mark ready to ship from ${stageBinLabel}?`, 'The stock appears in the Ready to ship list above.', 'Mark ready', () => mut.mutate({ type: 'markReady' }))}
                    >
                      Mark ready to ship
                    </Button>
                  </div>
                )}
              </Section>
            </>
          ) : (
            <>
              <Section title="Raw material outbound" description="Issue material from bins for external dispatch or consumption.">
                <div className="flex flex-wrap items-end gap-4">
                  {itemPicker}
                  <Field label="Quantity" className="w-32">
                    <ErpInput type="number" inputMode="decimal" min={1} value={opQty} onChange={(e) => setOpQty(e.target.value)} />
                  </Field>
                </div>
                {stockSummary && <div className="mt-4">{stockSummary}</div>}
              </Section>
              {!matId && <InfoBanner inset={false} tone="info">Choose a material to dispatch from bins.</InfoBanner>}
              {renderBinsTable('pick')}
            </>
          )}
        </div>
      )}

      {section === 'cycle-counts' && (
        <div className="space-y-4">
          <Section>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Stock type"><TypeToggle value={opsInvType} onChange={setOpsInvType} /></Field>
              {warehousePicker}
            </div>
          </Section>
          <Section flush title="Counts">
            <ErpDataTable className="min-w-[520px]">
              <thead><tr><th>Count</th><th>Warehouse</th><th>Status</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {cycleCountsQ.isLoading ? <TableSkeleton asRows rows={4} columns={4} /> : cycleCountsQ.isError ? <QueryErrorRow colSpan={4} error={cycleCountsQ.error} onRetry={() => cycleCountsQ.refetch()} /> : cycleCounts.length === 0 ? (
                  <EmptyRow
                    colSpan={4}
                    title="No cycle counts yet"
                    icon={ClipboardCheck}
                    action={canCreate && whId ? <Button size="sm" icon={<Plus size={14} />} onClick={() => mut.mutate({ type: 'createCount' })}>New count</Button> : undefined}
                  >
                    Count a warehouse regularly to keep system stock accurate.
                  </EmptyRow>
                ) : cycleCounts.map((c: CycleCount) => (
                  <tr key={c._id} className={c.status !== 'COMPLETED' ? `erp-row-clickable${activeCountId === c._id ? ' erp-row-selected' : ''}` : ''} onClick={c.status !== 'COMPLETED' ? () => openCount(c) : undefined}>
                    <td className="erp-cell-primary font-mono">{c.countNumber || c._id.slice(-8)}</td>
                    <td>{warehouseLabel(c.warehouseId ?? '')}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="erp-cell-actions">
                      <div className="flex justify-end gap-1">
                        {c.status === 'DRAFT' && canUpdate && (
                          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); mut.mutate({ type: 'startCount', payload: { id: c._id } }); }}>Start</Button>
                        )}
                        {c.status !== 'COMPLETED' && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); openCount(c); }}>Count</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </Section>
        </div>
      )}

      <Drawer
        open={!!activeCountId}
        onClose={() => { setActiveCountId(null); setCountLines([]); }}
        size="lg"
        closeOnOverlayClick={false}
        title={`Count ${cycleCounts.find((c) => c._id === activeCountId)?.countNumber ?? ''}`}
        description="Enter what you physically counted. Differences are highlighted."
        footer={(
          <>
            {countLines.length > 0 && (
              <label className="mr-auto flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={applyAdjustments} onChange={(e) => setApplyAdjustments(e.target.checked)} />
                Post differences to inventory
              </label>
            )}
            <Button variant="secondary" onClick={() => { setActiveCountId(null); setCountLines([]); }}>Cancel</Button>
            {canUpdate && countLines.length > 0 && (
              <Button
                loading={mut.isPending && mut.variables?.type === 'completeCount'}
                onClick={() => ask(
                  'Complete this count?',
                  applyAdjustments
                    ? `${countLines.filter((l) => (l.countedQty ?? 0) !== (l.systemQty ?? 0)).length} line(s) with differences will be adjusted in inventory.`
                    : 'Counts are saved without changing inventory.',
                  'Complete count',
                  () => mut.mutate({ type: 'completeCount', payload: { id: activeCountId, lines: countLines, applyAdjustments } }),
                )}
              >
                Complete count
              </Button>
            )}
          </>
        )}
      >
        {activeCountLoading && !countLines.length ? (
          <TableSkeleton rows={4} columns={4} />
        ) : countLines.length === 0 ? (
          <InfoBanner inset={false} tone="muted">No stock lines in this count yet. Put stock away into bins first, then start a new count.</InfoBanner>
        ) : (
          <ErpDataTable>
            <thead><tr><th>Item</th><th className="erp-num">System</th><th className="erp-num w-36">Counted</th><th className="erp-num">Difference</th></tr></thead>
            <tbody>
              {countLines.map((l, idx) => {
                const diff = (l.countedQty ?? 0) - (l.systemQty ?? 0);
                return (
                  <tr key={idx}>
                    <td>{cycleLineMaterial(l)}</td>
                    <td className="erp-num">{l.systemQty}</td>
                    <td className="erp-num">
                      <ErpInput
                        type="number" inputMode="decimal" min={0} className="text-right" aria-label={`Counted ${cycleLineMaterial(l)}`}
                        value={l.countedQty}
                        onChange={(e) => updateCountLine(idx, Number(e.target.value) || 0)}
                      />
                    </td>
                    <td className={`erp-num font-medium ${varianceTone(diff)}`}>
                      {diff > 0 ? `+${diff}` : diff}
                      {diff !== 0 && <Badge tone={diff > 0 ? 'success' : 'danger'} dot={false} className="ml-2">{diff > 0 ? 'Over' : 'Short'}</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
        )}
      </Drawer>
    </>
  );
}
