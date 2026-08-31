import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowDownToLine, ArrowRight, Check, ClipboardList, Download, History, Package, RefreshCw, Search, ShoppingCart, Truck, Upload, Warehouse, X,
} from 'lucide-react';
import { inventoryApi, skuApi } from '../../services/manufacturing';
import { purchaseApi } from '../../services/operations';
import type { InventoryBalance, InventoryTransaction, Material, PurchaseRequisition, Sku } from '../../types/api';
import {
  ErpButton, ErpCard, ErpDataTable, ErpInput, ErpPageHeader, ErpSelect,
  ErpStatusBadge, ErpTabs,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  MATERIAL_CATEGORIES, MATERIAL_UNITS, RESERVATION_REFERENCE_TYPES, RM_POST_QC_FLOW,
  TRANSACTION_TYPES, balanceLocationLabel, categoryLabel, formatCurrency, formatDateTime,
  inventoryConfirmMessage, inventorySuccessMessage, materialDisplayName, materialIdFromBalance,
  performerName, putAwayPath, stockLocatorPath, stockWorkflowHint, suggestedPrQty, transactionLabel,
  transactionReferenceLabel, unitLabel,
} from './inventoryUtils';
import { colorSwatch, designIdOf, designLabel, formatPrice, sampleLabel, statusLabel as skuStatusLabel } from '../sku/skuUtils';
import { downloadCsv } from '../../utils/csvExport';
import {
  materialsImportTemplateCsv, parseMaterialsUploadFile, type ImportMaterialRow,
} from './materialImport';
import { MaterialMasterRequestsTab } from './MaterialMasterRequestsTab';

const PAGE_SIZE = 20;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const OPEN_PR_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'APPROVED']);

type TabId = 'materials' | 'stock' | 'alerts' | 'movements' | 'reservations' | 'requests';
type InventoryScope = 'RAW_MATERIAL' | 'FINISHED_PRODUCT';

function prLineMaterialId(line: { materialId?: string | { _id: string } }): string {
  if (!line.materialId) return '';
  return typeof line.materialId === 'string' ? line.materialId : line.materialId._id;
}

function skuIdOfBalance(b: InventoryBalance & { skuId?: string | Sku }): string {
  const s = b.skuId;
  if (!s) return '';
  return typeof s === 'string' ? s : s._id;
}

const defaultForm = {
  materialCode: '',
  name: '',
  unit: 'METERS',
  unitCost: 0,
  category: 'FABRIC',
  reorderLevel: 0,
};

function ModalShell({ children, onClose, maxWidth = 'max-w-lg' }: { children: ReactNode; onClose: () => void; maxWidth?: string }) {
  return createPortal(
    <div
      className="erp-modal-overlay fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/45 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`my-auto w-full ${maxWidth}`}
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

export function InventoryPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('inventory.create');
  const canUpdate = permissions.includes('*') || permissions.includes('inventory.update');
  const canExport = permissions.includes('*') || permissions.includes('inventory.export');
  const canRequestPurchase = permissions.includes('*') || permissions.includes('purchase.create');
  const canPutAway = permissions.includes('*') || permissions.includes('warehouse.update');
  const canReadSkus = permissions.includes('*')
    || permissions.includes('sku.read')
    || permissions.includes('inventory.read');

  const tabFromUrl = searchParams.get('tab') as TabId | null;
  const scopeFromUrl = searchParams.get('inventoryType') === 'FINISHED_GOODS'
    || searchParams.get('view') === 'finished'
    ? 'FINISHED_PRODUCT'
    : 'RAW_MATERIAL';
  const INVENTORY_TABS: TabId[] = ['materials', 'stock', 'alerts', 'movements', 'reservations', 'requests'];
  const initialTab: TabId = tabFromUrl && INVENTORY_TABS.includes(tabFromUrl)
    ? tabFromUrl
    : (canRequestPurchase ? 'stock' : 'materials');
  const [scope, setScope] = useState<InventoryScope>(scopeFromUrl);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [stockPrefocused, setStockPrefocused] = useState(!!tabFromUrl);
  const [matPage, setMatPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [fgPage, setFgPage] = useState(1);
  const [fgSearch, setFgSearch] = useState('');
  const [fgSearchInput, setFgSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [txType, setTxType] = useState('');
  const [txMaterialId, setTxMaterialId] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [receiptQty, setReceiptQty] = useState<Record<string, number>>({});
  const [prQty, setPrQty] = useState<Record<string, number>>({});
  const [justRequested, setJustRequested] = useState<Record<string, { prNumber: string; status: string; prId: string }>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ unitCost: '', reorderLevel: '' });
  const [receiptConfirm, setReceiptConfirm] = useState<{ materialId: string; quantity: number; unit: string; label: string; storageBinId?: string } | null>(null);
  const [reserveForm, setReserveForm] = useState({ materialId: '', quantity: '10', referenceType: 'MANUAL', referenceId: '' });
  const [releaseForm, setReleaseForm] = useState({ referenceType: 'SAMPLE', referenceId: '' });
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; fn: () => void } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportMaterialRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [postOpeningStock, setPostOpeningStock] = useState(true);
  const [importBusy, setImportBusy] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const { data: stats } = useQuery({ queryKey: ['inventory-stats'], queryFn: () => inventoryApi.stats() });

  // Store Keeper: land on Stock so post-QC dock receipts are visible (Alerts hide healthy stock)
  useEffect(() => {
    if (scope !== 'RAW_MATERIAL') return;
    if (stockPrefocused || !canRequestPurchase) return;
    setTab('stock');
    setStockPrefocused(true);
  }, [canRequestPurchase, stockPrefocused, scope]);

  useEffect(() => {
    const t = searchParams.get('tab') as TabId | null;
    if (t && ['materials', 'stock', 'alerts', 'movements', 'reservations', 'requests'].includes(t) && t !== tab) {
      setTab(t);
      setStockPrefocused(true);
    }
    const nextScope: InventoryScope = searchParams.get('inventoryType') === 'FINISHED_GOODS'
      || searchParams.get('view') === 'finished'
      ? 'FINISHED_PRODUCT'
      : 'RAW_MATERIAL';
    setScope((prev) => (prev === nextScope ? prev : nextScope));
  }, [searchParams, tab]);

  const selectScope = (next: InventoryScope) => {
    setScope(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'FINISHED_PRODUCT') {
      params.set('view', 'finished');
      params.set('inventoryType', 'FINISHED_GOODS');
      params.delete('tab');
    } else {
      params.delete('view');
      params.delete('inventoryType');
    }
    setSearchParams(params, { replace: true });
  };

  const selectTab = (id: TabId) => {
    setTab(id);
    setStockPrefocused(true);
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    next.delete('inventoryType');
    if (id === 'stock' && canRequestPurchase) next.set('tab', 'stock');
    else if (id === 'alerts' || id === 'requests') next.set('tab', id);
    else next.delete('tab');
    setSearchParams(next, { replace: true });
  };

  const { data: materialsAll = [] } = useQuery({
    queryKey: ['materials-reserve'],
    queryFn: () => inventoryApi.listMaterialsPage({ limit: 200 }).then((r) => r.items),
    enabled: tab === 'reservations' || tab === 'movements',
  });

  const { data: reserveAvail } = useQuery({
    queryKey: ['inventory-availability', reserveForm.materialId],
    queryFn: () => inventoryApi.availability(reserveForm.materialId),
    enabled: tab === 'reservations' && !!reserveForm.materialId,
  });

  const { data: materialsPage, isLoading: materialsLoading, isFetching, refetch } = useQuery({
    queryKey: ['materials-page', matPage, search, categoryFilter],
    queryFn: () => inventoryApi.listMaterialsPage({
      page: matPage,
      limit: PAGE_SIZE,
      search: search || undefined,
      category: categoryFilter || undefined,
    }),
    enabled: scope === 'RAW_MATERIAL' && tab === 'materials',
  });

  const { data: stockPageData, isLoading: stockLoading } = useQuery({
    queryKey: ['inventory-balances-page', stockPage, stockSearch, tab],
    queryFn: () => inventoryApi.listBalancesPage({
      page: stockPage,
      limit: PAGE_SIZE,
      search: stockSearch || undefined,
      lowStockOnly: tab === 'alerts',
    }),
    enabled: scope === 'RAW_MATERIAL' && (tab === 'stock' || tab === 'alerts'),
  });

  const { data: openPrs = [] } = useQuery({
    queryKey: ['prs-open-for-alerts'],
    queryFn: () => purchaseApi.listPRs({ limit: 200 }),
    enabled: scope === 'RAW_MATERIAL' && canRequestPurchase && (tab === 'alerts' || tab === 'stock'),
    select: (prs) => (prs as PurchaseRequisition[]).filter((p) => OPEN_PR_STATUSES.has(p.status)),
  });

  const requestedByMaterial = useMemo(() => {
    const map = new Map<string, { prNumber: string; status: string; prId: string }>();
    for (const pr of openPrs) {
      for (const line of pr.lines || []) {
        const mid = prLineMaterialId(line);
        if (!mid || map.has(mid)) continue;
        map.set(mid, { prNumber: pr.prNumber, status: pr.status, prId: pr._id });
      }
    }
    return map;
  }, [openPrs]);

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['inventory-transactions', txPage, txType, txMaterialId],
    queryFn: () => inventoryApi.listTransactionsPage({
      page: txPage,
      limit: PAGE_SIZE,
      type: txType || undefined,
      materialId: txMaterialId || undefined,
    }),
    enabled: scope === 'RAW_MATERIAL' && tab === 'movements',
  });

  const { data: skuStats } = useQuery({
    queryKey: ['sku-stats'],
    queryFn: skuApi.stats,
    enabled: scope === 'FINISHED_PRODUCT' && canReadSkus,
  });

  const { data: fgSkuPage, isLoading: fgSkuLoading, isFetching: fgSkuFetching, refetch: refetchFgSkus } = useQuery({
    queryKey: ['inventory-fg-skus', fgPage, fgSearch],
    queryFn: () => skuApi.listPage({
      page: fgPage,
      limit: PAGE_SIZE,
      search: fgSearch || undefined,
    }),
    enabled: scope === 'FINISHED_PRODUCT' && canReadSkus,
  });

  const { data: fgBalancesPage } = useQuery({
    queryKey: ['inventory-fg-balances'],
    queryFn: () => inventoryApi.listBalancesPage({ inventoryType: 'FINISHED_GOODS', limit: 500 }),
    enabled: scope === 'FINISHED_PRODUCT' && canReadSkus,
  });

  const fgSkus = fgSkuPage?.items ?? [];
  const fgSkuMeta = fgSkuPage?.meta;
  const fgStockBySkuId = useMemo(() => {
    const map = new Map<string, { onHand: number; available: number; unit: string }>();
    for (const b of (fgBalancesPage?.items ?? []) as Array<InventoryBalance & { skuId?: string | Sku }>) {
      const id = skuIdOfBalance(b);
      if (!id) continue;
      const prev = map.get(id) || { onHand: 0, available: 0, unit: b.unit || 'PIECES' };
      map.set(id, {
        onHand: prev.onHand + (b.onHand || 0),
        available: prev.available + (b.available || 0),
        unit: b.unit || prev.unit,
      });
    }
    return map;
  }, [fgBalancesPage]);

  const materials = materialsPage?.items ?? [];
  const matMeta = materialsPage?.meta;
  const balances = stockPageData?.items ?? [];
  const stockMeta = stockPageData?.meta;
  const transactions = txData?.items ?? [];
  const txMeta = txData?.meta;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['materials-page'] });
    qc.invalidateQueries({ queryKey: ['materials'] });
    qc.invalidateQueries({ queryKey: ['materials-reserve'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances'] });
    qc.invalidateQueries({ queryKey: ['inventory-balances-page'] });
    qc.invalidateQueries({ queryKey: ['inventory-stats'] });
    qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
    qc.invalidateQueries({ queryKey: ['inventory-availability'] });
    qc.invalidateQueries({ queryKey: ['warehouse-stats'] });
    qc.invalidateQueries({ queryKey: ['purchase-list'] });
    qc.invalidateQueries({ queryKey: ['prs-open-for-alerts'] });
    qc.invalidateQueries({ queryKey: ['qc-queue'] });
    qc.invalidateQueries({ queryKey: ['quality-stats'] });
    qc.invalidateQueries({ queryKey: ['material-master-requests'] });
  };

  const promptConfirm = (title: string, message: string, fn: () => void) => {
    setConfirmAction({ title, message, fn });
  };

  const createMaterial = useMutation({
    mutationFn: () => inventoryApi.createMaterial(form),
    onSuccess: () => {
      setForm(defaultForm);
      setShowAddMaterial(false);
      invalidate();
      showSuccess(inventorySuccessMessage('createMaterial'));
    },
    onError: (e: Error) => setError(e.message),
  });

  const closeAddMaterial = () => {
    setShowAddMaterial(false);
    setForm(defaultForm);
  };

  const onPickImportFile = async (file: File | null) => {
    if (!file) return;
    setImportBusy(true);
    setError('');
    try {
      const rows = await parseMaterialsUploadFile(file);
      if (!rows.length) {
        setError('No material rows found in that file');
        setImportRows([]);
        setImportFileName('');
        return;
      }
      setImportRows(rows);
      setImportFileName(file.name);
      setShowImport(true);
      setShowAddMaterial(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read file');
      setImportRows([]);
    } finally {
      setImportBusy(false);
    }
  };

  const runBulkImport = useMutation({
    mutationFn: () => inventoryApi.bulkImportMaterials({
      items: importRows,
      postOpeningStock,
    }),
    onSuccess: (result) => {
      invalidate();
      setShowImport(false);
      setImportRows([]);
      setImportFileName('');
      const errHint = result.errors?.length
        ? ` · ${result.errors.length} row error(s)`
        : '';
      showSuccess(
        `Imported ${result.created} material(s), skipped ${result.skipped}`
        + (postOpeningStock ? `, stock posted for ${result.stockPosted}` : '')
        + errHint,
      );
    },
    onError: (e: Error) => setError(e.message),
  });

  const downloadImportTemplate = () => {
    const blob = new Blob([materialsImportTemplateCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raw-materials-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateMaterial = useMutation({
    mutationFn: (id: string) => inventoryApi.updateMaterial(id, {
      unitCost: editForm.unitCost ? Number(editForm.unitCost) : undefined,
      reorderLevel: editForm.reorderLevel ? Number(editForm.reorderLevel) : 0,
    }),
    onSuccess: () => {
      setEditId(null);
      invalidate();
      showSuccess('Material updated');
    },
    onError: (e: Error) => setError(e.message),
  });

  const receipt = useMutation({
    mutationFn: (body: { materialId: string; quantity: number; unit: string; storageBinId?: string }) => inventoryApi.receipt(body),
    onSuccess: () => {
      setReceiptConfirm(null);
      setConfirmAction(null);
      invalidate();
      showSuccess(inventorySuccessMessage('manualReceipt'));
    },
    onError: (e: Error) => setError(e.message),
  });

  const reserveStock = useMutation({
    mutationFn: () => {
      const mat = materialsAll.find((m) => m._id === reserveForm.materialId);
      return inventoryApi.reserve({
        materialId: reserveForm.materialId,
        quantity: Number(reserveForm.quantity) || 0,
        unit: mat?.unit || 'METERS',
        referenceType: reserveForm.referenceType,
        referenceId: reserveForm.referenceId,
      });
    },
    onSuccess: () => {
      setConfirmAction(null);
      invalidate();
      showSuccess(inventorySuccessMessage('reserve'));
    },
    onError: (e: Error) => setError(e.message),
  });

  const releaseStock = useMutation({
    mutationFn: () => inventoryApi.releaseReservations(releaseForm),
    onSuccess: (r) => {
      setConfirmAction(null);
      invalidate();
      showSuccess(`Released ${r.released ?? 0} reservation(s)`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const requestPurchase = useMutation({
    mutationFn: async (balance: InventoryBalance) => {
      const materialId = materialIdFromBalance(balance);
      if (!materialId) throw new Error('Material missing on balance');
      const mat = typeof balance.materialId === 'object' ? balance.materialId : undefined;
      const qty = prQty[balance._id] ?? suggestedPrQty(balance);
      const pr = await purchaseApi.createPR({
        lines: [{
          materialId,
          requiredQty: qty,
          unit: balance.unit || mat?.unit || 'PIECES',
          estimatedUnitCost: mat?.unitCost ?? 0,
        }],
      });
      const submitted = await purchaseApi.submitPR(pr._id);
      return { pr: submitted, materialId };
    },
    onSuccess: ({ pr, materialId }) => {
      setConfirmAction(null);
      setJustRequested((prev) => ({
        ...prev,
        [materialId]: { prNumber: pr.prNumber, status: pr.status || 'SUBMITTED', prId: pr._id },
      }));
      qc.setQueryData(['prs-open-for-alerts'], (prev: PurchaseRequisition[] | undefined) => {
        const next = {
          ...pr,
          lines: pr.lines?.length ? pr.lines : [{ materialId, requiredQty: 0 }],
        } as PurchaseRequisition;
        return [...(prev || []).filter((p) => p._id !== pr._id), next];
      });
      invalidate();
      showSuccess(`${inventorySuccessMessage('requestPurchase')} (${pr.prNumber})`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const startEdit = (m: Material) => {
    setEditId(m._id);
    setEditForm({
      unitCost: String(m.unitCost ?? 0),
      reorderLevel: String(m.reorderLevel ?? 0),
    });
  };

  const stockStatus = (b: InventoryBalance) => {
    if (b.isOutOfStock) return { status: 'REJECTED', label: 'Out of stock' };
    if (b.isLowStock) return { status: 'PENDING', label: 'Low stock' };
    return { status: 'ACTIVE', label: 'OK' };
  };

  const needsPurchase = (b: InventoryBalance) => Boolean(b.isLowStock || b.isOutOfStock || (b.available ?? 0) <= 0);

  const promptRequestPurchase = (b: InventoryBalance) => {
    const qty = prQty[b._id] ?? suggestedPrQty(b);
    const name = materialDisplayName(b.materialId);
    promptConfirm(
      'Request purchase?',
      `Create and submit a purchase requisition for ${name}: ${qty} ${unitLabel(b.unit)}. Purchase Manager then Factory Admin must approve before PO/RFQ.`,
      () => requestPurchase.mutate(b),
    );
  };

  return (
    <div className="inventory-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Inventory"
        subtitle={scope === 'FINISHED_PRODUCT' ? (
          <>
            Finished SKUs available for production, warehouse, and dispatch.
            <Link to="/products/skus" className="ml-2 text-[var(--erp-accent)]">SKU master →</Link>
            <Link to="/warehouse/stock-locator?inventoryType=FINISHED_GOODS" className="ml-2 text-[var(--erp-accent)]">Find FG stock →</Link>
          </>
        ) : undefined}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="whitespace-nowrap text-[10px] uppercase tracking-wide text-erp-text-muted">Inventory type</span>
              <ErpSelect
                className="w-[150px] !py-1 text-[11px]"
                value={scope}
                onChange={(e) => selectScope(e.target.value as InventoryScope)}
              >
                <option value="RAW_MATERIAL">Raw materials</option>
                <option value="FINISHED_PRODUCT">Finished products</option>
              </ErpSelect>
            </div>
            {scope === 'RAW_MATERIAL' && canCreate && (
              <ErpButton
                className="!px-2 !py-1 text-[10px]"
                onClick={() => {
                  selectTab('materials');
                  setShowAddMaterial(true);
                }}
              >
                <Package size={12} className="mr-1 inline" /> Add material
              </ErpButton>
            )}
            {scope === 'RAW_MATERIAL' && canExport && balances.length > 0 && (
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => downloadCsv('inventory-stock.csv', ['Location', 'Material', 'On hand', 'Reserved', 'Available', 'Unit'], balances.map((b) => [
                balanceLocationLabel(b),
                materialDisplayName(b.materialId),
                b.onHand,
                b.reserved,
                b.available,
                b.unit,
              ]))}>
                <Download size={12} className="mr-1 inline" /> Export CSV
              </ErpButton>
            )}
            <ErpButton
              variant="secondary"
              className="!px-2 !py-1 text-[10px]"
              disabled={scope === 'FINISHED_PRODUCT' ? fgSkuFetching : isFetching}
              onClick={() => {
                if (scope === 'FINISHED_PRODUCT') {
                  refetchFgSkus();
                  qc.invalidateQueries({ queryKey: ['inventory-fg-balances'] });
                  qc.invalidateQueries({ queryKey: ['sku-stats'] });
                } else {
                  refetch();
                  invalidate();
                }
              }}
            >
              <RefreshCw size={12} className={(scope === 'FINISHED_PRODUCT' ? fgSkuFetching : isFetching) ? 'animate-spin' : ''} />
              <span className="ml-1">Refresh</span>
            </ErpButton>
          </div>
        )}
      />

      {scope === 'FINISHED_PRODUCT' ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <ErpCard className="!p-3">
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Total SKUs</p>
              <p className="text-lg font-semibold">{skuStats?.total ?? '—'}</p>
            </ErpCard>
            <ErpCard className="!p-3">
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Active</p>
              <p className="text-lg font-semibold">{skuStats?.active ?? '—'}</p>
            </ErpCard>
            <ErpCard className="!p-3">
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Draft</p>
              <p className="text-lg font-semibold">{skuStats?.draft ?? '—'}</p>
            </ErpCard>
            <ErpCard className="!p-3">
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">FG stock locations</p>
              <p className="text-lg font-semibold">{fgBalancesPage?.meta?.total ?? fgBalancesPage?.items?.length ?? '—'}</p>
            </ErpCard>
          </div>

          {!canReadSkus ? (
            <ErpCard className="!p-3">
              <p className="text-[11px] text-erp-text-muted">Finished products need <code className="text-[10px]">sku.read</code> or inventory access.</p>
            </ErpCard>
          ) : (
            <ErpCard className="!p-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--erp-border)] p-3">
                <div className="relative min-w-[180px] flex-1">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
                  <ErpInput
                    className="!py-1.5 pl-7 text-[11px]"
                    placeholder="Search SKU code, name, design…"
                    value={fgSearchInput}
                    onChange={(e) => setFgSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setFgSearch(fgSearchInput.trim());
                        setFgPage(1);
                      }
                    }}
                  />
                </div>
                <ErpButton
                  variant="secondary"
                  className="!px-2 !py-1.5 text-[11px]"
                  onClick={() => { setFgSearch(fgSearchInput.trim()); setFgPage(1); }}
                >
                  Search
                </ErpButton>
                <Link to="/products/skus" className="text-[11px] text-[var(--erp-accent)]">Manage SKUs →</Link>
              </div>

              {fgSkuLoading ? (
                <p className="p-4 text-[11px] text-erp-text-muted">Loading finished SKUs…</p>
              ) : (
                <div className="overflow-x-auto">
                  <ErpDataTable className="w-full min-w-[1000px] text-[11px]">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-left">Design</th>
                        <th className="px-3 py-2 text-left">Sample</th>
                        <th className="px-3 py-2 text-left">Size / Color</th>
                        <th className="px-3 py-2 text-left">Price</th>
                        <th className="px-3 py-2 text-right">On hand</th>
                        <th className="px-3 py-2 text-right">Available</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fgSkus.map((s: Sku) => {
                        const stock = fgStockBySkuId.get(s._id);
                        return (
                          <tr key={s._id} className="border-t border-[var(--erp-border)]">
                            <td className="px-3 py-2">
                              <span className="font-mono text-[10px]">{s.skuCode}</span>
                              <p className="text-[10px] text-erp-text-muted">{s.name}</p>
                            </td>
                            <td className="px-3 py-2">
                              {designIdOf(s) ? (
                                <Link to={`/designs/${designIdOf(s)}/edit`} className="text-[var(--erp-accent)] hover:underline">
                                  {designLabel(s.designId)}
                                </Link>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2 text-[10px]">{sampleLabel(s.sampleId)}</td>
                            <td className="px-3 py-2">{s.size} / {colorSwatch(s.color)}</td>
                            <td className="px-3 py-2">{formatPrice(s.basePrice)}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              {stock ? `${stock.onHand} ${stock.unit}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {stock ? `${stock.available} ${stock.unit}` : '—'}
                            </td>
                            <td className="px-3 py-2"><ErpStatusBadge status={s.status} label={skuStatusLabel(s.status)} /></td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                <Link
                                  to={stockLocatorPath({ inventoryType: 'FINISHED_GOODS', skuId: s._id, search: s.skuCode })}
                                  className="text-[10px] text-[var(--erp-accent)]"
                                >
                                  Locate
                                </Link>
                                <Link to="/boms" className="text-[10px] text-[var(--erp-accent)]">BOM →</Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {fgSkus.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-erp-text-muted">
                            No finished SKUs yet — create them from approved samples in{' '}
                            <Link to="/products/skus" className="text-[var(--erp-accent)]">Products → SKUs</Link>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </ErpDataTable>
                </div>
              )}

              {fgSkuMeta && fgSkuMeta.totalPages > 0 && (
                <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2">
                  <p className="text-[10px] text-erp-text-muted">{fgSkuMeta.page}/{fgSkuMeta.totalPages} · {fgSkuMeta.total}</p>
                  <div className="flex gap-1">
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={fgPage <= 1} onClick={() => setFgPage((p) => p - 1)}>Prev</ErpButton>
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={fgPage >= fgSkuMeta.totalPages} onClick={() => setFgPage((p) => p + 1)}>Next</ErpButton>
                  </div>
                </div>
              )}
            </ErpCard>
          )}
        </div>
      ) : (
      <>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Materials</p>
              <p className="text-lg font-semibold">{stats?.materialCount ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Warehouse size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Stock value</p>
              <p className="text-lg font-semibold">{stats ? formatCurrency(stats.stockValue ?? 0) : '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard
          className={`!p-3 ${(stats?.dockBalanceCount ?? 0) > 0 ? 'cursor-pointer ring-1 ring-[var(--erp-accent)]/40' : ''}`}
          onClick={() => { selectTab('stock'); setStockPage(1); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectTab('stock'); setStockPage(1); } }}
        >
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Dock (new receipts)</p>
              <p className="text-lg font-semibold">{stats?.dockBalanceCount ?? '—'}</p>
              <p className="text-[9px] text-erp-text-muted">
                {(stats?.dockOnHand ?? 0) > 0
                  ? `${stats?.dockOnHand} units on unallocated dock — open Stock`
                  : 'QC-passed purchases land here'}
              </p>
            </div>
          </div>
        </ErpCard>
        <ErpCard
          className={`!p-3 ${(stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0) > 0 ? 'cursor-pointer ring-1 ring-amber-500/40' : ''}`}
          onClick={() => { selectTab('alerts'); setStockPage(1); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectTab('alerts'); setStockPage(1); } }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Low / out</p>
              <p className={`text-lg font-semibold ${(stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0) > 0 ? 'text-amber-600' : ''}`}>
                {(stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0) || '—'}
              </p>
              <p className="text-[9px] text-erp-text-muted">Open Alerts → request purchase</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-erp-text-muted" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Active reservations</p>
              <p className="text-lg font-semibold">{stats?.activeReservations ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
      </div>

      {(stats?.pendingMasterRequests ?? 0) > 0 && tab !== 'requests' && (
        <button
          type="button"
          className="mb-3 flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-left text-[11px] text-amber-800"
          onClick={() => selectTab('requests')}
        >
          <ClipboardList size={14} />
          {stats?.pendingMasterRequests} fabric request{stats?.pendingMasterRequests === 1 ? '' : 's'} waiting for store approval
        </button>
      )}

      <ErpTabs
        tabs={[
          { id: 'materials', label: `Materials (${stats?.materialCount ?? '—'})` },
          {
            id: 'stock',
            label: (stats?.dockBalanceCount ?? 0) > 0
              ? `Stock (${stats?.dockBalanceCount} on dock)`
              : `Stock balances (${stats?.balanceCount ?? '—'})`,
          },
          { id: 'alerts', label: `Alerts (${(stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0)})` },
          { id: 'requests', label: (stats?.pendingMasterRequests ?? 0) > 0
            ? `Requests (${stats?.pendingMasterRequests})`
            : 'Requests' },
          { id: 'movements', label: 'Movements' },
          { id: 'reservations', label: 'Reserve / release' },
        ]}
        active={tab}
        onChange={(id) => selectTab(id as TabId)}
      />

      <div className="mt-3">
        {tab === 'requests' && <MaterialMasterRequestsTab canApprove={canCreate} />}
        {tab === 'materials' && (
          <div className="space-y-3">
            {canCreate && showImport && importRows.length > 0 && (
              <ErpCard className="!p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[11px] font-semibold text-erp-text-primary">Import preview</h3>
                    <p className="text-[10px] text-erp-text-muted">
                      {importFileName} · {importRows.length} row(s) ready
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-erp-text-muted">
                      <input
                        type="checkbox"
                        checked={postOpeningStock}
                        onChange={(e) => setPostOpeningStock(e.target.checked)}
                      />
                      Post opening stock
                    </label>
                    <ErpButton
                      variant="secondary"
                      className="!px-2.5 !py-1.5 text-[11px]"
                      onClick={() => { setShowImport(false); setImportRows([]); setImportFileName(''); }}
                    >
                      Cancel
                    </ErpButton>
                    <ErpButton
                      className="!px-2.5 !py-1.5 text-[11px]"
                      disabled={runBulkImport.isPending}
                      onClick={() => runBulkImport.mutate()}
                    >
                      {runBulkImport.isPending ? 'Importing…' : `Import ${importRows.length}`}
                    </ErpButton>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <ErpDataTable className="w-full min-w-[900px] text-[11px]">
                    <thead>
                      <tr>
                        <th className="px-2 py-1.5 text-left">Code</th>
                        <th className="px-2 py-1.5 text-left">Name</th>
                        <th className="px-2 py-1.5 text-left">Vendor</th>
                        <th className="px-2 py-1.5 text-left">Category</th>
                        <th className="px-2 py-1.5 text-left">Unit</th>
                        <th className="px-2 py-1.5 text-right">Cost</th>
                        <th className="px-2 py-1.5 text-right">Opening qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 40).map((r, i) => (
                        <tr key={`${r.materialCode}-${i}`} className="border-t border-[var(--erp-border)]">
                          <td className="px-2 py-1.5 font-mono">{r.materialCode}</td>
                          <td className="px-2 py-1.5">{r.name}</td>
                          <td className="px-2 py-1.5 text-erp-text-muted">{r.vendorName || '—'}</td>
                          <td className="px-2 py-1.5">{r.category}</td>
                          <td className="px-2 py-1.5">{r.unit}</td>
                          <td className="px-2 py-1.5 text-right">{r.unitCost || 0}</td>
                          <td className="px-2 py-1.5 text-right">{r.openingQty || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ErpDataTable>
                </div>
                {importRows.length > 40 && (
                  <p className="mt-1 text-[10px] text-erp-text-muted">Showing first 40 of {importRows.length} rows</p>
                )}
              </ErpCard>
            )}

            {!canCreate && (
              <ErpCard className="!p-3">
                <p className="text-[11px] text-erp-text-primary">
                  Material master create needs <code className="text-[10px]">inventory.create</code>
                  {' '}(Factory Admin, Inventory Sub Admin, Inventory Manager, or Store Keeper).
                </p>
                {canUpdate ? (
                  <p className="mt-1 text-[10px] text-erp-text-muted">
                    You can post stock with <strong>Manual</strong> on existing materials, or use Purchase GRN → incoming QC.
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] text-erp-text-muted">This role is read-only on inventory.</p>
                )}
              </ErpCard>
            )}

            <ErpCard className="!p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <label className={fieldLabel}>Search</label>
                  <div className="relative">
                    <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
                    <ErpInput className="!pl-7 !py-1.5 text-[11px]" placeholder="Code or name…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput.trim()); setMatPage(1); } }} />
                  </div>
                </div>
                <div className="w-32">
                  <label className={fieldLabel}>Category</label>
                  <ErpSelect className="!py-1.5 text-[11px]" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setMatPage(1); }}>
                    <option value="">All</option>
                    {MATERIAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </ErpSelect>
                </div>
                <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => { setSearch(searchInput.trim()); setMatPage(1); }}>Search</ErpButton>
              </div>
            </ErpCard>

            <ErpCard className="overflow-hidden !p-0">
              {materialsLoading ? (
                <p className="p-4 text-[11px] text-erp-text-muted">Loading materials…</p>
              ) : (
                <div className="overflow-x-auto">
                  <ErpDataTable className="w-full min-w-[900px] text-[11px]">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left">Code</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-left">Cost</th>
                        <th className="px-3 py-2 text-left">Reorder</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((m: Material) => (
                        <tr key={m._id} className="border-t border-[var(--erp-border)]">
                          <td className="px-3 py-2 font-mono">{m.materialCode}</td>
                          <td className="px-3 py-2">{m.name}</td>
                          <td className="px-3 py-2 text-erp-text-muted">{categoryLabel(m.category)}</td>
                          <td className="px-3 py-2">{unitLabel(m.unit)}</td>
                          <td className="px-3 py-2">{formatCurrency(m.unitCost || 0)}</td>
                          <td className="px-3 py-2">{m.reorderLevel ?? 0}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {canUpdate && (
                                <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => startEdit(m)}>Edit</ErpButton>
                              )}
                              {canUpdate && (
                                <>
                                  <ErpInput
                                    type="number"
                                    min={1}
                                    title="Quantity for Manual receipt (opening stock / correction)"
                                    aria-label="Manual receipt quantity"
                                    className="!w-16 !py-1 text-[10px]"
                                    value={receiptQty[m._id] ?? 100}
                                    onChange={(e) => setReceiptQty({ ...receiptQty, [m._id]: Number(e.target.value) })}
                                  />
                                  <ErpButton
                                    variant="secondary"
                                    className="!px-2 !py-1 text-[10px]"
                                    title="Post manual stock receipt using the quantity in the box"
                                    onClick={() => setReceiptConfirm({
                                      materialId: m._id,
                                      quantity: receiptQty[m._id] ?? 100,
                                      unit: m.unit,
                                      label: `${m.materialCode} — ${receiptQty[m._id] ?? 100} ${unitLabel(m.unit)}`,
                                    })}
                                  >
                                    <ArrowDownToLine size={10} className="mr-1 inline" />Manual
                                  </ErpButton>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {editId && materials.find((m) => m._id === editId) && (
                        <tr className="bg-[var(--erp-surface-muted)]">
                          <td colSpan={7} className="px-3 py-3">
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="w-24">
                                <label className={fieldLabel}>Unit cost</label>
                                <ErpInput className="!py-1 text-[11px]" type="number" min={0} value={editForm.unitCost} onChange={(e) => setEditForm((f) => ({ ...f, unitCost: e.target.value }))} />
                              </div>
                              <div className="w-24">
                                <label className={fieldLabel}>Reorder level</label>
                                <ErpInput className="!py-1 text-[11px]" type="number" min={0} value={editForm.reorderLevel} onChange={(e) => setEditForm((f) => ({ ...f, reorderLevel: e.target.value }))} />
                              </div>
                              <ErpButton className="!px-2 !py-1 text-[10px]" disabled={updateMaterial.isPending} onClick={() => updateMaterial.mutate(editId)}>Save</ErpButton>
                              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => setEditId(null)}>Cancel</ErpButton>
                            </div>
                          </td>
                        </tr>
                      )}
                      {materials.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-erp-text-muted">
                            {canCreate
                              ? 'No materials yet — use Add material, then Manual to post opening stock.'
                              : 'No materials yet. Ask Factory Admin / Inventory Sub Admin / Inventory Manager / Store Keeper to create the material master first.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </ErpDataTable>
                </div>
              )}
              {matMeta && matMeta.totalPages > 0 && (
                <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2">
                  <p className="text-[10px] text-erp-text-muted">{matMeta.page}/{matMeta.totalPages} · {matMeta.total} total</p>
                  <div className="flex gap-1">
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={matPage <= 1} onClick={() => setMatPage((p) => p - 1)}>Prev</ErpButton>
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={matPage >= matMeta.totalPages} onClick={() => setMatPage((p) => p + 1)}>Next</ErpButton>
                  </div>
                </div>
              )}
            </ErpCard>
          </div>
        )}

        {(tab === 'stock' || tab === 'alerts') && (
          <div className="space-y-3">
            {tab === 'stock' && !materialsLoading && (stats?.materialCount ?? 0) === 0 && (
              <ErpCard className="!p-3">
                <p className="text-[11px] text-erp-text-primary">No materials or stock yet.</p>
                <p className="mt-1 text-[10px] text-erp-text-muted">
                  Create a material master first, then post stock with Manual receipt (or Purchase → GRN → QC).
                </p>
                {canCreate && (
                  <ErpButton className="mt-2 !px-2 !py-1 text-[10px]" onClick={() => selectTab('materials')}>
                    Go to Materials → Add
                  </ErpButton>
                )}
              </ErpCard>
            )}
            {tab === 'stock' && balances.some((b) => !b.storageBinId && (b.available ?? 0) > 0) && (
              <ErpCard className="!p-3">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Stock on dock — next step</p>
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  {RM_POST_QC_FLOW.map((step, i) => (
                    <span key={step.id} className="flex items-center gap-1">
                      {i > 0 && <ArrowRight size={10} className="text-erp-text-muted" />}
                      <span
                        className={`rounded px-1.5 py-0.5 ${step.id === 'dock' ? 'bg-[var(--erp-accent-muted)] font-medium' : 'text-erp-text-muted'}`}
                        title={step.detail}
                      >
                        {step.label}
                      </span>
                    </span>
                  ))}
                </div>
                <ul className="mt-2 space-y-1 text-[10px] text-erp-text-muted">
                  {balances.filter((b) => !b.storageBinId && (b.available ?? 0) > 0).map((b) => (
                    <li key={b._id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{materialDisplayName(b.materialId)} — {b.available} {unitLabel(b.unit)} on dock</span>
                      {canPutAway ? (
                        <Link to={putAwayPath(materialIdFromBalance(b))} className="text-[var(--erp-accent)]">Put away →</Link>
                      ) : (
                        <Link to={stockLocatorPath({ materialId: materialIdFromBalance(b) })} className="text-[var(--erp-accent)]">Locate →</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </ErpCard>
            )}
            {tab === 'alerts' && (stats?.dockBalanceCount ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded border border-[var(--erp-accent)]/30 bg-[var(--erp-accent-muted)] px-3 py-2 text-[10px]">
                <Package size={14} className="text-[var(--erp-accent)]" />
                <span>
                  {(stats?.dockBalanceCount ?? 0)} material(s) with new QC stock on the dock
                  {(stats?.dockOnHand ?? 0) > 0 ? ` (${stats?.dockOnHand} units)` : ''}.
                </span>
                <button type="button" className="font-medium text-[var(--erp-accent)] hover:underline" onClick={() => selectTab('stock')}>
                  View Stock →
                </button>
              </div>
            )}
            {tab === 'alerts' && (stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-800">
                <AlertTriangle size={14} />
                <span>Materials below reorder level or with zero available.</span>
                {canRequestPurchase ? (
                  <span className="font-medium">Set qty on a row → Request purchase (creates & submits PR).</span>
                ) : (
                  <Link to="/purchase" className="font-medium text-[var(--erp-accent)]">Open Purchase →</Link>
                )}
              </div>
            )}
            <ErpCard className="!p-3">
              <label className={fieldLabel}>Filter</label>
              <ErpInput className="max-w-sm !py-1.5 text-[11px]" placeholder="Material code or name…" value={stockSearch} onChange={(e) => { setStockSearch(e.target.value); setStockPage(1); }} />
            </ErpCard>
            <ErpCard className="overflow-hidden !p-0">
              {stockLoading ? (
                <p className="p-4 text-[11px] text-erp-text-muted">Loading stock…</p>
              ) : (
                <div className="overflow-x-auto">
                  <ErpDataTable className="w-full min-w-[800px] text-[11px]">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left">Location</th>
                        <th className="px-3 py-2 text-left">Material</th>
                        <th className="px-3 py-2 text-right">On hand</th>
                        <th className="px-3 py-2 text-right">Reserved</th>
                        <th className="px-3 py-2 text-right">Available</th>
                        <th className="px-3 py-2 text-right">Reorder</th>
                        <th className="px-3 py-2 text-right">Value</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Next</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balances.map((b: InventoryBalance) => {
                        const st = stockStatus(b);
                        const hint = stockWorkflowHint(b);
                        const onDock = !b.storageBinId;
                        const materialId = materialIdFromBalance(b);
                        const existingPr = materialId
                          ? (requestedByMaterial.get(materialId) || justRequested[materialId])
                          : undefined;
                        const showPr = canRequestPurchase && needsPurchase(b);
                        const defaultPrQty = suggestedPrQty(b);
                        return (
                          <tr
                            key={b._id}
                            className={`border-t border-[var(--erp-border)] ${needsPurchase(b) ? 'bg-amber-500/5' : ''}`}
                          >
                            <td className="px-3 py-2 font-mono text-[10px] text-erp-text-muted">{balanceLocationLabel(b)}</td>
                            <td className="px-3 py-2">{materialDisplayName(b.materialId)}</td>
                            <td className="px-3 py-2 text-right">{b.onHand} {unitLabel(b.unit)}</td>
                            <td className="px-3 py-2 text-right text-erp-text-muted">{b.reserved}</td>
                            <td className="px-3 py-2 text-right font-medium">{b.available}</td>
                            <td className="px-3 py-2 text-right text-erp-text-muted">{b.reorderLevel ?? '—'}</td>
                            <td className="px-3 py-2 text-right">{b.stockValue != null ? formatCurrency(b.stockValue) : '—'}</td>
                            <td className="px-3 py-2">
                              <ErpStatusBadge status={st.status} label={st.label} />
                              {hint && <p className="mt-0.5 text-[9px] text-erp-text-muted">{hint}</p>}
                              {existingPr && (
                                <p className="mt-0.5 text-[9px] text-[var(--erp-accent)]">
                                  PR {existingPr.prNumber} · {existingPr.status.replace(/_/g, ' ')}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-[10px]">
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                {showPr && existingPr && (
                                  <ErpButton
                                    variant="secondary"
                                    className="!px-2 !py-1 text-[10px] opacity-90"
                                    disabled
                                    title={`Already requested as ${existingPr.prNumber}`}
                                  >
                                    <Check size={10} className="mr-1 inline" />
                                    Requested
                                  </ErpButton>
                                )}
                                {showPr && !existingPr && (
                                  <>
                                    <ErpInput
                                      type="number"
                                      min={1}
                                      title="Quantity to request on the purchase requisition"
                                      aria-label="Purchase request quantity"
                                      className="!w-14 !py-1 text-[10px]"
                                      value={prQty[b._id] ?? defaultPrQty}
                                      onChange={(e) => setPrQty({ ...prQty, [b._id]: Number(e.target.value) })}
                                    />
                                    <ErpButton
                                      className="!px-2 !py-1 text-[10px]"
                                      disabled={requestPurchase.isPending}
                                      onClick={() => promptRequestPurchase(b)}
                                    >
                                      <ShoppingCart size={10} className="mr-1 inline" />
                                      Request
                                    </ErpButton>
                                  </>
                                )}
                                <Link to={stockLocatorPath({ materialId })} className="text-[var(--erp-accent)]">Locate</Link>
                                {onDock && (b.available ?? 0) > 0 && canPutAway && (
                                  <Link to={putAwayPath(materialId)} className="ml-1 text-[var(--erp-accent)]">Put away</Link>
                                )}
                                {!onDock && (b.available ?? 0) > 0 && canPutAway && (
                                  <Link to={`/warehouse/operations/picking?materialId=${materialId}`} className="ml-1 text-[var(--erp-accent)]">Pick</Link>
                                )}
                                {canRequestPurchase && (
                                  <button
                                    type="button"
                                    className="ml-1 text-[var(--erp-accent)] hover:underline"
                                    onClick={() => navigate('/purchase')}
                                  >
                                    Purchase →
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {balances.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-erp-text-muted">
                            {tab === 'alerts' ? (
                              <>No stock alerts — all materials above reorder level</>
                            ) : (
                              <>No balances yet — receive via <Link to="/purchase" className="text-[var(--erp-accent)]">Purchase GRN</Link> + incoming QC</>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </ErpDataTable>
                </div>
              )}
              {stockMeta && stockMeta.totalPages > 0 && (
                <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2">
                  <p className="text-[10px] text-erp-text-muted">{stockMeta.page}/{stockMeta.totalPages} · {stockMeta.total} total</p>
                  <div className="flex gap-1">
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={stockPage <= 1} onClick={() => setStockPage((p) => p - 1)}>Prev</ErpButton>
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={stockPage >= stockMeta.totalPages} onClick={() => setStockPage((p) => p + 1)}>Next</ErpButton>
                  </div>
                </div>
              )}
            </ErpCard>
          </div>
        )}

        {tab === 'reservations' && (
          canUpdate ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <ErpCard className="!p-3">
              <h3 className="mb-2 text-[11px] font-semibold">Reserve stock</h3>
              <p className="mb-2 text-[10px] text-erp-text-muted">
                Ad-hoc holds only. Prefer <Link to="/samples" className="text-[var(--erp-accent)]">Samples → Reserve</Link> or{' '}
                <Link to="/production/orders" className="text-[var(--erp-accent)]">Production → Reserve</Link> for workflow reservations.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>Material</label>
                  <ErpSelect className="w-full !py-1.5 text-[11px]" value={reserveForm.materialId} onChange={(e) => setReserveForm((f) => ({ ...f, materialId: e.target.value }))}>
                    <option value="">Select…</option>
                    {materialsAll.map((m) => <option key={m._id} value={m._id}>{m.materialCode} — {m.name}</option>)}
                  </ErpSelect>
                  {reserveAvail && reserveForm.materialId && (
                    <p className={`mt-1 text-[10px] ${(reserveAvail.available ?? 0) < Number(reserveForm.quantity) ? 'text-amber-700' : 'text-erp-text-muted'}`}>
                      Available: {reserveAvail.available ?? 0} {unitLabel(reserveAvail.unit)}
                    </p>
                  )}
                </div>
                <div>
                  <label className={fieldLabel}>Quantity</label>
                  <ErpInput type="number" min={1} className="!py-1.5 text-[11px]" value={reserveForm.quantity} onChange={(e) => setReserveForm((f) => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className={fieldLabel}>Reference type</label>
                  <ErpSelect className="!py-1.5 text-[11px]" value={reserveForm.referenceType} onChange={(e) => setReserveForm((f) => ({ ...f, referenceType: e.target.value }))}>
                    {RESERVATION_REFERENCE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </ErpSelect>
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>Reference ID (sample or production order ObjectId)</label>
                  <ErpInput className="!py-1.5 font-mono text-[11px]" value={reserveForm.referenceId} onChange={(e) => setReserveForm((f) => ({ ...f, referenceId: e.target.value }))} placeholder="24-char document id" />
                </div>
                <ErpButton
                  className="sm:col-span-2 !py-1.5 text-[11px]"
                  disabled={!reserveForm.materialId || !reserveForm.referenceId || reserveStock.isPending}
                  onClick={() => {
                    const qty = Number(reserveForm.quantity);
                    if (!qty || qty <= 0) { setError('Enter a valid quantity'); return; }
                    const mat = materialsAll.find((m) => m._id === reserveForm.materialId);
                    promptConfirm(
                      'Reserve stock',
                      inventoryConfirmMessage('reserve', `${qty} ${unitLabel(mat?.unit)} for ${reserveForm.referenceType}`),
                      () => reserveStock.mutate(),
                    );
                  }}
                >
                  Reserve
                </ErpButton>
              </div>
            </ErpCard>
            <ErpCard className="!p-3">
              <h3 className="mb-2 text-[11px] font-semibold">Release reservations</h3>
              <p className="mb-2 text-[10px] text-erp-text-muted">Clears active holds for a sample or production order reference.</p>
              <div className="grid gap-2">
                <div>
                  <label className={fieldLabel}>Reference type</label>
                  <ErpSelect className="!py-1.5 text-[11px]" value={releaseForm.referenceType} onChange={(e) => setReleaseForm((f) => ({ ...f, referenceType: e.target.value }))}>
                    {RESERVATION_REFERENCE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </ErpSelect>
                </div>
                <div>
                  <label className={fieldLabel}>Reference ID</label>
                  <ErpInput className="!py-1.5 font-mono text-[11px]" value={releaseForm.referenceId} onChange={(e) => setReleaseForm((f) => ({ ...f, referenceId: e.target.value }))} />
                </div>
                <ErpButton
                  variant="secondary"
                  className="!py-1.5 text-[11px]"
                  disabled={!releaseForm.referenceId || releaseStock.isPending}
                  onClick={() => promptConfirm(
                    'Release reservations',
                    inventoryConfirmMessage('release'),
                    () => releaseStock.mutate(),
                  )}
                >
                  Release all for reference
                </ErpButton>
              </div>
            </ErpCard>
          </div>
          ) : (
            <ErpCard className="!p-4 text-[11px] text-erp-text-muted">
              Reserve and release require <code className="font-mono">inventory.update</code>. View active holds via stock balances (reserved column) and movement history.
            </ErpCard>
          )
        )}

        {tab === 'movements' && (
          <div className="space-y-3">
            <ErpCard className="!p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-40">
                  <label className={fieldLabel}>Type</label>
                  <ErpSelect className="!py-1.5 text-[11px]" value={txType} onChange={(e) => { setTxType(e.target.value); setTxPage(1); }}>
                    {TRANSACTION_TYPES.map((t) => <option key={t.value || 'all'} value={t.value}>{t.label}</option>)}
                  </ErpSelect>
                </div>
                <div className="min-w-[160px] flex-1">
                  <label className={fieldLabel}>Material</label>
                  <ErpSelect className="!py-1.5 text-[11px]" value={txMaterialId} onChange={(e) => { setTxMaterialId(e.target.value); setTxPage(1); }}>
                    <option value="">All materials</option>
                    {materialsAll.map((m) => <option key={m._id} value={m._id}>{m.materialCode}</option>)}
                  </ErpSelect>
                </div>
                <History size={14} className="mb-2 text-erp-text-muted" />
                <span className="mb-2 text-[10px] text-erp-text-muted">Receipts from QC, reservations from samples & production, transfers from warehouse</span>
              </div>
            </ErpCard>
            <ErpCard className="overflow-hidden !p-0">
              {txLoading ? (
                <p className="p-4 text-[11px] text-erp-text-muted">Loading movements…</p>
              ) : (
                <div className="overflow-x-auto">
                  <ErpDataTable className="w-full min-w-[900px] text-[11px]">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left">When</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Material</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-left">Reference</th>
                        <th className="px-3 py-2 text-left">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t: InventoryTransaction) => (
                        <tr key={t._id} className="border-t border-[var(--erp-border)]">
                          <td className="px-3 py-2 text-erp-text-muted">{formatDateTime(t.createdAt)}</td>
                          <td className="px-3 py-2">{transactionLabel(t.type)}</td>
                          <td className="px-3 py-2">{materialDisplayName(t.materialId as Material)}</td>
                          <td className="px-3 py-2 text-right">{t.quantity} {unitLabel(t.unit)}</td>
                          <td className="px-3 py-2 font-mono text-[10px] text-erp-text-muted">{transactionReferenceLabel(t)}</td>
                          <td className="px-3 py-2 text-erp-text-muted">{performerName(t.performedBy)}</td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-erp-text-muted">No movements yet — stock changes appear after GRN/QC, reserve, issue, or warehouse ops</td>
                        </tr>
                      )}
                    </tbody>
                  </ErpDataTable>
                </div>
              )}
              {txMeta && txMeta.totalPages > 0 && (
                <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2">
                  <p className="text-[10px] text-erp-text-muted">{txMeta.page}/{txMeta.totalPages} · {txMeta.total} total</p>
                  <div className="flex gap-1">
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={txPage <= 1} onClick={() => setTxPage((p) => p - 1)}>Prev</ErpButton>
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={txPage >= txMeta.totalPages} onClick={() => setTxPage((p) => p + 1)}>Next</ErpButton>
                  </div>
                </div>
              )}
            </ErpCard>
          </div>
        )}
      </div>
      </>
      )}

      <ConfirmDialog
        open={!!receiptConfirm}
        title="Manual receipt"
        message={receiptConfirm ? inventoryConfirmMessage('manualReceipt', `${receiptConfirm.label} (to dock)`) : ''}
        confirmLabel="Post receipt"
        loading={receipt.isPending}
        onCancel={() => setReceiptConfirm(null)}
        onConfirm={() => {
          if (!receiptConfirm) return;
          receipt.mutate(receiptConfirm);
        }}
      />
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message ?? 'Continue?'}
        confirmLabel="Yes"
        loading={reserveStock.isPending || releaseStock.isPending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.fn()}
      />

      {showAddMaterial && (
        <ModalShell onClose={closeAddMaterial} maxWidth="max-w-xl">
          <div className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface,var(--erp-header-bg,#fff))] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--erp-border)] px-4 py-3">
              <h3 className="text-sm font-semibold text-erp-text-primary">Add material</h3>
              <button
                type="button"
                className="rounded p-1 text-erp-text-muted hover:bg-[var(--erp-surface-muted)] hover:text-erp-text-primary"
                onClick={closeAddMaterial}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <form
              className="space-y-3 p-4"
              onSubmit={(e) => { e.preventDefault(); createMaterial.mutate(); }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <ErpButton
                  type="button"
                  variant="secondary"
                  className="inline-flex h-8 items-center !px-2.5 text-[11px]"
                  onClick={downloadImportTemplate}
                >
                  <Download className="mr-1 inline h-3.5 w-3.5" />
                  Template
                </ErpButton>
                <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-[var(--erp-border)] bg-white px-2.5 text-[11px] hover:bg-[var(--erp-surface-muted)]">
                  <Upload className="mr-1 inline h-3.5 w-3.5" />
                  {importBusy ? 'Reading…' : 'Upload Excel / CSV'}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    disabled={importBusy || runBulkImport.isPending}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = '';
                      void onPickImportFile(f);
                    }}
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={fieldLabel}>Code</label>
                  <ErpInput className="w-full !py-1.5 font-mono text-[11px]" value={form.materialCode} onChange={(e) => setForm({ ...form, materialCode: e.target.value })} required autoFocus />
                </div>
                <div>
                  <label className={fieldLabel}>Name</label>
                  <ErpInput className="w-full !py-1.5 text-[11px]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className={fieldLabel}>Category</label>
                  <ErpSelect className="w-full !py-1.5 text-[11px]" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {MATERIAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </ErpSelect>
                </div>
                <div>
                  <label className={fieldLabel}>Unit</label>
                  <ErpSelect className="w-full !py-1.5 text-[11px]" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {MATERIAL_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </ErpSelect>
                </div>
                <div>
                  <label className={fieldLabel}>Unit cost</label>
                  <ErpInput type="number" min={0} className="w-full !py-1.5 text-[11px]" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={fieldLabel}>Reorder at</label>
                  <ErpInput type="number" min={0} className="w-full !py-1.5 text-[11px]" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--erp-border)] pt-3">
                <ErpButton type="button" variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={closeAddMaterial} disabled={createMaterial.isPending}>
                  Cancel
                </ErpButton>
                <ErpButton type="submit" className="!px-3 !py-1.5 text-[11px]" disabled={createMaterial.isPending}>
                  {createMaterial.isPending ? 'Adding…' : 'Add'}
                </ErpButton>
              </div>
            </form>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
