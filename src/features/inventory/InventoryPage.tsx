import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowDownToLine, FileSpreadsheet, IndianRupee, Lock, MoreHorizontal, Plus, Truck,
} from 'lucide-react';
import { inventoryApi } from '../../services/manufacturing';
import type { Material } from '../../types/api';
import {
  Button, DropdownMenu, InfoBanner, KpiGrid, PageHeader, Section, StatTile, Tabs,
} from '../../components/erp';
import { formatCurrency } from './inventoryUtils';
import { useInventoryPerms } from './inventoryLayout';
import { MaterialsTab } from './MaterialsTab';
import { StockTab } from './StockTab';
import { MovementsTab } from './MovementsTab';
import { ReservationsTab, ReserveDrawer } from './ReservationsTab';
import { FinishedGoodsView } from './FinishedGoodsView';
import { MaterialMasterRequestsTab } from './MaterialMasterRequestsTab';
import { ImportMaterialsDrawer, ManualReceiptModal, MaterialFormDrawer } from './MaterialForms';

const compactInr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });

type TabId = 'stock' | 'alerts' | 'materials' | 'reservations' | 'movements' | 'requests';
type InventoryScope = 'RAW_MATERIAL' | 'FINISHED_PRODUCT';
const TAB_IDS: TabId[] = ['stock', 'alerts', 'materials', 'reservations', 'movements', 'requests'];

function scopeFromParams(p: URLSearchParams): InventoryScope {
  return p.get('inventoryType') === 'FINISHED_GOODS' || p.get('view') === 'finished' ? 'FINISHED_PRODUCT' : 'RAW_MATERIAL';
}

function ScopeSwitch({ value, onChange }: { value: InventoryScope; onChange: (v: InventoryScope) => void }) {
  const opts: Array<{ id: InventoryScope; label: string }> = [
    { id: 'RAW_MATERIAL', label: 'Raw materials' },
    { id: 'FINISHED_PRODUCT', label: 'Finished goods' },
  ];
  return (
    <div role="group" aria-label="Inventory type" className="inline-flex rounded-md border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] p-0.5">
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={`min-h-8 rounded-[5px] px-3 text-[13px] font-medium transition-colors ${
              on ? 'bg-[var(--erp-surface)] text-erp-text-primary shadow-erp-xs' : 'text-erp-text-muted hover:text-erp-text-primary'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function InventoryPage() {
  const perms = useInventoryPerms();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scope, setScope] = useState<InventoryScope>(() => scopeFromParams(searchParams));
  const [tab, setTab] = useState<TabId>(() => {
    const t = searchParams.get('tab') as TabId | null;
    if (t && TAB_IDS.includes(t)) return t;
    // Store keepers land on Stock so post-QC dock receipts are visible.
    return perms.canRequestPurchase ? 'stock' : 'materials';
  });

  const [movementMaterial, setMovementMaterial] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [materialForm, setMaterialForm] = useState<{ open: boolean; material?: Material | null }>({ open: false });
  const [importOpen, setImportOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ open: boolean; materialId?: string }>({ open: false });
  const [reserve, setReserve] = useState<{ open: boolean; materialId?: string }>({ open: false });

  // Follow deep links (?tab=alerts, ?inventoryType=FINISHED_GOODS) from other modules.
  useEffect(() => {
    const t = searchParams.get('tab') as TabId | null;
    if (t && TAB_IDS.includes(t)) setTab(t);
    setScope(scopeFromParams(searchParams));
  }, [searchParams]);

  const { data: stats } = useQuery({ queryKey: ['inventory-stats'], queryFn: () => inventoryApi.stats() });

  const selectScope = (next: InventoryScope) => {
    setScope(next);
    const p = new URLSearchParams(searchParams);
    if (next === 'FINISHED_PRODUCT') {
      p.set('view', 'finished');
      p.set('inventoryType', 'FINISHED_GOODS');
      p.delete('tab');
    } else {
      p.delete('view');
      p.delete('inventoryType');
    }
    setSearchParams(p, { replace: true });
  };

  const selectTab = (id: TabId) => {
    setTab(id);
    const p = new URLSearchParams(searchParams);
    p.delete('view');
    p.delete('inventoryType');
    p.set('tab', id);
    setSearchParams(p, { replace: true });
  };

  const openMovements = (materialId: string) => {
    setMovementMaterial(materialId);
    selectTab('movements');
  };

  const lowOut = (stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0);
  const pendingRequests = stats?.pendingMasterRequests ?? 0;
  const raw = scope === 'RAW_MATERIAL';

  const primaryAction = !raw ? null
    : tab === 'reservations'
      ? (perms.canUpdate ? <Button icon={<Lock size={16} />} onClick={() => setReserve({ open: true })}>Reserve stock</Button> : null)
      : (perms.canCreate ? <Button icon={<Plus size={16} />} onClick={() => setMaterialForm({ open: true })}>Add material</Button> : null);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        description={raw
          ? 'Raw materials you stock, where they are and what needs reordering.'
          : 'Finished SKUs and how many are available to ship.'}
        secondaryActions={(
          <>
            <ScopeSwitch value={scope} onChange={selectScope} />
            {raw && (perms.canCreate || perms.canUpdate) && (
              <DropdownMenu
                label="More inventory actions"
                trigger={<Button variant="secondary" icon={<MoreHorizontal size={16} />}>More</Button>}
                items={[
                  { label: 'Import materials from Excel', icon: FileSpreadsheet, hidden: !perms.canCreate, onSelect: () => setImportOpen(true) },
                  { label: 'Manual stock receipt', icon: ArrowDownToLine, hidden: !perms.canUpdate, onSelect: () => setReceipt({ open: true }) },
                  { label: 'Reserve stock', icon: Lock, hidden: !perms.canUpdate || tab === 'reservations', onSelect: () => setReserve({ open: true }) },
                ]}
              />
            )}
          </>
        )}
        primaryAction={primaryAction}
      />

      {!raw ? (
        <FinishedGoodsView canRead={perms.canReadSkus} />
      ) : (
        <>
          <KpiGrid cols={4}>
            <StatTile
              icon={AlertTriangle}
              label="Low stock"
              value={stats ? lowOut : '—'}
              hint={lowOut > 0 ? 'Below reorder level — request purchase' : 'All above reorder level'}
              highlight={lowOut > 0 ? 'warn' : undefined}
              active={tab === 'alerts'}
              onClick={() => selectTab('alerts')}
            />
            <StatTile
              icon={Truck}
              label="On the dock"
              value={stats?.dockBalanceCount ?? '—'}
              hint={(stats?.dockBalanceCount ?? 0) > 0 ? 'Materials waiting for a bin' : 'QC-passed goods land here'}
              active={tab === 'stock'}
              onClick={() => selectTab('stock')}
            />
            <StatTile
              icon={Lock}
              label="Reserved"
              value={stats?.activeReservations ?? '—'}
              hint="Samples, production and manual holds"
              active={tab === 'reservations'}
              onClick={() => selectTab('reservations')}
            />
            <StatTile
              icon={IndianRupee}
              label="Stock value"
              value={stats ? compactInr.format(stats.stockValue ?? 0) : '—'}
              hint={stats ? `${formatCurrency(stats.stockValue ?? 0)} · ${stats.materialCount ?? 0} materials` : undefined}
            />
          </KpiGrid>

          {pendingRequests > 0 && tab !== 'requests' && perms.canCreate && (
            <InfoBanner
              inset={false}
              tone="warn"
              action={<Button size="sm" variant="secondary" onClick={() => selectTab('requests')}>Review</Button>}
            >
              {pendingRequests} fabric request{pendingRequests === 1 ? ' is' : 's are'} waiting for the store to approve.
            </InfoBanner>
          )}

          <Section flush>
            <div className="px-3">
              <Tabs
                ariaLabel="Inventory sections"
                className="!mb-0"
                active={tab}
                onChange={(id) => selectTab(id as TabId)}
                tabs={[
                  { id: 'stock', label: 'Stock', count: stats?.balanceCount },
                  { id: 'alerts', label: 'Alerts', count: stats ? lowOut : undefined },
                  { id: 'materials', label: 'Materials', count: stats?.materialCount },
                  { id: 'reservations', label: 'Manual holds' },
                  { id: 'movements', label: 'Movements' },
                  { id: 'requests', label: 'Fabric requests', count: pendingRequests || undefined },
                ]}
              />
            </div>

            {(tab === 'stock' || tab === 'alerts') && (
              <StockTab
                key={tab}
                perms={perms}
                alertsOnly={tab === 'alerts'}
                materialCount={stats?.materialCount}
                dockCount={stats?.dockBalanceCount}
                onAddMaterial={() => setMaterialForm({ open: true })}
                onReceive={(id) => setReceipt({ open: true, materialId: id })}
                onReserve={(id) => setReserve({ open: true, materialId: id })}
                onMovements={openMovements}
              />
            )}
            {tab === 'materials' && (
              <MaterialsTab
                perms={perms}
                highlightId={highlightId}
                onAdd={() => setMaterialForm({ open: true })}
                onEdit={(m) => setMaterialForm({ open: true, material: m })}
                onReceive={(id) => setReceipt({ open: true, materialId: id })}
                onMovements={openMovements}
              />
            )}
            {tab === 'reservations' && <ReservationsTab perms={perms} onReserve={() => setReserve({ open: true })} />}
            {tab === 'movements' && <MovementsTab materialId={movementMaterial} onMaterial={setMovementMaterial} />}
            {tab === 'requests' && <MaterialMasterRequestsTab canApprove={perms.canCreate} />}
          </Section>
        </>
      )}

      <MaterialFormDrawer
        open={materialForm.open}
        material={materialForm.material}
        onClose={() => setMaterialForm({ open: false })}
        onImport={() => { setMaterialForm({ open: false }); setImportOpen(true); }}
        onSaved={(m) => {
          if (!materialForm.material) {
            selectTab('materials');
            setHighlightId(m._id);
            window.setTimeout(() => setHighlightId((cur) => (cur === m._id ? null : cur)), 5000);
          }
        }}
      />
      <ImportMaterialsDrawer open={importOpen} onClose={() => setImportOpen(false)} />
      <ManualReceiptModal open={receipt.open} initialMaterialId={receipt.materialId} onClose={() => setReceipt({ open: false })} />
      <ReserveDrawer open={reserve.open} initialMaterialId={reserve.materialId} onClose={() => setReserve({ open: false })} />
    </div>
  );
}
