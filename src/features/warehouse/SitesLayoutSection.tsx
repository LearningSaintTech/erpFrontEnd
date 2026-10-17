import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes, ChevronDown, ChevronRight, Layers, MapPin, Package, Plus, RefreshCw, Rows3, Scan, Search, Warehouse as WhIcon,
} from 'lucide-react';
import { warehouseApi } from '../../services/operations';
import { inventoryApi } from '../../services/manufacturing';
import type { Material, StorageBin, Warehouse } from '../../types/api';
import type { WarehouseRack, WarehouseZone } from '../../types/api.extended';
import {
  Badge, Button, Drawer, DropdownMenu, EmptyRow, EmptyState, ErpDataTable, ErpInput, ErpSelect, Field, IconButton,
  PageHeader, SearchInput, Section, Skeleton, StatusBadge, TablePager, TableSkeleton, toast, useConfirm,
} from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  binLabel, materialLabel, materialRowId, skuLabel, statusLabel, transferableQty, unallocatedBalance, warehouseTypeLabel,
} from './warehouseUtils';
import { QueryErrorRow } from '../production/QueryErrorRow';

const PAGE_SIZE = 20;
const STOCK_PAGE_SIZE = 12;

type AddKind = 'warehouse' | 'zone' | 'rack' | 'shelf' | 'bin';
type Errors = Record<string, string>;

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

type Zone = WarehouseZone & { bins?: StorageBin[]; racks?: WarehouseRack[] };

function sortCode(a: string, b: string) {
  const na = a.match(/\d+/);
  const nb = b.match(/\d+/);
  if (na && nb && a.replace(na[0], '') === b.replace(nb[0], '')) return Number(na[0]) - Number(nb[0]);
  return a.localeCompare(b);
}

const ADD_META: Record<AddKind, { title: string; description: string; save: string }> = {
  warehouse: { title: 'New warehouse', description: 'A site that holds raw material, WIP or finished goods.', save: 'Create warehouse' },
  zone: { title: 'New zone', description: 'An area inside the warehouse, e.g. a floor or a room.', save: 'Create zone' },
  rack: { title: 'New rack', description: 'A rack inside a zone.', save: 'Create rack' },
  shelf: { title: 'New shelf', description: 'A shelf on a rack. A bin for the whole shelf is added with it, so stock can go on the shelf or in smaller bins.', save: 'Create shelf' },
  bin: { title: 'New bin', description: 'The smallest location stock is stored and picked from.', save: 'Create bin' },
};

/* ─────────────────────────── Add drawer (warehouse / zone / rack / shelf / bin) ─────────────────────────── */

function AddLocationDrawer({ kind, onClose, whId, zones, treeSel, onCreatedWarehouse }: {
  kind: AddKind | null;
  onClose: () => void;
  whId: string;
  zones: Zone[];
  treeSel: TreeSel;
  onCreatedWarehouse: (w: Warehouse) => void;
}) {
  const qc = useQueryClient();
  const [whForm, setWhForm] = useState({ warehouseCode: '', name: '', type: 'RAW_MATERIAL', isDefault: false });
  const [zoneForm, setZoneForm] = useState({ zoneCode: '', name: '' });
  const [rackForm, setRackForm] = useState({ zoneId: '', rackCode: '' });
  const [shelfForm, setShelfForm] = useState({ zoneId: '', rackId: '', shelfCode: '' });
  const [binForm, setBinForm] = useState({ zoneId: '', rackId: '', shelfId: '', binCode: '', capacity: '' });
  const [errors, setErrors] = useState<Errors>({});

  // Pre-fill parents from the tree selection.
  useEffect(() => {
    if (!kind) return;
    setErrors({});
    const z = treeSel.kind === 'zone' || treeSel.kind === 'rack' || treeSel.kind === 'shelf' ? treeSel.zoneId : '';
    const r = treeSel.kind === 'rack' || treeSel.kind === 'shelf' ? treeSel.rackId : '';
    const s = treeSel.kind === 'shelf' ? treeSel.shelfId : '';
    if (kind === 'warehouse') setWhForm({ warehouseCode: '', name: '', type: 'RAW_MATERIAL', isDefault: false });
    if (kind === 'zone') setZoneForm({ zoneCode: '', name: '' });
    if (kind === 'rack') setRackForm({ zoneId: z || (zones.length === 1 ? zones[0]._id : ''), rackCode: '' });
    if (kind === 'shelf') setShelfForm({ zoneId: z, rackId: r, shelfCode: '' });
    if (kind === 'bin') setBinForm({ zoneId: z || (zones.length === 1 ? zones[0]._id : ''), rackId: r, shelfId: s, binCode: '', capacity: '' });
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const racks = useMemo(() => {
    const list: Array<WarehouseRack & { zoneId: string }> = [];
    for (const zone of zones) for (const rack of zone.racks ?? []) list.push({ ...rack, zoneId: zone._id });
    return list;
  }, [zones]);
  const racksFor = (zoneId: string) => racks.filter((r) => r.zoneId === zoneId).sort((a, b) => sortCode(a.rackCode, b.rackCode));
  const shelvesFor = (zoneId: string, rackId: string) => (racksFor(zoneId).find((r) => r._id === rackId)?.shelves ?? [])
    .slice().sort((a, b) => sortCode(a.shelfCode, b.shelfCode));

  const save = useMutation({
    mutationFn: async (): Promise<unknown> => {
      switch (kind) {
        case 'warehouse': return warehouseApi.create({ ...whForm, warehouseCode: whForm.warehouseCode.trim(), name: whForm.name.trim() });
        case 'zone': return warehouseApi.createZone(whId, { zoneCode: zoneForm.zoneCode.trim(), name: zoneForm.name.trim() });
        case 'rack': return warehouseApi.createRack(rackForm.zoneId, { rackCode: rackForm.rackCode.trim() });
        case 'shelf': return warehouseApi.createShelf(shelfForm.rackId, { shelfCode: shelfForm.shelfCode.trim() });
        case 'bin': return warehouseApi.createBin(whId, {
          zoneId: binForm.zoneId,
          rackId: binForm.rackId || undefined,
          shelfId: binForm.shelfId || undefined,
          binCode: binForm.binCode.trim(),
          capacity: binForm.capacity ? Number(binForm.capacity) : undefined,
        });
        default: throw new Error('Unknown');
      }
    },
    onSuccess: (data) => {
      const shelfBin = kind === 'shelf' && data && typeof data === 'object' && 'shelfBin' in data
        ? (data as { shelfBin?: { binCode?: string } | null }).shelfBin : null;
      toast.success(shelfBin?.binCode
        ? `Shelf created with bin ${shelfBin.binCode} for the whole shelf`
        : `${kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : 'Location'} created`);
      ['warehouse-stats', 'warehouses', 'warehouses-all', 'warehouses-sites', 'warehouse-layout', 'zones', 'bins', 'bins-ops']
        .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (kind === 'warehouse' && data && typeof data === 'object' && '_id' in data) onCreatedWarehouse(data as Warehouse);
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (kind === 'warehouse') {
      if (!whForm.warehouseCode.trim()) next.code = 'Enter a short code, e.g. WH-RM.';
      if (!whForm.name.trim()) next.name = 'Enter the warehouse name.';
    }
    if (kind === 'zone') {
      if (!zoneForm.zoneCode.trim()) next.code = 'Enter a zone code, e.g. Z1.';
      if (!zoneForm.name.trim()) next.name = 'Enter the zone name.';
    }
    if (kind === 'rack') {
      if (!rackForm.zoneId) next.zone = 'Choose the zone this rack is in.';
      if (!rackForm.rackCode.trim()) next.code = 'Enter a rack code, e.g. R-11.';
    }
    if (kind === 'shelf') {
      if (!shelfForm.zoneId) next.zone = 'Choose a zone.';
      if (!shelfForm.rackId) next.rack = 'Choose the rack this shelf is on.';
      if (!shelfForm.shelfCode.trim()) next.code = 'Enter a shelf code, e.g. S-8.';
    }
    if (kind === 'bin') {
      if (!binForm.zoneId) next.zone = 'Choose the zone for this bin.';
      if (!binForm.binCode.trim()) next.code = 'Enter a bin code.';
      if (binForm.capacity && !(Number(binForm.capacity) > 0)) next.capacity = 'Capacity must be more than 0.';
    }
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  const meta = kind ? ADD_META[kind] : null;
  const noZones = zones.length === 0 && (kind === 'rack' || kind === 'shelf' || kind === 'bin');

  return (
    <Drawer
      open={!!kind}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={false}
      title={meta?.title}
      description={meta?.description}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-location-form" loading={save.isPending} disabled={noZones}>{meta?.save}</Button>
        </>
      )}
    >
      {noZones ? (
        <EmptyState compact icon={MapPin} title="Create a zone first" description="Racks, shelves and bins all sit inside a zone." />
      ) : (
        <form id="add-location-form" onSubmit={submit} className="space-y-4" noValidate>
          {kind === 'warehouse' && (
            <>
              <Field label="Code" required error={errors.code}>
                <ErpInput className="font-mono" value={whForm.warehouseCode} onChange={(e) => setWhForm({ ...whForm, warehouseCode: e.target.value })} placeholder="WH-RM" />
              </Field>
              <Field label="Name" required error={errors.name}>
                <ErpInput value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} />
              </Field>
              <Field label="Type">
                <ErpSelect value={whForm.type} onChange={(e) => setWhForm({ ...whForm, type: e.target.value })}>
                  <option value="RAW_MATERIAL">Raw material</option>
                  <option value="WIP">WIP</option>
                  <option value="FINISHED_GOODS">Finished goods</option>
                </ErpSelect>
              </Field>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={whForm.isDefault} onChange={(e) => setWhForm({ ...whForm, isDefault: e.target.checked })} />
                Default warehouse for this type
              </label>
            </>
          )}
          {kind === 'zone' && (
            <>
              <Field label="Zone code" required error={errors.code}>
                <ErpInput className="font-mono" value={zoneForm.zoneCode} onChange={(e) => setZoneForm({ ...zoneForm, zoneCode: e.target.value })} placeholder="Z1" />
              </Field>
              <Field label="Name" required error={errors.name}>
                <ErpInput value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="Ground floor" />
              </Field>
            </>
          )}
          {kind === 'rack' && (
            <>
              <Field label="Zone" required error={errors.zone}>
                <ErpSelect value={rackForm.zoneId} onChange={(e) => setRackForm({ ...rackForm, zoneId: e.target.value })}>
                  <option value="">Select zone…</option>
                  {zones.map((z) => <option key={z._id} value={z._id}>{z.zoneCode}{z.name ? ` — ${z.name}` : ''}</option>)}
                </ErpSelect>
              </Field>
              <Field label="Rack code" required error={errors.code}>
                <ErpInput className="font-mono" value={rackForm.rackCode} onChange={(e) => setRackForm({ ...rackForm, rackCode: e.target.value })} placeholder="R-11" />
              </Field>
            </>
          )}
          {kind === 'shelf' && (
            <>
              <Field label="Zone" required error={errors.zone}>
                <ErpSelect value={shelfForm.zoneId} onChange={(e) => setShelfForm({ ...shelfForm, zoneId: e.target.value, rackId: '' })}>
                  <option value="">Select zone…</option>
                  {zones.map((z) => <option key={z._id} value={z._id}>{z.zoneCode}</option>)}
                </ErpSelect>
              </Field>
              <Field label="Rack" required error={errors.rack} hint={shelfForm.zoneId && !racksFor(shelfForm.zoneId).length ? 'This zone has no racks yet.' : undefined}>
                <ErpSelect value={shelfForm.rackId} disabled={!shelfForm.zoneId} onChange={(e) => setShelfForm({ ...shelfForm, rackId: e.target.value })}>
                  <option value="">Select rack…</option>
                  {racksFor(shelfForm.zoneId).map((r) => <option key={r._id} value={r._id}>{r.rackCode}</option>)}
                </ErpSelect>
              </Field>
              <Field label="Shelf code" required error={errors.code}>
                <ErpInput className="font-mono" value={shelfForm.shelfCode} onChange={(e) => setShelfForm({ ...shelfForm, shelfCode: e.target.value })} placeholder="S-8" />
              </Field>
            </>
          )}
          {kind === 'bin' && (
            <>
              <Field label="Zone" required error={errors.zone}>
                <ErpSelect value={binForm.zoneId} onChange={(e) => setBinForm({ ...binForm, zoneId: e.target.value, rackId: '', shelfId: '' })}>
                  <option value="">Select zone…</option>
                  {zones.map((z) => <option key={z._id} value={z._id}>{z.zoneCode}</option>)}
                </ErpSelect>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Rack">
                  <ErpSelect value={binForm.rackId} disabled={!binForm.zoneId} onChange={(e) => setBinForm({ ...binForm, rackId: e.target.value, shelfId: '' })}>
                    <option value="">None</option>
                    {racksFor(binForm.zoneId).map((r) => <option key={r._id} value={r._id}>{r.rackCode}</option>)}
                  </ErpSelect>
                </Field>
                <Field label="Shelf">
                  <ErpSelect value={binForm.shelfId} disabled={!binForm.rackId} onChange={(e) => setBinForm({ ...binForm, shelfId: e.target.value })}>
                    <option value="">None</option>
                    {shelvesFor(binForm.zoneId, binForm.rackId).map((s) => <option key={s._id} value={s._id}>{s.shelfCode}</option>)}
                  </ErpSelect>
                </Field>
              </div>
              <Field label="Bin code" required error={errors.code}>
                <ErpInput className="font-mono" value={binForm.binCode} onChange={(e) => setBinForm({ ...binForm, binCode: e.target.value })} placeholder="Z1-R11-S8-01" />
              </Field>
              <Field label="Capacity" hint="Optional maximum units." error={errors.capacity}>
                <ErpInput type="number" inputMode="numeric" min={1} value={binForm.capacity} onChange={(e) => setBinForm({ ...binForm, capacity: e.target.value })} />
              </Field>
            </>
          )}
        </form>
      )}
    </Drawer>
  );
}

/* ─────────────────────────── Bin stock drawer ─────────────────────────── */

function BinStockDrawer({ binId, whId, warehouse, fallbackBin, onClose, canUpdate }: {
  binId: string | null;
  whId: string;
  warehouse?: Warehouse;
  fallbackBin?: StorageBin;
  onClose: () => void;
  canUpdate: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const isRm = warehouse?.type === 'RAW_MATERIAL';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [materialId, setMaterialId] = useState('');
  const [qty, setQty] = useState('10');
  useEffect(() => { setSearch(''); setPage(1); setMaterialId(''); setQty('10'); }, [binId]);

  const contentsQ = useQuery({
    queryKey: ['bin-contents', whId, binId],
    queryFn: () => warehouseApi.binContents(whId, binId!),
    enabled: !!whId && !!binId,
  });
  const contents = contentsQ.data;
  const { data: materials = [] } = useQuery({
    queryKey: ['materials-wh'],
    queryFn: () => inventoryApi.listMaterialsPage({ limit: 200 }).then((r) => r.items),
    enabled: isRm && !!binId,
  });
  const { data: matBalances = [] } = useQuery({
    queryKey: ['inventory-balances-mat', materialId],
    queryFn: async () => {
      const mat = materials.find((m) => m._id === materialId);
      const { items } = await inventoryApi.listBalancesPage({ search: mat?.materialCode, limit: 50 });
      return items.filter((b) => (typeof b.materialId === 'object' ? b.materialId._id : b.materialId) === materialId);
    },
    enabled: !!materialId && isRm && !!binId,
  });
  const dock = transferableQty(unallocatedBalance(matBalances));
  const qtyNum = Math.max(1, Number(qty) || 1);
  const putQty = qty.trim() ? qtyNum : dock;

  const mut = useMutation({
    mutationFn: (a: { type: 'putAway' | 'pick'; materialId: string; quantity: number }) => (a.type === 'putAway'
      ? warehouseApi.putAway({ materialId: a.materialId, binId: binId!, quantity: a.quantity })
      : warehouseApi.pick({ materialId: a.materialId, binId: binId!, quantity: a.quantity })),
    onSuccess: (_d, a) => {
      toast.success(a.type === 'putAway' ? 'Put away complete' : 'Pick complete');
      ['bin-contents', 'inventory-balances-mat', 'inventory-balances', 'inventory-stats', 'warehouse-stats', 'stock-locator']
        .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });

  const rows = useMemo((): StockRow[] => {
    if (!contents) return [];
    const out: StockRow[] = [];
    for (const r of contents.rawMaterials ?? []) {
      const mat = r.materialId;
      const mid = materialRowId(mat as string | Material);
      const code = typeof mat === 'object' && mat ? String(mat.materialCode || '') : materialLabel(mat as string | Material);
      const name = typeof mat === 'object' && mat ? String(mat.name || '') : '';
      out.push({
        key: `rm-${mid || code}`, kind: 'RM', code: code || '—', label: name || code || '—', onHand: r.onHand ?? 0,
        available: (r as { available?: number }).available ?? (r.onHand ?? 0), unit: r.unit, materialId: mid || undefined,
      });
    }
    for (const r of contents.finishedGoods ?? []) {
      const sku = r.skuId;
      const code = typeof sku === 'object' && sku ? String((sku as { skuCode?: string }).skuCode || '') : skuLabel(sku);
      const name = typeof sku === 'object' && sku ? String((sku as { name?: string }).name || '') : '';
      out.push({ key: `fg-${code}-${r.onHand}`, kind: 'FG', code: code || '—', label: name || code || '—', onHand: r.onHand ?? 0, available: r.onHand ?? 0, unit: r.unit, dispatchStatus: r.dispatchStatus });
    }
    return out;
  }, [contents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.label.toLowerCase().includes(q) || (r.dispatchStatus || '').toLowerCase().includes(q));
  }, [rows, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / STOCK_PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const paged = filtered.slice((curPage - 1) * STOCK_PAGE_SIZE, curPage * STOCK_PAGE_SIZE);
  const bin = contents?.bin || fallbackBin;

  return (
    <Drawer
      open={!!binId}
      onClose={onClose}
      size="lg"
      title={`Bin ${binLabel(bin)}`}
      description={`${warehouse?.warehouseCode ?? ''}${bin?.barcode ? ` · ${bin.barcode}` : ''}`}
      headerExtra={fallbackBin?.status ? <div className="mt-2"><StatusBadge status={fallbackBin.status} /></div> : undefined}
      footer={(
        <>
          {isRm && <Button variant="ghost" className="mr-auto" onClick={() => navigate('/warehouse/operations/picking')}>Open picking</Button>}
          {warehouse?.type === 'FINISHED_GOODS' && (contents?.finishedGoods?.length ?? 0) > 0 && (
            <Button variant="ghost" className="mr-auto" onClick={() => navigate('/warehouse/operations/dispatch')}>Open dispatch</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>
      )}
    >
      <div className="space-y-4">
        {isRm && canUpdate && (
          <Section title="Put away into this bin" description="Moves free stock from the unallocated dock.">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Material" className="min-w-[200px] flex-1">
                <ErpSelect value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                  <option value="">Select material…</option>
                  {materials.map((m: Material) => <option key={m._id} value={m._id}>{m.materialCode} — {m.name}</option>)}
                </ErpSelect>
              </Field>
              <Field label="Quantity" hint={materialId ? `${dock} free on dock` : undefined} error={materialId && putQty > dock && dock > 0 ? `Only ${dock} on the dock.` : undefined} className="w-36">
                <ErpInput type="number" inputMode="decimal" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
              </Field>
              <Button
                disabled={!materialId || dock <= 0 || putQty <= 0 || putQty > dock || mut.isPending}
                loading={mut.isPending && mut.variables?.type === 'putAway'}
                onClick={async () => {
                  if (await confirm({ title: `Put away ${putQty} into ${binLabel(bin)}?`, message: `Dock stock goes down by ${putQty}.`, confirmLabel: 'Put away' })) {
                    mut.mutate({ type: 'putAway', materialId, quantity: putQty });
                  }
                }}
              >
                Put away
              </Button>
            </div>
          </Section>
        )}

        <Section flush title={`Contents (${rows.length})`}>
          {rows.length > 6 && (
            <div className="border-b border-[var(--erp-border)] px-4 py-3">
              <SearchInput inputSize="sm" value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search code or name…" />
            </div>
          )}
          <ErpDataTable className="min-w-[560px]">
            <thead>
              <tr><th>Item</th><th className="erp-num">On hand</th><th className="erp-num">Available</th><th>Status</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {contentsQ.isLoading ? <TableSkeleton asRows rows={3} columns={5} /> : contentsQ.isError ? <QueryErrorRow colSpan={5} error={contentsQ.error} onRetry={() => contentsQ.refetch()} /> : paged.length === 0 ? (
                <EmptyRow colSpan={5} title={rows.length === 0 ? 'This bin is empty' : 'No stock matches your search'} icon={Package} />
              ) : paged.map((row) => {
                const pickQty = Math.min(qtyNum, row.available);
                return (
                  <tr key={row.key}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral" dot={false}>{row.kind === 'RM' ? 'RM' : 'FG'}</Badge>
                        <span className="font-mono">{row.code}</span>
                      </div>
                      {row.label !== row.code && <p className="mt-0.5 text-xs text-erp-text-muted">{row.label}</p>}
                    </td>
                    <td className="erp-num">{row.onHand.toLocaleString()}{row.unit ? <span className="text-erp-text-muted"> {row.unit}</span> : ''}</td>
                    <td className="erp-num">{row.available.toLocaleString()}</td>
                    <td>{row.dispatchStatus ? <StatusBadge status={row.dispatchStatus} label={statusLabel(row.dispatchStatus)} /> : <span className="text-erp-text-muted">—</span>}</td>
                    <td className="erp-cell-actions">
                      <div className="flex justify-end">
                        {row.kind === 'RM' && isRm && canUpdate && row.materialId && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={row.available <= 0 || mut.isPending}
                            onClick={async () => {
                              if (await confirm({ title: `Pick ${pickQty} ${row.code}?`, message: `Stock in ${binLabel(bin)} goes down by ${pickQty}.`, confirmLabel: 'Pick' })) {
                                mut.mutate({ type: 'pick', materialId: row.materialId!, quantity: pickQty });
                              }
                            }}
                          >
                            Pick {pickQty}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
          {filtered.length > STOCK_PAGE_SIZE && (
            <TablePager page={curPage} totalPages={totalPages} total={filtered.length} pageSize={STOCK_PAGE_SIZE} itemLabel="items" onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} />
          )}
        </Section>
        {isRm && canUpdate && <p className="text-xs text-erp-text-muted">Pick uses the quantity above (capped at what is available).</p>}
      </div>
    </Drawer>
  );
}

/* ─────────────────────────── Section ─────────────────────────── */

export function SitesLayoutSection() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('warehouse.create');
  const canUpdate = permissions.includes('*') || permissions.includes('warehouse.update');
  const canConfigure = permissions.includes('*') || permissions.includes('warehouse.configure');

  const [selectedWh, setSelectedWh] = useState(searchParams.get('warehouseId') || '');
  const [selectedBinId, setSelectedBinId] = useState<string | null>(searchParams.get('binId'));
  const [treeSel, setTreeSel] = useState<TreeSel>({ kind: 'all' });
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [expandedRacks, setExpandedRacks] = useState<Set<string>>(new Set());
  const [binSearch, setBinSearch] = useState('');
  const [binPage, setBinPage] = useState(1);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [addKind, setAddKind] = useState<AddKind | null>(null);

  const warehousesQ = useQuery({ queryKey: ['warehouses-sites'], queryFn: () => warehouseApi.list({ limit: 100 }) });
  const warehouses = warehousesQ.data ?? [];
  const whId = selectedWh || warehouses[0]?._id || '';
  const selectedWarehouse = warehouses.find((w) => w._id === whId);

  useEffect(() => {
    if (!selectedWh && warehouses[0]?._id) setSelectedWh(warehouses[0]._id);
  }, [warehouses, selectedWh]);

  useEffect(() => {
    // Keep the selection in the URL — but only while the browser is still on this page.
    // The data loads async; if the user already clicked away, a late `replace` here would
    // hijack their navigation and drag them back to the warehouses page.
    if (!window.location.pathname.startsWith('/warehouse/warehouses')) return;
    const params = new URLSearchParams();
    if (whId) params.set('warehouseId', whId);
    if (selectedBinId) params.set('binId', selectedBinId);
    if (params.toString() === new URLSearchParams(window.location.search).toString()) return;
    setSearchParams(params, { replace: true });
  }, [whId, selectedBinId, setSearchParams]);

  const layoutQ = useQuery({ queryKey: ['warehouse-layout', whId], queryFn: () => warehouseApi.layout(whId), enabled: !!whId });
  const layout = layoutQ.data;
  const zones = (layout?.zones ?? []) as Zone[];

  const lookup = useMutation({
    mutationFn: () => warehouseApi.lookupBin(barcodeInput.trim()),
    onSuccess: (data) => {
      if (data && typeof data === 'object' && 'bin' in data) {
        const bin = (data as { bin: StorageBin }).bin;
        setSelectedWh(bin.warehouseId);
        setTreeSel({ kind: 'all' });
        setSelectedBinId(bin._id);
        setBarcodeInput('');
        toast.success(`Found bin ${binLabel(bin)}`);
      }
    },
  });

  const assignZone = useMutation({
    mutationFn: ({ binId, zoneId }: { binId: string; zoneId: string }) => warehouseApi.updateBin(whId, binId, { zoneId }),
    meta: { successMessage: 'Bin assigned to zone' },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouse-layout'] }); qc.invalidateQueries({ queryKey: ['bins'] }); },
  });

  const allBins = useMemo(() => {
    const list: StorageBin[] = [];
    for (const zone of zones) for (const b of zone.bins ?? []) list.push(b);
    for (const b of layout?.unassignedBins ?? []) list.push(b);
    return list;
  }, [layout, zones]);

  const filteredBins = useMemo(() => {
    let list = allBins;
    if (treeSel.kind === 'unassigned') list = layout?.unassignedBins ?? [];
    else if (treeSel.kind === 'zone') list = zones.find((z) => z._id === treeSel.zoneId)?.bins ?? [];
    else if (treeSel.kind === 'rack') list = (zones.find((z) => z._id === treeSel.zoneId)?.bins ?? []).filter((b) => b.rackId === treeSel.rackId);
    else if (treeSel.kind === 'shelf') list = (zones.find((z) => z._id === treeSel.zoneId)?.bins ?? []).filter((b) => b.shelfId === treeSel.shelfId);
    const q = binSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => b.binCode?.toLowerCase().includes(q) || b.barcode?.toLowerCase().includes(q)
        || b.zoneCode?.toLowerCase().includes(q) || binLabel(b).toLowerCase().includes(q));
    }
    return list.slice().sort((a, b) => sortCode(a.binCode, b.binCode));
  }, [allBins, treeSel, zones, layout, binSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredBins.length / PAGE_SIZE));
  const pageBins = filteredBins.slice((binPage - 1) * PAGE_SIZE, binPage * PAGE_SIZE);
  useEffect(() => { setBinPage(1); }, [treeSel, binSearch, whId]);

  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (treeSel.kind === 'all') parts.push('All bins');
    else if (treeSel.kind === 'unassigned') parts.push('Unassigned bins');
    else {
      const zone = zones.find((z) => z._id === treeSel.zoneId);
      if (zone) parts.push(zone.zoneCode || '—');
      if (treeSel.kind === 'rack' || treeSel.kind === 'shelf') {
        const rack = (zone?.racks ?? []).find((r) => r._id === treeSel.rackId);
        if (rack) parts.push(rack.rackCode);
        if (treeSel.kind === 'shelf') {
          const shelf = (rack?.shelves ?? []).find((s) => s._id === treeSel.shelfId);
          if (shelf) parts.push(shelf.shelfCode);
        }
      }
    }
    return parts.join(' / ');
  }, [treeSel, zones]);

  const toggle = (set: Set<string>, id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n; };
  const selectTree = (sel: TreeSel) => {
    setTreeSel(sel);
    if (sel.kind === 'zone' || sel.kind === 'rack' || sel.kind === 'shelf') setExpandedZones((p) => new Set(p).add(sel.zoneId));
    if (sel.kind === 'rack' || sel.kind === 'shelf') setExpandedRacks((p) => new Set(p).add(sel.rackId));
  };

  const treeBtn = (selected: boolean) => `flex min-h-9 w-full items-center gap-1.5 rounded-md px-2 text-left hover:bg-[var(--erp-surface-muted)] ${selected ? 'bg-[var(--erp-accent-subtle)] font-medium text-erp-text-primary' : ''}`;

  const addItems = [
    { label: 'Warehouse', icon: WhIcon, hidden: !canCreate, onSelect: () => setAddKind('warehouse' as const) },
    { type: 'separator' as const, hidden: !canConfigure || !whId },
    { label: 'Zone', icon: MapPin, hidden: !canConfigure || !whId, onSelect: () => setAddKind('zone' as const) },
    { label: 'Rack', icon: Rows3, hidden: !canConfigure || !whId, onSelect: () => setAddKind('rack' as const) },
    { label: 'Shelf', icon: Layers, hidden: !canConfigure || !whId, onSelect: () => setAddKind('shelf' as const) },
  ];

  return (
    <>
      <PageHeader
        title="Sites & layout"
        description="Warehouses and their zones, racks, shelves and bins."
        secondaryActions={(
          <>
            <IconButton aria-label="Refresh" loading={warehousesQ.isFetching || layoutQ.isFetching} onClick={() => { warehousesQ.refetch(); layoutQ.refetch(); }}>
              <RefreshCw size={16} />
            </IconButton>
            <Button variant="secondary" icon={<Search size={16} />} onClick={() => navigate('/warehouse/stock-locator')}>Find stock</Button>
            {(canCreate || canConfigure) && (
              <DropdownMenu
                label="Add location"
                items={addItems}
                trigger={<Button variant="secondary" icon={<Plus size={16} />} iconRight={<ChevronDown size={14} />}>Add</Button>}
              />
            )}
          </>
        )}
        primaryAction={canCreate ? (
          whId
            ? <Button icon={<Plus size={16} />} onClick={() => setAddKind('bin')}>New bin</Button>
            : <Button icon={<Plus size={16} />} onClick={() => setAddKind('warehouse')}>New warehouse</Button>
        ) : undefined}
      />

      {warehousesQ.isLoading ? (
        <Section><Skeleton width="40%" /></Section>
      ) : !whId ? (
        <div className="erp-card">
          <EmptyState
            icon={WhIcon}
            title="No warehouses yet"
            description="Create a raw-material and a finished-goods warehouse, then add zones and bins."
            action={canCreate ? <Button icon={<Plus size={16} />} onClick={() => setAddKind('warehouse')}>New warehouse</Button> : undefined}
          />
        </div>
      ) : (
        <>
          <Section className="mb-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Warehouse" className="min-w-[220px]">
                <ErpSelect
                  value={whId}
                  onChange={(e) => {
                    setSelectedWh(e.target.value);
                    setTreeSel({ kind: 'all' });
                    setSelectedBinId(null);
                    setExpandedZones(new Set());
                    setExpandedRacks(new Set());
                  }}
                >
                  {warehouses.map((w: Warehouse) => (
                    <option key={w._id} value={w._id}>{w.warehouseCode} · {warehouseTypeLabel(w.type)}{w.isDefault ? ' (default)' : ''}</option>
                  ))}
                </ErpSelect>
              </Field>
              <Field label="Scan or type a bin barcode" className="min-w-[240px] flex-1 sm:max-w-sm">
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (barcodeInput.trim()) lookup.mutate(); }}>
                  <ErpInput value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} placeholder="BIN-…" aria-label="Bin barcode" />
                  <Button type="submit" variant="secondary" icon={<Scan size={16} />} loading={lookup.isPending} disabled={!barcodeInput.trim()}>Find</Button>
                </form>
              </Field>
            </div>
          </Section>

          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Section title="Layout" description={selectedWarehouse?.name} bodyClassName="!p-2 max-h-[65vh] overflow-y-auto">
              {layoutQ.isLoading ? (
                <div className="space-y-2 p-2"><Skeleton width="70%" /><Skeleton width="50%" /><Skeleton width="60%" /></div>
              ) : (
                <ul className="space-y-0.5 text-[13px]" role="tree" aria-label="Warehouse layout">
                  <li role="treeitem" aria-selected={treeSel.kind === 'all'}>
                    <button type="button" className={treeBtn(treeSel.kind === 'all')} onClick={() => selectTree({ kind: 'all' })}>
                      <Boxes size={14} className="text-erp-text-muted" /> All bins
                      <span className="ml-auto erp-tabular text-xs text-erp-text-muted">{allBins.length}</span>
                    </button>
                  </li>
                  {(layout?.unassignedBins?.length ?? 0) > 0 && (
                    <li role="treeitem" aria-selected={treeSel.kind === 'unassigned'}>
                      <button type="button" className={treeBtn(treeSel.kind === 'unassigned')} onClick={() => selectTree({ kind: 'unassigned' })}>
                        Unassigned <Badge tone="warning" className="ml-auto">{layout?.unassignedBins?.length}</Badge>
                      </button>
                    </li>
                  )}
                  {zones.slice().sort((a, b) => sortCode(a.zoneCode || '', b.zoneCode || '')).map((zone) => {
                    const open = expandedZones.has(zone._id);
                    const racks = (zone.racks ?? []).slice().sort((a, b) => sortCode(a.rackCode, b.rackCode));
                    return (
                      <li key={zone._id} role="treeitem" aria-expanded={open} aria-selected={treeSel.kind === 'zone' && treeSel.zoneId === zone._id}>
                        <div className="flex items-center">
                          <IconButton aria-label={open ? `Collapse ${zone.zoneCode}` : `Expand ${zone.zoneCode}`} tooltip={false} size="sm" onClick={() => setExpandedZones((s) => toggle(s, zone._id))}>
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </IconButton>
                          <button type="button" className={treeBtn(treeSel.kind === 'zone' && treeSel.zoneId === zone._id)} onClick={() => selectTree({ kind: 'zone', zoneId: zone._id })}>
                            <span className="font-mono">{zone.zoneCode || '—'}</span>
                            {zone.name && <span className="truncate text-erp-text-muted">{zone.name}</span>}
                            <span className="ml-auto erp-tabular text-xs text-erp-text-muted">{zone.bins?.length ?? 0}</span>
                          </button>
                        </div>
                        {open && (
                          <ul className="ml-5 border-l border-[var(--erp-border)] pl-1" role="group">
                            {racks.length === 0 && <li className="px-2 py-1.5 text-xs text-erp-text-muted">No racks</li>}
                            {racks.map((rack) => {
                              const rackOpen = expandedRacks.has(rack._id);
                              const shelves = (rack.shelves ?? []).slice().sort((a, b) => sortCode(a.shelfCode, b.shelfCode));
                              const rackBins = (zone.bins ?? []).filter((b) => b.rackId === rack._id).length;
                              return (
                                <li key={rack._id} role="treeitem" aria-expanded={rackOpen}>
                                  <div className="flex items-center">
                                    <IconButton aria-label={rackOpen ? `Collapse ${rack.rackCode}` : `Expand ${rack.rackCode}`} tooltip={false} size="sm" onClick={() => setExpandedRacks((s) => toggle(s, rack._id))}>
                                      {rackOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </IconButton>
                                    <button type="button" className={treeBtn(treeSel.kind === 'rack' && treeSel.rackId === rack._id)} onClick={() => selectTree({ kind: 'rack', zoneId: zone._id, rackId: rack._id })}>
                                      <span className="font-mono">{rack.rackCode}</span>
                                      <span className="ml-auto text-xs text-erp-text-muted">{shelves.length} shelves · {rackBins} bins</span>
                                    </button>
                                  </div>
                                  {rackOpen && (
                                    <ul className="ml-5 border-l border-[var(--erp-border)] pl-1" role="group">
                                      {shelves.length === 0 && <li className="px-2 py-1.5 text-xs text-erp-text-muted">No shelves</li>}
                                      {shelves.map((shelf) => (
                                        <li key={shelf._id} role="treeitem" aria-selected={treeSel.kind === 'shelf' && treeSel.shelfId === shelf._id}>
                                          <button
                                            type="button"
                                            className={treeBtn(treeSel.kind === 'shelf' && treeSel.shelfId === shelf._id)}
                                            onClick={() => selectTree({ kind: 'shelf', zoneId: zone._id, rackId: rack._id, shelfId: shelf._id })}
                                          >
                                            <span className="font-mono">{shelf.shelfCode}</span>
                                            <span className="ml-auto erp-tabular text-xs text-erp-text-muted">{(zone.bins ?? []).filter((b) => b.shelfId === shelf._id).length}</span>
                                          </button>
                                        </li>
                                      ))}
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
                    <li className="px-2 py-3 text-erp-text-muted">
                      No zones yet.{canConfigure && <> <button type="button" className="font-medium text-[var(--erp-accent)] hover:underline" onClick={() => setAddKind('zone')}>Add a zone</button></>}
                    </li>
                  )}
                </ul>
              )}
            </Section>

            <Section
              flush
              title={`${filteredBins.length} bin${filteredBins.length === 1 ? '' : 's'}`}
              description={breadcrumb}
              actions={<SearchInput inputSize="sm" value={binSearch} onChange={setBinSearch} placeholder="Filter bins…" wrapperClassName="w-56" />}
            >
              <ErpDataTable className="min-w-[560px]">
                <thead>
                  <tr><th>Bin</th><th>Location</th><th>Barcode</th><th>Status</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {layoutQ.isLoading ? <TableSkeleton asRows rows={6} columns={5} /> : layoutQ.isError ? <QueryErrorRow colSpan={5} error={layoutQ.error} onRetry={() => layoutQ.refetch()} /> : pageBins.length === 0 ? (
                    <EmptyRow
                      colSpan={5}
                      icon={Boxes}
                      title={binSearch ? 'No bins match your filter' : treeSel.kind === 'all' && zones.length === 0 ? 'No layout yet' : 'No bins here yet'}
                      action={!binSearch && canCreate && zones.length > 0 ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddKind('bin')}>New bin</Button> : undefined}
                    >
                      {treeSel.kind === 'all' && zones.length === 0 && !binSearch ? 'Add a zone, then racks, shelves and bins.' : undefined}
                    </EmptyRow>
                  ) : pageBins.map((b) => {
                    const zone = zones.find((z) => z._id === b.zoneId);
                    const rack = (zone?.racks ?? []).find((r) => r._id === b.rackId);
                    const shelf = (rack?.shelves ?? []).find((s) => s._id === b.shelfId);
                    const loc = [zone?.zoneCode, rack?.rackCode, shelf?.shelfCode].filter(Boolean).join(' / ') || '—';
                    return (
                      <tr key={b._id} className={`erp-row-clickable${selectedBinId === b._id ? ' erp-row-selected' : ''}`} onClick={() => setSelectedBinId(b._id)}>
                        <td className="erp-cell-primary font-mono">{binLabel(b)}</td>
                        <td className="font-mono text-erp-text-muted">{loc}</td>
                        <td className="text-erp-text-muted">{b.barcode || '—'}</td>
                        <td><StatusBadge status={b.status} /></td>
                        <td className="erp-cell-actions">
                          <div className="flex justify-end gap-1">
                            {!b.zoneId && canCreate && zones[0] ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={assignZone.isPending && assignZone.variables?.binId === b._id}
                                onClick={(e) => { e.stopPropagation(); assignZone.mutate({ binId: b._id, zoneId: zones[0]._id }); }}
                              >
                                Assign to {zones[0].zoneCode}
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" icon={<Package size={14} />} onClick={(e) => { e.stopPropagation(); setSelectedBinId(b._id); }}>Stock</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </ErpDataTable>
              {filteredBins.length > PAGE_SIZE && (
                <TablePager page={binPage} totalPages={totalPages} total={filteredBins.length} pageSize={PAGE_SIZE} itemLabel="bins" onPrev={() => setBinPage((p) => p - 1)} onNext={() => setBinPage((p) => p + 1)} />
              )}
            </Section>
          </div>
        </>
      )}

      <AddLocationDrawer
        kind={addKind}
        onClose={() => setAddKind(null)}
        whId={whId}
        zones={zones}
        treeSel={treeSel}
        onCreatedWarehouse={(w) => { setSelectedWh(w._id); setTreeSel({ kind: 'all' }); }}
      />
      <BinStockDrawer
        binId={selectedBinId}
        whId={whId}
        warehouse={selectedWarehouse}
        fallbackBin={allBins.find((b) => b._id === selectedBinId)}
        onClose={() => setSelectedBinId(null)}
        canUpdate={canUpdate}
      />
    </>
  );
}
