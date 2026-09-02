import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowDownToLine, ArrowRight, Check, ClipboardList, Download, History, MapPin, Package, Pencil, RefreshCw, Search, ShoppingCart, Truck, Upload, Warehouse, X,
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
  performerName, putAwayPath, stockLocatorPath, stockWorkflowHint, suggestedPrQty,
  transactionReferenceLabel, unitLabel,
} from './inventoryUtils';
import {
  ActionStack, EmptyRow, InfoBanner, LocationPill, MaterialCell, StatTile,
  TabShell, TabToolbar, TablePager, TextLink, TxTypeBadge, btnSm, fieldLabel,
} from './inventoryLayout';
import { colorSwatch, designIdOf, designLabel, formatPrice, sampleLabel, statusLabel as skuStatusLabel } from '../sku/skuUtils';
import { downloadCsv } from '../../utils/csvExport';
import {
  materialsImportTemplateCsv, parseMaterialsUploadFile, type ImportMaterialRow,
} from './materialImport';
import { MaterialMasterRequestsTab } from './MaterialMasterRequestsTab';

const PAGE_SIZE = 20;
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
    <div className="inventory-page space-y-3">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Inventory"
        subtitle={scope === 'FINISHED_PRODUCT' ? (
          <>
            Finished SKUs available for production, warehouse, and dispatch.
            <Link to="/products/skus" className="ml-2 text-[var(--erp-accent)]">SKU master -&gt;</Link>
            <Link to="/warehouse/stock-locator?inventoryType=FINISHED_GOODS" className="ml-2 text-[var(--erp-accent)]">Find FG stock -&gt;</Link>
          </>
        ) : (
          'Raw material master, stock balances, alerts, movements, and reservations.'
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="whitespace-nowrap text-[11px] text-erp-text-muted">Type</span>
              <ErpSelect
                className="w-[170px] !py-1.5 text-[12px]"
                value={scope}
                onChange={(e) => selectScope(e.target.value as InventoryScope)}
              >
                <option value="RAW_MATERIAL">Raw materials</option>
                <option value="FINISHED_PRODUCT">Finished products</option>
              </ErpSelect>
            </div>
            {scope === 'RAW_MATERIAL' && canCreate && (
              <ErpButton
                className={btnSm}
                onClick={() => {
                  selectTab('materials');
                  setShowAddMaterial(true);
                }}
              >
                <Package size={13} className="mr-1 inline" /> Add material
              </ErpButton>
            )}
            {scope === 'RAW_MATERIAL' && canExport && balances.length > 0 && (
              <ErpButton variant="secondary" className={btnSm} onClick={() => downloadCsv('inventory-stock.csv', ['Location', 'Material', 'On hand', 'Reserved', 'Available', 'Unit'], balances.map((b) => [
                balanceLocationLabel(b),
                materialDisplayName(b.materialId),
                b.onHand,
                b.reserved,
                b.available,
                b.unit,
              ]))}>
                <Download size={13} className="mr-1 inline" /> Export CSV
              </ErpButton>
            )}
            <ErpButton
              variant="secondary"
              className={btnSm}
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
              <RefreshCw size={13} className={(scope === 'FINISHED_PRODUCT' ? fgSkuFetching : isFetching) ? 'animate-spin' : ''} />
              <span className="ml-1">Refresh</span>
            </ErpButton>
          </div>
        )}
      />

      {scope === 'FINISHED_PRODUCT' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--erp-border)] bg-[var(--erp-border)] sm:grid-cols-4">
            <StatTile icon={Package} label="Total SKUs" value={skuStats?.total ?? '-'} />
            <StatTile icon={Check} label="Active" value={skuStats?.active ?? '-'} />
            <StatTile icon={ClipboardList} label="Draft" value={skuStats?.draft ?? '-'} />
            <StatTile icon={Warehouse} label="FG locations" value={fgBalancesPage?.meta?.total ?? fgBalancesPage?.items?.length ?? '-'} />
          </div>

          {!canReadSkus ? (
            <ErpCard className="!p-4">
              <p className="text-[13px] text-erp-text-muted">Finished products need <code className="text-[12px]">sku.read</code> or inventory access.</p>
            </ErpCard>
          ) : (
            <ErpCard className="!p-0">
              <TabToolbar
                title="Finished SKUs"
                hint="On-hand and available are summed across warehouse locations."
              >
                <div className="relative min-w-[200px] flex-1">
                  <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-erp-text-muted" />
                  <ErpInput
                    className="!py-1.5 pl-8 text-[12px]"
                    placeholder="Search SKU code, name, design..."
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
                  className={btnSm}
                  onClick={() => { setFgSearch(fgSearchInput.trim()); setFgPage(1); }}
                >
                  Search
                </ErpButton>
                <Link to="/products/skus" className="mb-1 text-[12px] font-medium text-[var(--erp-accent)]">Manage SKUs -&gt;</Link>
              </TabToolbar>

              {fgSkuLoading ? (
                <p className="p-6 text-[13px] text-erp-text-muted">Loading finished SKUs...</p>
              ) : (
                <div className="overflow-x-auto">
                  <ErpDataTable className="w-full min-w-[1040px] text-[12px]">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Design</th>
                        <th>Sample</th>
                        <th>Size / Color</th>
                        <th>Price</th>
                        <th className="text-right">On hand</th>
                        <th className="text-right">Available</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fgSkus.map((s: Sku) => {
                        const stock = fgStockBySkuId.get(s._id);
                        return (
                          <tr key={s._id}>
                            <td>
                              <p className="font-mono text-[12px] font-medium">{s.skuCode}</p>
                              <p className="text-[12px] text-erp-text-muted">{s.name}</p>
                            </td>
                            <td>
                              {designIdOf(s) ? (
                                <Link to={`/designs/${designIdOf(s)}/edit`} className="text-[var(--erp-accent)] hover:underline">
                                  {designLabel(s.designId)}
                                </Link>
                              ) : '-'}
                            </td>
                            <td className="text-erp-text-muted">{sampleLabel(s.sampleId)}</td>
                            <td>{s.size} / {colorSwatch(s.color)}</td>
                            <td>{formatPrice(s.basePrice)}</td>
                            <td className="text-right font-mono">
                              {stock ? `${stock.onHand} ${stock.unit}` : '-'}
                            </td>
                            <td className="text-right font-mono">
                              {stock ? `${stock.available} ${stock.unit}` : '-'}
                            </td>
                            <td><ErpStatusBadge status={s.status} label={skuStatusLabel(s.status)} /></td>
                            <td className="text-right">
                              <ActionStack>
                                <TextLink to={stockLocatorPath({ inventoryType: 'FINISHED_GOODS', skuId: s._id, search: s.skuCode })}>
                                  Locate
                                </TextLink>
                                <TextLink to="/boms">BOM -&gt;</TextLink>
                              </ActionStack>
                            </td>
                          </tr>
                        );
                      })}
                      {fgSkus.length === 0 && (
                        <EmptyRow colSpan={9}>
                          No finished SKUs yet - create them from approved samples in{' '}
                          <Link to="/products/skus" className="text-[var(--erp-accent)]">Products -&gt; SKUs</Link>
                        </EmptyRow>
                      )}
                    </tbody>
                  </ErpDataTable>
                </div>
              )}

              {fgSkuMeta && (
                <TablePager
                  page={fgPage}
                  totalPages={fgSkuMeta.totalPages}
                  total={fgSkuMeta.total}
                  onPrev={() => setFgPage((p) => p - 1)}
                  onNext={() => setFgPage((p) => p + 1)}
                />
              )}
            </ErpCard>
          )}
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--erp-border)] bg-[var(--erp-border)] sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={Package} label="Materials" value={stats?.materialCount ?? '-'} />
        <StatTile icon={Warehouse} label="Stock value" value={stats ? formatCurrency(stats.stockValue ?? 0) : '-'} />
        <StatTile
          icon={Truck}
          label="Dock receipts"
          value={stats?.dockBalanceCount ?? '-'}
          hint={(stats?.dockOnHand ?? 0) > 0
            ? `${stats?.dockOnHand} units on unallocated dock`
            : 'QC-passed purchases land here'}
          highlight={(stats?.dockBalanceCount ?? 0) > 0 ? 'accent' : undefined}
          onClick={() => { selectTab('stock'); setStockPage(1); }}
        />
        <StatTile
          icon={AlertTriangle}
          label="Low / out"
          value={(stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0) || '-'}
          hint="Open Alerts to request purchase"
          highlight={(stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0) > 0 ? 'warn' : undefined}
          onClick={() => { selectTab('alerts'); setStockPage(1); }}
        />
        <StatTile icon={History} label="Reservations" value={stats?.activeReservations ?? '-'} />
      </div>

      {(stats?.pendingMasterRequests ?? 0) > 0 && tab !== 'requests' && (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-left text-[13px] text-amber-800"
          onClick={() => selectTab('requests')}
        >
          <ClipboardList size={15} />
          {stats?.pendingMasterRequests} fabric request{stats?.pendingMasterRequests === 1 ? '' : 's'} waiting for store approval
        </button>
      )}

      <TabShell
        tabs={(
          <ErpTabs
            tabs={[
              { id: 'materials', label: `Materials (${stats?.materialCount ?? '-'})` },
              {
                id: 'stock',
                label: (stats?.dockBalanceCount ?? 0) > 0
                  ? `Stock (${stats?.dockBalanceCount} on dock)`
                  : `Stock (${stats?.balanceCount ?? '-'})`,
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
        )}
      >
        {tab === 'requests' && <MaterialMasterRequestsTab canApprove={canCreate} />}
        {tab === 'materials' && (
          <div>
            {canCreate && showImport && importRows.length > 0 && (
              <div className="border-b border-[var(--erp-border)] px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-erp-text-primary">Import preview</h3>
                    <p className="text-[12px] text-erp-text-muted">
                      {importFileName} · {importRows.length} row(s) ready
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[12px] text-erp-text-muted">
                      <input
                        type="checkbox"
                        checked={postOpeningStock}
                        onChange={(e) => setPostOpeningStock(e.target.checked)}
                      />
                      Post opening stock
                    </label>
                    <ErpButton
                      variant="secondary"
                      className={btnSm}
                      onClick={() => { setShowImport(false); setImportRows([]); setImportFileName(''); }}
                    >
                      Cancel
                    </ErpButton>
                    <ErpButton
                      className={btnSm}
                      disabled={runBulkImport.isPending}
                      onClick={() => runBulkImport.mutate()}
                    >
                      {runBulkImport.isPending ? 'Importing...' : `Import ${importRows.length}`}
                    </ErpButton>
                  </div>
                </div>
                <div className="max-h-64 overflow-x-auto rounded-md border border-[var(--erp-border)]">
                  <ErpDataTable className="w-full min-w-[900px] text-[12px]">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Vendor</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th className="text-right">Cost</th>
                        <th className="text-right">Opening qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 40).map((r, i) => (
                        <tr key={`${r.materialCode}-${i}`}>
                          <td className="font-mono">{r.materialCode}</td>
                          <td>{r.name}</td>
                          <td className="text-erp-text-muted">{r.vendorName || '-'}</td>
                          <td>{r.category}</td>
                          <td>{r.unit}</td>
                          <td className="text-right">{r.unitCost || 0}</td>
                          <td className="text-right">{r.openingQty || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ErpDataTable>
                </div>
                {importRows.length > 40 && (
                  <p className="mt-2 text-[12px] text-erp-text-muted">Showing first 40 of {importRows.length} rows</p>
                )}
              </div>
            )}

            {!canCreate && (
              <InfoBanner>
                Material master create needs <code>inventory.create</code>
                {' '}(Factory Admin, Inventory Sub Admin, Inventory Manager, or Store Keeper).
                {canUpdate
                  ? ' You can post stock with Manual on existing materials, or use Purchase GRN -&gt; incoming QC.'
                  : ' This role is read-only on inventory.'}
              </InfoBanner>
            )}

            <TabToolbar
              title="Material master"
              hint="Codes used on purchase requisitions, BOMs, and stock receipts."
            >
              <div className="min-w-[180px]">
                <label className={fieldLabel}>Search</label>
                <div className="relative">
                  <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-erp-text-muted" />
                  <ErpInput
                    className="!py-1.5 !pl-8 text-[12px]"
                    placeholder="Code or name..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput.trim()); setMatPage(1); } }}
                  />
                </div>
              </div>
              <div className="w-36">
                <label className={fieldLabel}>Category</label>
                <ErpSelect className="!py-1.5 text-[12px]" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setMatPage(1); }}>
                  <option value="">All</option>
                  {MATERIAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </ErpSelect>
              </div>
              <ErpButton variant="secondary" className={btnSm} onClick={() => { setSearch(searchInput.trim()); setMatPage(1); }}>Search</ErpButton>
            </TabToolbar>

            {materialsLoading ? (
              <p className="p-6 text-[13px] text-erp-text-muted">Loading materials...</p>
            ) : (
              <div className="overflow-x-auto">
                <ErpDataTable className="w-full min-w-[980px] text-[12px]">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Reorder</th>
                      {canUpdate && <th className="text-right">Manual receipt</th>}
                      {canUpdate && <th className="text-right">Edit</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m: Material) => (
                      <tr key={m._id}>
                        <td>
                          <p className="font-mono text-[12px] font-medium text-erp-text-primary">{m.materialCode}</p>
                          <p className="text-[12px] text-erp-text-muted">{m.name}</p>
                        </td>
                        <td className="text-erp-text-muted">{categoryLabel(m.category)}</td>
                        <td>{unitLabel(m.unit)}</td>
                        <td className="text-right">{formatCurrency(m.unitCost || 0)}</td>
                        <td className="text-right">{m.reorderLevel ?? 0}</td>
                        {canUpdate && (
                          <td className="text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <ErpInput
                                type="number"
                                min={1}
                                title="Quantity for Manual receipt (opening stock / correction)"
                                aria-label="Manual receipt quantity"
                                className="!w-[4.5rem] !py-1 text-[12px]"
                                value={receiptQty[m._id] ?? 100}
                                onChange={(e) => setReceiptQty({ ...receiptQty, [m._id]: Number(e.target.value) })}
                              />
                              <ErpButton
                                variant="secondary"
                                className={btnSm}
                                title="Post manual stock receipt using the quantity in the box"
                                onClick={() => setReceiptConfirm({
                                  materialId: m._id,
                                  quantity: receiptQty[m._id] ?? 100,
                                  unit: m.unit,
                                  label: `${m.materialCode} - ${receiptQty[m._id] ?? 100} ${unitLabel(m.unit)}`,
                                })}
                              >
                                <ArrowDownToLine size={12} className="mr-1 inline" />Post
                              </ErpButton>
                            </div>
                          </td>
                        )}
                        {canUpdate && (
                          <td className="text-right">
                            <ErpButton variant="secondary" className={btnSm} onClick={() => startEdit(m)}>
                              <Pencil size={12} className="mr-1 inline" />Edit
                            </ErpButton>
                          </td>
                        )}
                      </tr>
                    ))}
                    {materials.length === 0 && (
                      <EmptyRow colSpan={canUpdate ? 7 : 5}>
                        {canCreate
                          ? 'No materials yet - use Add material, then Manual receipt to post opening stock.'
                          : 'No materials yet. Ask Factory Admin / Inventory Sub Admin / Inventory Manager / Store Keeper to create the material master first.'}
                      </EmptyRow>
                    )}
                  </tbody>
                </ErpDataTable>
              </div>
            )}
            {matMeta && (
              <TablePager
                page={matPage}
                totalPages={matMeta.totalPages}
                total={matMeta.total}
                onPrev={() => setMatPage((p) => p - 1)}
                onNext={() => setMatPage((p) => p + 1)}
              />
            )}
          </div>
        )}

        {(tab === 'stock' || tab === 'alerts') && (
          <div>
            <TabToolbar
              title={tab === 'alerts' ? 'Stock alerts' : 'Stock balances'}
              hint={tab === 'alerts'
                ? 'Materials below reorder level or with zero available.'
                : 'Balances by dock or bin. Put away dock receipts in Warehouse.'}
            >
              <div className="min-w-[200px]">
                <label className={fieldLabel}>Filter</label>
                <ErpInput
                  className="!py-1.5 text-[12px]"
                  placeholder="Material code or name..."
                  value={stockSearch}
                  onChange={(e) => { setStockSearch(e.target.value); setStockPage(1); }}
                />
              </div>
              {canRequestPurchase && (
                <button
                  type="button"
                  className="mb-0.5 text-[12px] font-medium text-[var(--erp-accent)] hover:underline"
                  onClick={() => navigate('/purchase')}
                >
                  Open Purchase -&gt;
                </button>
              )}
            </TabToolbar>

            {tab === 'stock' && !materialsLoading && (stats?.materialCount ?? 0) === 0 && (
              <InfoBanner>
                No materials or stock yet. Create a material master first, then post stock with Manual receipt (or Purchase -&gt; GRN -&gt; QC).
                {canCreate && (
                  <button type="button" className="font-medium text-[var(--erp-accent)] hover:underline" onClick={() => selectTab('materials')}>
                    Go to Materials -&gt;
                  </button>
                )}
              </InfoBanner>
            )}
            {tab === 'stock' && balances.some((b) => !b.storageBinId && (b.available ?? 0) > 0) && (
              <InfoBanner tone="accent" icon={<Truck size={14} className="text-[var(--erp-accent)]" />}>
                <span className="flex flex-wrap items-center gap-1">
                  {RM_POST_QC_FLOW.map((step, i) => (
                    <span key={step.id} className="flex items-center gap-1">
                      {i > 0 && <ArrowRight size={11} className="text-erp-text-muted" />}
                      <span
                        className={`rounded px-1.5 py-0.5 ${step.id === 'dock' ? 'bg-white/70 font-medium' : 'text-erp-text-muted'}`}
                        title={step.detail}
                      >
                        {step.label}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="text-erp-text-muted">
                  {balances.filter((b) => !b.storageBinId && (b.available ?? 0) > 0).length} material(s) on dock - use Put away in the Warehouse column.
                </span>
              </InfoBanner>
            )}
            {tab === 'alerts' && (stats?.dockBalanceCount ?? 0) > 0 && (
              <InfoBanner tone="accent" icon={<Package size={14} className="text-[var(--erp-accent)]" />}>
                {(stats?.dockBalanceCount ?? 0)} material(s) with new QC stock on the dock
                {(stats?.dockOnHand ?? 0) > 0 ? ` (${stats?.dockOnHand} units)` : ''}.
                <button type="button" className="font-medium text-[var(--erp-accent)] hover:underline" onClick={() => selectTab('stock')}>
                  View Stock -&gt;
                </button>
              </InfoBanner>
            )}
            {tab === 'alerts' && (stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0) > 0 && (
              <InfoBanner tone="warn" icon={<AlertTriangle size={14} />}>
                Set quantity on a row, then Request purchase (creates and submits a PR).
                {!canRequestPurchase && (
                  <Link to="/purchase" className="font-medium text-[var(--erp-accent)]">Open Purchase -&gt;</Link>
                )}
              </InfoBanner>
            )}

            {stockLoading ? (
              <p className="p-6 text-[13px] text-erp-text-muted">Loading stock...</p>
            ) : (
              <div className="overflow-x-auto">
                <ErpDataTable className="w-full min-w-[1080px] text-[12px]">
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>Material</th>
                      <th className="text-right">On hand</th>
                      <th className="text-right">Reserved</th>
                      <th className="text-right">Available</th>
                      <th className="text-right">Reorder</th>
                      <th className="text-right">Value</th>
                      <th>Status</th>
                      <th className="text-right">Purchase</th>
                      <th className="text-right">Warehouse</th>
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
                          className={needsPurchase(b) ? 'bg-amber-500/5' : ''}
                          title={hint || undefined}
                        >
                          <td>
                            <LocationPill label={balanceLocationLabel(b)} onDock={onDock} />
                          </td>
                          <td><MaterialCell materialId={b.materialId} /></td>
                          <td className="whitespace-nowrap text-right">{b.onHand} {unitLabel(b.unit)}</td>
                          <td className="text-right text-erp-text-muted">{b.reserved}</td>
                          <td className="text-right font-medium">{b.available}</td>
                          <td className="text-right text-erp-text-muted">{b.reorderLevel ?? '-'}</td>
                          <td className="text-right">{b.stockValue != null ? formatCurrency(b.stockValue) : '-'}</td>
                          <td>
                            <ErpStatusBadge status={st.status} label={st.label} />
                            {existingPr && (
                              <p className="mt-1 text-[11px] text-[var(--erp-accent)]">
                                PR {existingPr.prNumber} · {existingPr.status.replace(/_/g, ' ')}
                              </p>
                            )}
                          </td>
                          <td className="text-right">
                            {showPr && existingPr && (
                              <ErpButton
                                variant="secondary"
                                className={`${btnSm} opacity-90`}
                                disabled
                                title={`Already requested as ${existingPr.prNumber}`}
                              >
                                <Check size={12} className="mr-1 inline" />
                                Requested
                              </ErpButton>
                            )}
                            {showPr && !existingPr && (
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <ErpInput
                                  type="number"
                                  min={1}
                                  title="Quantity to request on the purchase requisition"
                                  aria-label="Purchase request quantity"
                                  className="!w-[4.5rem] !py-1 text-[12px]"
                                  value={prQty[b._id] ?? defaultPrQty}
                                  onChange={(e) => setPrQty({ ...prQty, [b._id]: Number(e.target.value) })}
                                />
                                <ErpButton
                                  className={btnSm}
                                  disabled={requestPurchase.isPending}
                                  onClick={() => promptRequestPurchase(b)}
                                >
                                  <ShoppingCart size={12} className="mr-1 inline" />
                                  Request
                                </ErpButton>
                              </div>
                            )}
                            {!showPr && <span className="text-erp-text-muted">-</span>}
                          </td>
                          <td className="text-right">
                            <ActionStack>
                              <TextLink to={stockLocatorPath({ materialId })}>
                                <MapPin size={11} className="mr-0.5 inline" />Locate
                              </TextLink>
                              {onDock && (b.available ?? 0) > 0 && canPutAway && (
                                <TextLink to={putAwayPath(materialId)}>Put away</TextLink>
                              )}
                              {!onDock && (b.available ?? 0) > 0 && canPutAway && (
                                <TextLink to={`/warehouse/operations/picking?materialId=${materialId}`}>Pick</TextLink>
                              )}
                            </ActionStack>
                          </td>
                        </tr>
                      );
                    })}
                    {balances.length === 0 && (
                      <EmptyRow colSpan={10}>
                        {tab === 'alerts' ? (
                          <>No stock alerts - all materials above reorder level</>
                        ) : (
                          <>No balances yet - receive via <Link to="/purchase" className="text-[var(--erp-accent)]">Purchase GRN</Link> + incoming QC</>
                        )}
                      </EmptyRow>
                    )}
                  </tbody>
                </ErpDataTable>
              </div>
            )}
            {stockMeta && (
              <TablePager
                page={stockPage}
                totalPages={stockMeta.totalPages}
                total={stockMeta.total}
                onPrev={() => setStockPage((p) => p - 1)}
                onNext={() => setStockPage((p) => p + 1)}
              />
            )}
          </div>
        )}

        {tab === 'reservations' && (
          canUpdate ? (
          <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-[var(--erp-border)]">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-erp-text-primary">Reserve stock</h3>
              <p className="mt-1 mb-4 text-[12px] leading-relaxed text-erp-text-muted">
                Ad-hoc holds only. Prefer{' '}
                <Link to="/samples" className="text-[var(--erp-accent)]">Samples -&gt; Reserve</Link>
                {' '}or{' '}
                <Link to="/production/orders" className="text-[var(--erp-accent)]">Production -&gt; Reserve</Link>
                {' '}for workflow reservations.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>Material</label>
                  <ErpSelect className="w-full !py-1.5 text-[12px]" value={reserveForm.materialId} onChange={(e) => setReserveForm((f) => ({ ...f, materialId: e.target.value }))}>
                    <option value="">Select...</option>
                    {materialsAll.map((m) => <option key={m._id} value={m._id}>{m.materialCode} - {m.name}</option>)}
                  </ErpSelect>
                  {reserveAvail && reserveForm.materialId && (
                    <p className={`mt-1.5 text-[12px] ${(reserveAvail.available ?? 0) < Number(reserveForm.quantity) ? 'text-amber-700' : 'text-erp-text-muted'}`}>
                      Available: {reserveAvail.available ?? 0} {unitLabel(reserveAvail.unit)}
                    </p>
                  )}
                </div>
                <div>
                  <label className={fieldLabel}>Quantity</label>
                  <ErpInput type="number" min={1} className="!py-1.5 text-[12px]" value={reserveForm.quantity} onChange={(e) => setReserveForm((f) => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className={fieldLabel}>Reference type</label>
                  <ErpSelect className="!py-1.5 text-[12px]" value={reserveForm.referenceType} onChange={(e) => setReserveForm((f) => ({ ...f, referenceType: e.target.value }))}>
                    {RESERVATION_REFERENCE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </ErpSelect>
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>Reference ID</label>
                  <ErpInput className="!py-1.5 font-mono text-[12px]" value={reserveForm.referenceId} onChange={(e) => setReserveForm((f) => ({ ...f, referenceId: e.target.value }))} placeholder="Sample or production order document id" />
                </div>
                <ErpButton
                  className={`sm:col-span-2 ${btnSm}`}
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
            </div>
            <div className="border-t border-[var(--erp-border)] p-4 lg:border-t-0">
              <h3 className="text-sm font-semibold text-erp-text-primary">Release reservations</h3>
              <p className="mt-1 mb-4 text-[12px] leading-relaxed text-erp-text-muted">Clears active holds for a sample or production order reference.</p>
              <div className="grid gap-3">
                <div>
                  <label className={fieldLabel}>Reference type</label>
                  <ErpSelect className="!py-1.5 text-[12px]" value={releaseForm.referenceType} onChange={(e) => setReleaseForm((f) => ({ ...f, referenceType: e.target.value }))}>
                    {RESERVATION_REFERENCE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </ErpSelect>
                </div>
                <div>
                  <label className={fieldLabel}>Reference ID</label>
                  <ErpInput className="!py-1.5 font-mono text-[12px]" value={releaseForm.referenceId} onChange={(e) => setReleaseForm((f) => ({ ...f, referenceId: e.target.value }))} />
                </div>
                <ErpButton
                  variant="secondary"
                  className={btnSm}
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
            </div>
          </div>
          ) : (
            <p className="p-6 text-[13px] text-erp-text-muted">
              Reserve and release require <code className="font-mono">inventory.update</code>. View active holds via stock balances (reserved column) and movement history.
            </p>
          )
        )}

        {tab === 'movements' && (
          <div>
            <TabToolbar
              title="Movement history"
              hint="Receipts from QC, reservations from samples and production, transfers from warehouse."
            >
              <div className="w-40">
                <label className={fieldLabel}>Type</label>
                <ErpSelect className="!py-1.5 text-[12px]" value={txType} onChange={(e) => { setTxType(e.target.value); setTxPage(1); }}>
                  {TRANSACTION_TYPES.map((t) => <option key={t.value || 'all'} value={t.value}>{t.label}</option>)}
                </ErpSelect>
              </div>
              <div className="min-w-[160px]">
                <label className={fieldLabel}>Material</label>
                <ErpSelect className="!py-1.5 text-[12px]" value={txMaterialId} onChange={(e) => { setTxMaterialId(e.target.value); setTxPage(1); }}>
                  <option value="">All materials</option>
                  {materialsAll.map((m) => <option key={m._id} value={m._id}>{m.materialCode}</option>)}
                </ErpSelect>
              </div>
            </TabToolbar>
            {txLoading ? (
              <p className="p-6 text-[13px] text-erp-text-muted">Loading movements...</p>
            ) : (
              <div className="overflow-x-auto">
                <ErpDataTable className="w-full min-w-[900px] text-[12px]">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>Material</th>
                      <th className="text-right">Qty</th>
                      <th>Reference</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t: InventoryTransaction) => {
                      const inbound = t.type === 'RECEIPT' || t.type === 'RESERVATION_RELEASE';
                      const outbound = t.type === 'ISSUE' || t.type === 'RESERVATION';
                      return (
                        <tr key={t._id}>
                          <td className="whitespace-nowrap text-erp-text-muted">{formatDateTime(t.createdAt)}</td>
                          <td><TxTypeBadge type={t.type} /></td>
                          <td><MaterialCell materialId={t.materialId as Material} /></td>
                          <td className={`text-right font-medium ${inbound ? 'text-emerald-700' : outbound ? 'text-red-700' : ''}`}>
                            {inbound ? '+' : outbound ? '-' : ''}{t.quantity} {unitLabel(t.unit)}
                          </td>
                          <td className="font-mono text-[11px] text-erp-text-muted">{transactionReferenceLabel(t)}</td>
                          <td className="text-erp-text-muted">{performerName(t.performedBy)}</td>
                        </tr>
                      );
                    })}
                    {transactions.length === 0 && (
                      <EmptyRow colSpan={6}>
                        No movements yet - stock changes appear after GRN/QC, reserve, issue, or warehouse ops
                      </EmptyRow>
                    )}
                  </tbody>
                </ErpDataTable>
              </div>
            )}
            {txMeta && (
              <TablePager
                page={txPage}
                totalPages={txMeta.totalPages}
                total={txMeta.total}
                onPrev={() => setTxPage((p) => p - 1)}
                onNext={() => setTxPage((p) => p + 1)}
              />
            )}
          </div>
        )}
      </TabShell>
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

      {editId && (
        <ModalShell onClose={() => setEditId(null)} maxWidth="max-w-md">
          <div className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface,var(--erp-header-bg,#fff))] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--erp-border)] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-erp-text-primary">Edit material</h3>
                <p className="mt-0.5 font-mono text-[12px] text-erp-text-muted">
                  {materials.find((m) => m._id === editId)?.materialCode}
                  {' '}
                  {materials.find((m) => m._id === editId)?.name}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-erp-text-muted hover:bg-[var(--erp-surface-muted)] hover:text-erp-text-primary"
                onClick={() => setEditId(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabel}>Unit cost</label>
                <ErpInput className="!py-1.5 text-[12px]" type="number" min={0} value={editForm.unitCost} onChange={(e) => setEditForm((f) => ({ ...f, unitCost: e.target.value }))} />
              </div>
              <div>
                <label className={fieldLabel}>Reorder level</label>
                <ErpInput className="!py-1.5 text-[12px]" type="number" min={0} value={editForm.reorderLevel} onChange={(e) => setEditForm((f) => ({ ...f, reorderLevel: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--erp-border)] px-4 py-3">
              <ErpButton variant="secondary" className={btnSm} onClick={() => setEditId(null)}>Cancel</ErpButton>
              <ErpButton className={btnSm} disabled={updateMaterial.isPending} onClick={() => updateMaterial.mutate(editId)}>
                {updateMaterial.isPending ? 'Saving...' : 'Save'}
              </ErpButton>
            </div>
          </div>
        </ModalShell>
      )}

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
                  {importBusy ? 'Reading...' : 'Upload Excel / CSV'}
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
                  <ErpInput className="w-full !py-1.5 font-mono text-[12px]" value={form.materialCode} onChange={(e) => setForm({ ...form, materialCode: e.target.value })} required autoFocus />
                </div>
                <div>
                  <label className={fieldLabel}>Name</label>
                  <ErpInput className="w-full !py-1.5 text-[12px]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className={fieldLabel}>Category</label>
                  <ErpSelect className="w-full !py-1.5 text-[12px]" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {MATERIAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </ErpSelect>
                </div>
                <div>
                  <label className={fieldLabel}>Unit</label>
                  <ErpSelect className="w-full !py-1.5 text-[12px]" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {MATERIAL_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </ErpSelect>
                </div>
                <div>
                  <label className={fieldLabel}>Unit cost</label>
                  <ErpInput type="number" min={0} className="w-full !py-1.5 text-[12px]" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={fieldLabel}>Reorder at</label>
                  <ErpInput type="number" min={0} className="w-full !py-1.5 text-[12px]" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--erp-border)] pt-3">
                <ErpButton type="button" variant="secondary" className={btnSm} onClick={closeAddMaterial} disabled={createMaterial.isPending}>
                  Cancel
                </ErpButton>
                <ErpButton type="submit" className={btnSm} disabled={createMaterial.isPending}>
                  {createMaterial.isPending ? 'Adding...' : 'Add'}
                </ErpButton>
              </div>
            </form>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
