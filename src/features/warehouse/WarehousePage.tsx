import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft, ArrowRight, Boxes, ClipboardCheck, Package, RefreshCw, Truck, Warehouse as WhIcon,
} from 'lucide-react';
import { warehouseApi } from '../../services/operations';
import { inventoryApi, skuApi } from '../../services/manufacturing';
import type {
  CycleCount, CycleCountLine, DispatchReadyBalance, InventoryBalance, Material, StorageBin,
} from '../../types/api';
import {
  ErpPageHeader, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  binBalanceRow, binLabel, cycleLineMaterial, dispatchBinId as getDispatchBinId, dispatchRowQty,
  dispatchRowSku, FG_PUT_AWAY_FLOW, indexBalancesByBin, RM_PUT_AWAY_FLOW,
  statusLabel, stockOpSuccessMessage, transferableQty, unallocatedBalance, varianceClass,
  warehouseLabel, warehouseTypeLabel,
} from './warehouseUtils';
import { StockLocatorSection } from './StockLocatorSection';
import { SitesLayoutSection } from './SitesLayoutSection';

type WarehouseSection = 'warehouses' | 'stock-locator' | 'put-away' | 'picking' | 'transfer' | 'dispatch' | 'cycle-counts';
type OpsInvType = 'RAW_MATERIAL' | 'FINISHED_GOODS';

const OPS_SECTIONS: WarehouseSection[] = ['put-away', 'picking', 'transfer', 'dispatch', 'cycle-counts'];
const BIN_OPS: WarehouseSection[] = ['put-away', 'picking', 'transfer'];

const sectionMeta: Record<WarehouseSection, { title: string; subtitle: string }> = {
  warehouses: { title: 'Sites & layout', subtitle: '' },
  'stock-locator': { title: 'Find stock', subtitle: 'Locate raw materials and finished goods across dock, zones, racks, shelves, and bins' },
  'put-away': { title: 'Put away', subtitle: 'Move received stock from dock/QC into storage bins' },
  picking: { title: 'Picking', subtitle: 'Issue stock from bins for production, sampling, or outbound' },
  transfer: { title: 'Bin transfer', subtitle: 'Move stock between bins or from dock' },
  dispatch: { title: 'Dispatch', subtitle: 'Stage, mark ready to ship, and outbound dispatch' },
  'cycle-counts': { title: 'Cycle counts', subtitle: 'Physical counts and variance adjustment' },
};

const PAGE_SIZE = 15;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const btnSm = '!px-2 !py-1 text-[10px]';

export function WarehousePage({ section = 'warehouses' }: { section?: WarehouseSection }) {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('warehouse.create');
  const canUpdate = permissions.includes('*') || permissions.includes('warehouse.update');
  const canConfigure = permissions.includes('*') || permissions.includes('warehouse.configure');

  const meta = sectionMeta[section];
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [binPage, setBinPage] = useState(1);
  const [selectedWh, setSelectedWh] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ label: string; message: string; fn: () => void } | null>(null);

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

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['warehouse-stats'] });
    qc.invalidateQueries({ queryKey: ['warehouses'] });
    qc.invalidateQueries({ queryKey: ['warehouses-all'] });
    qc.invalidateQueries({ queryKey: ['bins'] });
    qc.invalidateQueries({ queryKey: ['bins-ops'] });
    qc.invalidateQueries({ queryKey: ['bin-contents'] });
    qc.invalidateQueries({ queryKey: ['dispatch-ready'] });
    qc.invalidateQueries({ queryKey: ['cycle-counts'] });
    qc.invalidateQueries({ queryKey: ['warehouse-layout'] });
    qc.invalidateQueries({ queryKey: ['zones'] });
    qc.invalidateQueries({ queryKey: ['racks'] });
    qc.invalidateQueries({ queryKey: ['shelves'] });
    qc.invalidateQueries({ queryKey: ['inventory-availability'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances-mat'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances-page'] });
    qc.invalidateQueries({ queryKey: ['inventory-stats'] });
    qc.invalidateQueries({ queryKey: ['fg-balances-dispatch'] });
    qc.invalidateQueries({ queryKey: ['fg-balances-ops'] });
  };

  const promptConfirm = (label: string, message: string, fn: () => void) => {
    setConfirmAction({ label, message, fn });
  };

  const { data: stats } = useQuery({ queryKey: ['warehouse-stats'], queryFn: () => warehouseApi.stats() });

  const { data: allWarehouses = [], isFetching, refetch } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehouseApi.list({ limit: 100 }),
  });

  const warehouses = allWarehouses;

  const rmWarehouse = useMemo(
    () => allWarehouses.find((w) => w.type === 'RAW_MATERIAL' && w.isDefault)
      || allWarehouses.find((w) => w.type === 'RAW_MATERIAL'),
    [allWarehouses],
  );
  const fgWarehouse = useMemo(
    () => allWarehouses.find((w) => w.type === 'FINISHED_GOODS' && w.isDefault)
      || allWarehouses.find((w) => w.type === 'FINISHED_GOODS'),
    [allWarehouses],
  );
  const typeDefaultWh = isFgOps ? fgWarehouse : rmWarehouse;

  const whId = isOpsSection
    ? (selectedWh || typeDefaultWh?._id || '')
    : (selectedWh || allWarehouses[0]?._id || '');
  const pickerWarehouses = isOpsSection
    ? allWarehouses.filter((w) => w.type === opsInvType)
    : allWarehouses;
  const selectedWarehouse = allWarehouses.find((w) => w._id === whId)
    || warehouses.find((w) => w._id === whId);

  const { data: opsBins = [], isLoading: opsBinsLoading } = useQuery({
    queryKey: ['bins-ops', whId],
    queryFn: () => warehouseApi.listBins(whId, { limit: 200 }),
    enabled: !!whId && (isBinOps || section === 'dispatch' || section === 'cycle-counts'),
  });

  const bins = opsBins;
  const binsLoadingEffective = opsBinsLoading;
  const fgBins = isFgOps ? bins : [];

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
        (m) => m.materialCode?.toLowerCase() === paramCode.toLowerCase()
          || m.name?.toLowerCase() === paramCode.toLowerCase(),
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

  const { data: skus = [] } = useQuery({
    queryKey: ['skus-wh'],
    queryFn: () => skuApi.listPage({ limit: 200 }).then((r) => r.items),
    enabled: isFgOps && isOpsSection,
  });

  const { data: dispatchReady = [] } = useQuery({
    queryKey: ['dispatch-ready'],
    queryFn: () => warehouseApi.listDispatchReady(),
    enabled: section === 'dispatch' && isFgOps,
  });

  const { data: cycleCounts = [] } = useQuery({
    queryKey: ['cycle-counts'],
    queryFn: () => warehouseApi.listCycleCounts(),
    enabled: section === 'cycle-counts',
  });

  const { data: activeCount } = useQuery({
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
      const { items } = await inventoryApi.listBalancesPage({
        search: mat?.materialCode,
        limit: 50,
      });
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

  type FgBalanceRow = InventoryBalance & { skuId?: string | { _id?: string }; dispatchStatus?: string };
  const selectedFgBalance = (fgBalances as FgBalanceRow[]).find((b) => {
    const sid = typeof b.skuId === 'object' ? b.skuId?._id : b.skuId;
    return sid === skuId;
  });
  const fgOnHand = selectedFgBalance?.onHand ?? 0;
  const fgStatus = selectedFgBalance?.dispatchStatus || '—';
  const fgBinId = selectedFgBalance?.storageBinId
    ? (typeof selectedFgBalance.storageBinId === 'string'
      ? selectedFgBalance.storageBinId
      : selectedFgBalance.storageBinId._id)
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
              quantity: payload.quantity != null
                ? Number(payload.quantity)
                : (putAwayQty ? Number(putAwayQty) : Math.max(1, fgOnHand)),
            });
          }
          return warehouseApi.putAway({
            materialId: (payload.materialId as string) || matId,
            binId: payload.binId as string,
            quantity: payload.quantity != null
              ? (Number(payload.quantity) || undefined)
              : (putAwayQty ? Number(putAwayQty) : undefined),
          });
        case 'pick':
          return warehouseApi.pick({
            ...(isFgOps
              ? { skuId: activeSku }
              : { materialId: (payload.materialId as string) || matId }),
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
      setError('');
      if (vars.type === 'completeCount') {
        setActiveCountId(null);
        setCountLines([]);
        showSuccess('Cycle count completed — inventory adjusted');
      } else if (['putAway', 'pick', 'transfer', 'fgPutAway', 'markReady', 'dispatch'].includes(vars.type)) {
        showSuccess(stockOpSuccessMessage(vars.type, data));
      } else {
        showSuccess('Saved');
      }
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const openCount = (c: CycleCount) => {
    setActiveCountId(c._id);
    if (c.lines) setCountLines(c.lines.map((l) => ({ ...l })));
  };

  useEffect(() => {
    if (!isOpsSection || !typeDefaultWh) return;
    const current = allWarehouses.find((w) => w._id === selectedWh);
    if (!selectedWh || current?.type !== opsInvType) {
      setSelectedWh(typeDefaultWh._id);
      setBinPage(1);
    }
  }, [section, opsInvType, typeDefaultWh?._id, allWarehouses.length]);

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
    setCountLines((lines) => lines.map((l, i) => {
      if (i !== idx) return l;
      return { ...l, countedQty, variance: countedQty - (l.systemQty ?? 0) };
    }));
  };

  const KpiStrip = stats ? (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <ErpCard className="p-3">
        <div className="flex items-center gap-2 text-erp-text-muted"><WhIcon className="h-4 w-4" /><span className="text-[10px] uppercase">Warehouses</span></div>
        <p className="mt-1 text-xl font-semibold">{stats.warehousesTotal}</p>
      </ErpCard>
      <ErpCard className="p-3">
        <div className="flex items-center gap-2 text-erp-text-muted"><Boxes className="h-4 w-4" /><span className="text-[10px] uppercase">Bins active</span></div>
        <p className="mt-1 text-xl font-semibold">{stats.binsActive}</p>
      </ErpCard>
      <ErpCard className="p-3">
        <div className="flex items-center gap-2 text-erp-text-muted"><Package className="h-4 w-4" /><span className="text-[10px] uppercase">In bins</span></div>
        <p className="mt-1 text-xl font-semibold">{stats.rmInBins}</p>
      </ErpCard>
      <ErpCard className="p-3">
        <div className="flex items-center gap-2 text-erp-text-muted"><Truck className="h-4 w-4" /><span className="text-[10px] uppercase">Ready to ship</span></div>
        <p className="mt-1 text-xl font-semibold">{stats.dispatchReady}</p>
      </ErpCard>
      <ErpCard className="p-3">
        <div className="flex items-center gap-2 text-erp-text-muted"><ClipboardCheck className="h-4 w-4" /><span className="text-[10px] uppercase">Open counts</span></div>
        <p className="mt-1 text-xl font-semibold">{stats.openCycleCounts}</p>
      </ErpCard>
    </div>
  ) : null;

  const WarehousePicker = (
    <div className="min-w-[180px]">
      <label className={fieldLabel}>Warehouse</label>
      <ErpSelect value={whId} onChange={(e) => { setSelectedWh(e.target.value); setBinPage(1); }} disabled={pickerWarehouses.length === 0}>
        {pickerWarehouses.length === 0 && <option value="">No warehouse of this type</option>}
        {pickerWarehouses.map((w) => (
          <option key={w._id} value={w._id}>{w.warehouseCode} · {warehouseTypeLabel(w.type)}</option>
        ))}
      </ErpSelect>
    </div>
  );

  const InventoryTypeToggle = isOpsSection ? (
    <div className="min-w-[160px]">
      <label className={fieldLabel}>Inventory type</label>
      <ErpSelect
        value={opsInvType}
        onChange={(e) => setOpsInvType(e.target.value as OpsInvType)}
      >
        <option value="RAW_MATERIAL">Raw materials</option>
        <option value="FINISHED_GOODS">Finished goods</option>
      </ErpSelect>
    </div>
  ) : null;

  const pickQtyNum = Math.max(1, Number(opQty) || 1);
  const putAwayQtyNum = putAwayQty ? Math.max(1, Number(putAwayQty) || 0) : unallocTransferable;
  const transferQtyNum = transferQty ? Math.max(1, Number(transferQty) || 0) : 0;
  const transferSourceRow = isFgOps
    ? selectedFgBalance
    : (transferFromBinId ? binBalanceRow(matBalanceRows, transferFromBinId) : unallocRow);
  const transferSourceAvail = transferableQty(transferSourceRow);
  const transferBlocked = !transferBinId || !itemSelected || transferFromBinId === transferBinId
    || (isFgOps && fgBinId && transferBinId === fgBinId)
    || transferSourceAvail <= 0
    || (transferQtyNum > 0 && transferQtyNum > transferSourceAvail);

  const BinsTable = ({ action }: { action?: 'put-away' | 'pick' }) => (
    <ErpCard className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <ErpDataTable className="w-full text-[11px]">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Bin</th>
              <th className="px-3 py-2 text-left">Barcode</th>
              {itemSelected && action && (
                <th className="px-3 py-2 text-right">
                  {action === 'put-away'
                    ? (isFgOps ? 'On hand' : 'Dock qty')
                    : 'Bin avail'}
                </th>
              )}
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {binsLoadingEffective && <tr><td colSpan={itemSelected && action ? 5 : 4} className="px-3 py-6 text-center">Loading…</td></tr>}
            {!binsLoadingEffective && bins.map((b: StorageBin) => {
              const binRow = binBalanceMap.get(b._id);
              const binAvail = transferableQty(binRow);
              const putQty = isFgOps
                ? (putAwayQty ? putAwayQtyNum : Math.max(1, fgOnHand))
                : (putAwayQty ? putAwayQtyNum : unallocTransferable);
              const binActive = b.status === 'ACTIVE';
              const canPutAway = isFgOps
                ? (binActive && fgOnHand > 0 && putQty > 0 && putQty <= fgOnHand)
                : (binActive && unallocTransferable > 0 && putQty > 0 && putQty <= unallocTransferable);
              const canPick = isFgOps
                ? (binActive && fgBinId === b._id && binAvail >= pickQtyNum)
                : (binActive && binAvail >= pickQtyNum);
              return (
                <tr key={b._id} className="border-t border-[var(--erp-border)]">
                  <td className="px-3 py-2 font-mono">{binLabel(b)}</td>
                  <td className="px-3 py-2 text-[10px] text-erp-text-muted">{b.barcode || '—'}</td>
                  {itemSelected && action && (
                    <td className="px-3 py-2 text-right font-mono">
                      {action === 'put-away'
                        ? (isFgOps
                          ? (fgOnHand > 0 ? fgOnHand : '—')
                          : (unallocTransferable > 0 ? `dock ${unallocTransferable}` : '—'))
                        : (binAvail > 0 ? binAvail : '—')}
                    </td>
                  )}
                  <td className="px-3 py-2"><ErpStatusBadge status={b.status} label={statusLabel(b.status)} /></td>
                  <td className="px-3 py-2 text-right">
                    {action === 'put-away' && canUpdate && itemSelected && (
                      <ErpButton
                        className={btnSm}
                        variant="secondary"
                        disabled={!canPutAway || mut.isPending}
                        title={!binActive ? 'Bin is not active' : undefined}
                        onClick={() => promptConfirm(
                          'Put away stock',
                          isFgOps
                            ? `Stage ${putQty} into bin ${binLabel(b)}?`
                            : `Move ${putQty} from unallocated dock → bin ${binLabel(b)}? Dock stock will decrease; bin stock will increase.`,
                          () => mut.mutate({ type: 'putAway', payload: { binId: b._id, quantity: putQty } }),
                        )}
                      >
                        Put away
                      </ErpButton>
                    )}
                    {action === 'pick' && canUpdate && itemSelected && (
                      <ErpButton
                        className={btnSm}
                        disabled={!canPick || mut.isPending}
                        title={!binActive ? 'Bin is not active' : undefined}
                        onClick={() => promptConfirm(
                          section === 'dispatch' ? 'Dispatch stock' : 'Pick stock',
                          section === 'dispatch'
                            ? `Dispatch ${pickQtyNum} from bin ${binLabel(b)}? Stock will decrease.`
                            : `Pick ${pickQtyNum} from bin ${binLabel(b)}? Unreserved bin stock will decrease.`,
                          () => mut.mutate({ type: 'pick', payload: { binId: b._id } }),
                        )}
                      >
                        {section === 'dispatch' ? 'Dispatch' : 'Pick'}
                      </ErpButton>
                    )}
                  </td>
                </tr>
              );
            })}
            {!binsLoadingEffective && bins.length === 0 && (
              <tr>
                <td colSpan={itemSelected && action ? 5 : 4} className="px-3 py-8 text-center text-erp-text-muted">
                  No bins yet — create Zone → Rack → Shelf → Bin under{' '}
                  <Link to="/warehouse/warehouses" className="text-[var(--erp-accent)]">Sites & layout</Link>
                </td>
              </tr>
            )}
          </tbody>
        </ErpDataTable>
      </div>
    </ErpCard>
  );

  const ItemPicker = isFgOps ? (
    <div className="min-w-[200px]">
      <label className={fieldLabel}>SKU</label>
      <ErpSelect
        value={opSkuId || dispatchSkuId}
        onChange={(e) => {
          setOpSkuId(e.target.value);
          setDispatchSkuId(e.target.value);
        }}
      >
        <option value="">Select…</option>
        {skus.map((s) => (
          <option key={s._id} value={s._id}>{s.skuCode}{s.name ? ` — ${s.name}` : ''}</option>
        ))}
      </ErpSelect>
    </div>
  ) : (
    <div className="min-w-[200px]">
      <label className={fieldLabel}>Material</label>
      <ErpSelect value={opMaterialId} onChange={(e) => setOpMaterialId(e.target.value)}>
        <option value="">Select…</option>
        {materials.map((m: Material) => (
          <option key={m._id} value={m._id}>{m.materialCode} — {m.name}</option>
        ))}
      </ErpSelect>
    </div>
  );

  return (
    <div>
      <AlertBanner message={error} onDismiss={() => setError('')} />
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess('')} />}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.label ?? 'Confirm'}
        message={confirmAction?.message ?? 'Continue?'}
        loading={mut.isPending}
        onConfirm={() => { confirmAction?.fn(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      <ErpPageHeader
        title={meta.title}
        subtitle={section === 'put-away' ? (
          <>
            Move QC-received stock into bins ({isFgOps ? 'finished goods' : 'raw materials'}).
            <Link to="/inventory" className="ml-2 text-[var(--erp-accent)]">Inventory →</Link>
            <Link to="/samples" className="ml-2 text-[var(--erp-accent)]">Samples →</Link>
            <Link to="/production/orders" className="ml-2 text-[var(--erp-accent)]">Production →</Link>
          </>
        ) : meta.subtitle}
        actions={(
          <div className="flex gap-2">
            {section !== 'warehouses' && (
              <>
                <Link to="/inventory"><ErpButton variant="secondary" className={btnSm}>Inventory →</ErpButton></Link>
                <ErpButton variant="secondary" className={btnSm} onClick={() => { refetch(); invalidate(); }} disabled={isFetching}>
                  <RefreshCw className={`mr-1 inline h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />Refresh
                </ErpButton>
              </>
            )}
          </div>
        )}
      />

      {section !== 'warehouses' && KpiStrip}

      {section === 'warehouses' && (
        <SitesLayoutSection />
      )}

      {(section === 'put-away' || section === 'picking') && (
        <>
          {section === 'put-away' && (
            <ErpCard className="mb-4 !p-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">
                {isFgOps ? 'After final QC' : 'After incoming QC'}
              </p>
              <div className="flex flex-wrap items-center gap-1 text-[10px]">
                {(isFgOps ? FG_PUT_AWAY_FLOW : RM_PUT_AWAY_FLOW).map((step, i) => (
                  <span key={step.id} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight size={10} className="text-erp-text-muted" />}
                    <span
                      className={`rounded px-1.5 py-0.5 ${step.id === 'putaway' ? 'bg-[var(--erp-accent-muted)] font-medium' : 'text-erp-text-muted'}`}
                      title={step.detail}
                    >
                      {step.label}
                    </span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-erp-text-muted">
                {isFgOps
                  ? 'Select a SKU, then click Put away on a bin row to stage finished goods.'
                  : 'Select the material, confirm dock qty, then click Put away on a bin row. Optional — stock can stay on dock for reserve/issue.'}
              </p>
            </ErpCard>
          )}
          <ErpCard className="mb-4 flex flex-wrap items-end gap-3 p-4">
            {InventoryTypeToggle}
            {WarehousePicker}
            {ItemPicker}
            {section === 'put-away' && (
              <div>
                <label className={fieldLabel}>
                  {isFgOps ? 'Put-away qty' : 'Put-away qty (blank = all unallocated)'}
                </label>
                <ErpInput
                  type="number"
                  min={1}
                  max={(isFgOps ? fgOnHand : unallocTransferable) || undefined}
                  value={putAwayQty}
                  onChange={(e) => setPutAwayQty(e.target.value)}
                  className="w-24"
                  placeholder={
                    isFgOps
                      ? (fgOnHand > 0 ? String(fgOnHand) : 'Qty')
                      : (unallocTransferable > 0 ? String(unallocTransferable) : 'All')
                  }
                />
              </div>
            )}
            {section === 'picking' && (
              <div>
                <label className={fieldLabel}>Pick qty</label>
                <ErpInput type="number" min={1} value={opQty} onChange={(e) => setOpQty(e.target.value)} className="w-20" />
              </div>
            )}
            {itemSelected && (
              <div className="text-[10px] text-erp-text-muted">
                {isFgOps ? (
                  <>
                    <p>On hand: <strong>{fgOnHand}</strong> · status: {statusLabel(fgStatus)}
                      {fgBinId && ` · bin ${binLabel(bins.find((b) => b._id === fgBinId))}`}
                    </p>
                  </>
                ) : (
                  <>
                    <p>Unallocated dock: <strong>{unallocTransferable}</strong> transferable
                      {(unallocRow?.reserved ?? 0) > 0 && ` (${unallocRow?.reserved} reserved)`}
                    </p>
                    {matAvailability && (
                      <p>Factory total: {matAvailability.available ?? 0} avail / {matAvailability.onHand ?? 0} on hand
                        {(matAvailability.locations?.length ?? 0) > 0 && ` · ${matAvailability.locations!.length} bin location(s)`}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            <p className="text-[10px] text-erp-text-muted">
              {section === 'put-away'
                ? (isFgOps
                  ? 'Stages finished goods into the selected bin for storage / dispatch.'
                  : 'Increases bin stock; decreases unallocated dock stock. Reserved qty cannot be put away.')
                : 'Decreases unreserved stock in the selected bin only.'}
            </p>
          </ErpCard>
          {section === 'put-away' && itemSelected && (isFgOps ? fgOnHand <= 0 : unallocTransferable <= 0) && (
            <AlertBanner message={
              isFgOps
                ? 'No finished-goods stock for this SKU. Complete final QC in Quality first.'
                : 'No unallocated stock for this material. Complete incoming QC in Quality, or select another material.'
            }
            />
          )}
          {section === 'put-away' && !itemSelected && (
            <AlertBanner message={isFgOps ? 'Select a SKU above.' : 'Select a material above (or open from Inventory → Put away on a dock row).'} />
          )}
          {section === 'picking' && !itemSelected && (
            <AlertBanner message={isFgOps ? 'Select a SKU above.' : 'Select a material above (or open from Find stock → Pick).'} />
          )}
          {section === 'picking' && itemSelected && isRmOps && (matAvailability?.available ?? 0) <= 0 && (
            <AlertBanner message="No available stock for this material in bins. Put away from dock first, or reserve/release holds." />
          )}
          {section === 'picking' && itemSelected && isFgOps && (!fgBinId || fgOnHand <= 0) && (
            <AlertBanner message="No finished goods in a bin for this SKU. Put away first, then pick." />
          )}
          <BinsTable action={section === 'put-away' ? 'put-away' : 'pick'} />
        </>
      )}

      {section === 'transfer' && (
        <>
          {!itemSelected && (
            <AlertBanner message={isFgOps ? 'Select a SKU to transfer between bins.' : 'Select a material to transfer between dock and bins.'} />
          )}
          <ErpCard className="mb-4 flex flex-wrap items-end gap-3 p-4">
            {InventoryTypeToggle}
            {WarehousePicker}
            {ItemPicker}
            <div className="min-w-[160px]">
              <label className={fieldLabel}>{isFgOps ? 'From bin' : 'From bin (blank = unallocated)'}</label>
              <ErpSelect
                value={transferFromBinId || (isFgOps ? fgBinId : '')}
                onChange={(e) => setTransferFromBinId(e.target.value)}
              >
                {!isFgOps && (
                  <option value="">Unallocated dock ({unallocTransferable} avail)</option>
                )}
                {isFgOps && !fgBinId && <option value="">No current bin</option>}
                {bins.filter((b) => b.status === 'ACTIVE').map((b) => {
                  const avail = isFgOps
                    ? (fgBinId === b._id ? transferableQty(selectedFgBalance) : 0)
                    : transferableQty(binBalanceMap.get(b._id));
                  return (
                    <option key={b._id} value={b._id} disabled={avail <= 0}>
                      {binLabel(b)} ({avail} avail)
                    </option>
                  );
                })}
              </ErpSelect>
            </div>
            <div className="min-w-[160px]">
              <label className={fieldLabel}>Destination bin</label>
              <ErpSelect value={transferBinId} onChange={(e) => setTransferBinId(e.target.value)}>
                <option value="">Select…</option>
                {bins.filter((b) => b._id !== (transferFromBinId || fgBinId) && b.status === 'ACTIVE').map((b) => (
                  <option key={b._id} value={b._id}>{binLabel(b)}</option>
                ))}
              </ErpSelect>
            </div>
            <div>
              <label className={fieldLabel}>Qty (blank = max {transferSourceAvail})</label>
              <ErpInput type="number" min={1} max={transferSourceAvail || undefined} value={transferQty} onChange={(e) => setTransferQty(e.target.value)} className="w-20" placeholder={transferSourceAvail > 0 ? String(transferSourceAvail) : 'Max'} />
            </div>
            {transferFromBinId === transferBinId && transferBinId && (
              <p className="text-[10px] text-red-600">Source and destination must differ.</p>
            )}
            <ErpButton
              disabled={transferBlocked || !canUpdate || mut.isPending}
              onClick={() => {
                const qtyLabel = transferQty || String(transferSourceAvail);
                const fromId = transferFromBinId || (isFgOps ? fgBinId : '');
                const fromLabel = fromId
                  ? binLabel(bins.find((b) => b._id === fromId))
                  : 'unallocated dock';
                const toLabel = binLabel(bins.find((b) => b._id === transferBinId));
                promptConfirm(
                  'Transfer stock',
                  `Move ${qtyLabel} from ${fromLabel} → ${toLabel}? Source decreases; destination increases.`,
                  () => mut.mutate({ type: 'transfer' }),
                );
              }}
            >
              <ArrowRightLeft className="mr-1 inline h-3 w-3" />Transfer
            </ErpButton>
            <p className="w-full text-[10px] text-erp-text-muted">
              Transfers unreserved stock only. Source available: {transferSourceAvail}.
              {isFgOps && ' Finished goods transfer moves the full on-hand qty to the destination bin.'}
            </p>
          </ErpCard>
          <BinsTable />
        </>
      )}

      {section === 'dispatch' && (
        <div className="space-y-6">
          <ErpCard className="flex flex-wrap items-end gap-3 p-4">
            {InventoryTypeToggle}
            {WarehousePicker}
          </ErpCard>

          {isFgOps ? (
            <>
              {!fgWarehouse && (
                <AlertBanner message="No finished-goods warehouse yet. Create one under Sites & layout (type Finished goods), then add bins." />
              )}
              <ErpCard className="p-4">
                <h3 className="mb-3 text-sm font-medium">Stage → ready to ship</h3>
                <p className="mb-3 text-[10px] text-erp-text-muted">
                  Finished goods must be received from production QC first. Stage assigns a bin; mark ready enables outbound dispatch.
                </p>
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  {ItemPicker}
                  <div className="min-w-[140px]">
                    <label className={fieldLabel}>Bin</label>
                    <ErpSelect value={dispatchBinId || fgBinId} onChange={(e) => setDispatchBinId(e.target.value)}>
                      <option value="">Select…</option>
                      {fgBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
                    </ErpSelect>
                  </div>
                  <div>
                    <label className={fieldLabel}>Qty</label>
                    <ErpInput type="number" min={1} max={fgOnHand || undefined} value={dispatchQty} onChange={(e) => setDispatchQty(e.target.value)} className="w-20" />
                  </div>
                  {skuId && (
                    <p className="text-[10px] text-erp-text-muted">
                      On hand: <strong>{fgOnHand}</strong> · status: {statusLabel(fgStatus)}
                    </p>
                  )}
                </div>
                {skuId && (dispatchBinId || fgBinId) && canUpdate && (
                  <div className="flex gap-2">
                    <ErpButton
                      variant="secondary"
                      className={btnSm}
                      disabled={fgOnHand < (Number(dispatchQty) || 1) || mut.isPending}
                      onClick={() => {
                        if (!dispatchBinId && fgBinId) setDispatchBinId(fgBinId);
                        promptConfirm(
                          'Stage in bin',
                          `Assign ${dispatchQty || 1} units to bin ${binLabel(fgBins.find((b) => b._id === (dispatchBinId || fgBinId)))}?`,
                          () => mut.mutate({ type: 'fgPutAway' }),
                        );
                      }}
                    >
                      Stage in bin
                    </ErpButton>
                    <ErpButton
                      className={btnSm}
                      disabled={fgOnHand <= 0 || mut.isPending}
                      onClick={() => promptConfirm(
                        'Mark ready to ship',
                        `Mark SKU ready for dispatch from bin ${binLabel(fgBins.find((b) => b._id === (dispatchBinId || fgBinId)))}?`,
                        () => mut.mutate({ type: 'markReady' }),
                      )}
                    >
                      Mark ready to ship
                    </ErpButton>
                  </div>
                )}
                {skuId && fgOnHand <= 0 && (
                  <p className="mt-2 text-[10px] text-amber-700">No stock for this SKU. Complete final QC in Quality first.</p>
                )}
              </ErpCard>

              <ErpCard className="overflow-hidden p-0">
                <h3 className="border-b px-4 py-3 text-sm font-medium">Ready for dispatch</h3>
                <ErpDataTable className="w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-left">Bin</th>
                      <th className="px-3 py-2 text-left">Qty</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchReady.map((row: DispatchReadyBalance) => (
                      <tr key={row._id} className="border-t border-[var(--erp-border)]">
                        <td className="px-3 py-2 font-mono">{dispatchRowSku(row)}</td>
                        <td className="px-3 py-2">{typeof row.storageBinId === 'object' ? binLabel(row.storageBinId) : '—'}</td>
                        <td className="px-3 py-2">{dispatchRowQty(row)}</td>
                        <td className="px-3 py-2 text-right">
                          {canUpdate && (
                            <ErpButton
                              className={btnSm}
                              disabled={mut.isPending}
                              onClick={() => setConfirmAction({
                                label: `Dispatch ${dispatchRowQty(row)} units?`,
                                message: `Ship ${dispatchRowQty(row)} units of ${dispatchRowSku(row)}? On-hand will decrease.`,
                                fn: () => mut.mutate({
                                  type: 'dispatch',
                                  payload: {
                                    skuId: row.skuId
                                      ? (typeof row.skuId === 'string' ? row.skuId : row.skuId._id)
                                      : '',
                                    storageBinId: getDispatchBinId(row),
                                    quantity: dispatchRowQty(row),
                                  },
                                }),
                              })}
                            >
                              Dispatch
                            </ErpButton>
                          )}
                        </td>
                      </tr>
                    ))}
                    {dispatchReady.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-8 text-center text-erp-text-muted">No stock ready to dispatch</td></tr>
                    )}
                  </tbody>
                </ErpDataTable>
              </ErpCard>
            </>
          ) : (
            <>
              <ErpCard className="p-4">
                <h3 className="mb-2 text-sm font-medium">Raw material outbound</h3>
                <p className="mb-3 text-[10px] text-erp-text-muted">
                  Issue materials from bins for external dispatch or consumption. Select a material and pick qty, then Dispatch from a bin.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  {ItemPicker}
                  <div>
                    <label className={fieldLabel}>Qty</label>
                    <ErpInput type="number" min={1} value={opQty} onChange={(e) => setOpQty(e.target.value)} className="w-20" />
                  </div>
                </div>
              </ErpCard>
              {!matId && <AlertBanner message="Select a material to dispatch from bins." />}
              <BinsTable action="pick" />
            </>
          )}
        </div>
      )}

      {section === 'stock-locator' && <StockLocatorSection />}

      {section === 'cycle-counts' && (
        <>
          <ErpCard className="mb-4 flex flex-wrap items-end gap-3 p-4">
            {InventoryTypeToggle}
            {WarehousePicker}
            {canCreate && whId && (
              <ErpButton className={btnSm} onClick={() => mut.mutate({ type: 'createCount' })}>Start new count</ErpButton>
            )}
          </ErpCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ErpCard className="overflow-hidden p-0">
              <ErpDataTable className="w-full text-[11px]">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">Count #</th>
                    <th className="px-3 py-2 text-left">Warehouse</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cycleCounts.map((c: CycleCount) => (
                    <tr key={c._id} className={`border-t border-[var(--erp-border)] ${activeCountId === c._id ? 'bg-[var(--erp-accent-muted)]' : ''}`}>
                      <td className="px-3 py-2 font-mono">{c.countNumber || c._id.slice(-8)}</td>
                      <td className="px-3 py-2">{warehouseLabel(c.warehouseId ?? '')}</td>
                      <td className="px-3 py-2"><ErpStatusBadge status={c.status} label={statusLabel(c.status ?? '')} /></td>
                      <td className="px-3 py-2 text-right">
                        {c.status !== 'COMPLETED' && (
                          <div className="flex justify-end gap-1">
                            <ErpButton className={btnSm} variant="secondary" onClick={() => openCount(c)}>Count</ErpButton>
                            {c.status === 'DRAFT' && canUpdate && (
                              <ErpButton className={btnSm} onClick={() => mut.mutate({ type: 'startCount', payload: { id: c._id } })}>Start</ErpButton>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {cycleCounts.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-erp-text-muted">No cycle counts</td></tr>
                  )}
                </tbody>
              </ErpDataTable>
            </ErpCard>

            {activeCountId && countLines.length > 0 && (
              <ErpCard className="p-4">
                <h3 className="mb-3 text-sm font-medium">Count lines</h3>
                <ErpDataTable className="mb-3 w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left">Item</th>
                      <th className="px-2 py-1 text-left">System</th>
                      <th className="px-2 py-1 text-left">Counted</th>
                      <th className="px-2 py-1 text-left">Var</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countLines.map((l, idx) => (
                      <tr key={idx} className="border-t border-[var(--erp-border)]">
                        <td className="px-2 py-1">{cycleLineMaterial(l)}</td>
                        <td className="px-2 py-1">{l.systemQty}</td>
                        <td className="px-2 py-1">
                          <ErpInput
                            type="number"
                            min={0}
                            value={l.countedQty}
                            onChange={(e) => updateCountLine(idx, Number(e.target.value) || 0)}
                            className="!w-16 !py-0.5 text-[10px]"
                          />
                        </td>
                        <td className={`px-2 py-1 ${varianceClass((l.countedQty ?? 0) - (l.systemQty ?? 0))}`}>
                          {(l.countedQty ?? 0) - (l.systemQty ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ErpDataTable>
                <label className="mb-3 flex items-center gap-2 text-[10px]">
                  <input type="checkbox" checked={applyAdjustments} onChange={(e) => setApplyAdjustments(e.target.checked)} />
                  Post variances to inventory (ADJUSTMENT)
                </label>
                {canUpdate && (
                  <ErpButton
                    onClick={() => mut.mutate({
                      type: 'completeCount',
                      payload: { id: activeCountId, lines: countLines, applyAdjustments },
                    })}
                  >
                    Complete count
                  </ErpButton>
                )}
              </ErpCard>
            )}
            {activeCountId && countLines.length === 0 && (
              <ErpCard className="p-4">
                <h3 className="mb-2 text-sm font-medium">Count lines</h3>
                <p className="text-[11px] text-erp-text-muted">
                  No stock lines for this count yet. Put away stock into bins first, then start a new count.
                </p>
              </ErpCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
