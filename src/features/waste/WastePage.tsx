import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Clock, Download, Eye, Plus, Recycle, RefreshCw, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { wasteApi } from '../../services/operations';
import apiClient from '../../services/api';
import type { WasteRecord } from '../../types/api';
import {
  Button, DescriptionList, Drawer, EmptyRow, ErpDataTable, ErpInput, ErpSearchSelect, ErpSelect, Field, FilterBar, IconButton,
  KpiGrid, Modal, PageHeader, RowActionsMenu, SearchInput, Section, StatTile, StatusBadge, TablePager, TableSkeleton, toast,
} from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  batchLabel, formatCurrency, formatDateTime, materialLabel, recordToChartData, recoveryLabel, skuLabel, statusLabel, typeLabel,
} from './wasteUtils';
import { useDebouncedValue } from '../production/useProductionActions';
import { QueryErrorRow } from '../production/QueryErrorRow';
import { MATERIAL_UNITS, unitLabel } from '../inventory/inventoryUtils';

const PAGE_SIZE = 15;
type Errors = Record<string, string>;
type WasteRow = WasteRecord & { reasonCode?: string; unitCost?: number; createdAt?: string; recoveredAt?: string };

function useInvalidateWaste() {
  const qc = useQueryClient();
  return () => ['waste-stats', 'waste-records', 'waste-summary'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

interface WasteFormOptions {
  materials: { _id: string; materialCode: string; name: string; unit?: string; unitCost?: number }[];
  skus: { _id: string; skuCode: string; name?: string }[];
  batches: { _id: string; batchNumber: string; status?: string }[];
}

function fetchWasteFormOptions(): Promise<WasteFormOptions> {
  return apiClient.get<{ data: WasteFormOptions }>('/waste/form-options').then((r) => r.data.data);
}

const statusTone = (s: string) => (s === 'RECORDED' ? 'warning' as const : undefined);

/* ─────────────────────────── Record waste ─────────────────────────── */

function RecordWasteDrawer({ open, onClose, wasteTypes, reasonCodes }: {
  open: boolean; onClose: () => void; wasteTypes: string[]; reasonCodes: string[];
}) {
  const invalidate = useInvalidateWaste();
  const empty = { wasteType: 'FABRIC_SCRAP', batchId: '', materialId: '', skuId: '', quantity: '1', unit: 'METERS', reasonCode: 'MANUAL', unitCost: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => { if (open) { setForm(empty); setErrors({}); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // One waste-scoped lookup: recorders (production manager, QC) can't read the inventory / SKU lists.
  const { data: options } = useQuery({ queryKey: ['waste-form-options'], queryFn: fetchWasteFormOptions, enabled: open });
  const batches = options?.batches ?? [];
  const materials = options?.materials ?? [];
  const skus = options?.skus ?? [];

  const save = useMutation({
    mutationFn: () => wasteApi.create({
      wasteType: form.wasteType,
      batchId: form.batchId || undefined,
      materialId: form.materialId || undefined,
      skuId: form.skuId || undefined,
      quantity: Number(form.quantity),
      unit: form.unit.trim(),
      reasonCode: form.reasonCode,
      unitCost: form.unitCost ? Number(form.unitCost) : undefined,
    }),
    onSuccess: (r) => { toast.success(`Waste ${r.wasteCode} recorded`); invalidate(); onClose(); },
  });

  const qty = Number(form.quantity) || 0;
  const cost = form.unitCost ? qty * Number(form.unitCost) : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!(Number(form.quantity) > 0)) next.quantity = 'Enter a quantity greater than 0.';
    if (!form.unit.trim()) next.unit = 'Enter the unit, e.g. METERS or PIECES.';
    if (form.unitCost && !(Number(form.unitCost) >= 0)) next.unitCost = 'Unit cost cannot be negative.';
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={false}
      title="Record waste"
      description="Log scrap or rejects so cost and recovery can be tracked."
      footer={(
        <>
          {cost != null && <span className="mr-auto text-[13px] text-erp-text-muted">Estimated cost <strong className="erp-tabular text-erp-text-primary">{formatCurrency(cost)}</strong></span>}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="waste-form" loading={save.isPending}>Record waste</Button>
        </>
      )}
    >
      <form id="waste-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <ErpSelect value={form.wasteType} onChange={(e) => setForm({ ...form, wasteType: e.target.value })}>
              {wasteTypes.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Reason">
            <ErpSelect value={form.reasonCode} onChange={(e) => setForm({ ...form, reasonCode: e.target.value })}>
              {reasonCodes.map((c) => <option key={c} value={c}>{typeLabel(c)}</option>)}
            </ErpSelect>
          </Field>
        </div>
        <Field label="Material" hint="Picking a material fills in its unit and cost.">
          <ErpSearchSelect
            value={form.materialId}
            allowClear
            placeholder="None"
            options={materials.map((m) => ({ value: m._id, label: `${m.materialCode} — ${m.name}` }))}
            onChange={(v) => {
              const mat = materials.find((m) => m._id === v);
              setForm((f) => ({ ...f, materialId: v, unit: mat?.unit || f.unit, unitCost: mat?.unitCost != null ? String(mat.unitCost) : f.unitCost }));
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Batch">
            <ErpSelect value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
              <option value="">None</option>
              {batches.map((b) => <option key={b._id} value={b._id}>{b.batchNumber}</option>)}
            </ErpSelect>
          </Field>
          <Field label="SKU">
            <ErpSelect value={form.skuId} onChange={(e) => setForm({ ...form, skuId: e.target.value })}>
              <option value="">None</option>
              {skus.map((s) => <option key={s._id} value={s._id}>{s.skuCode}</option>)}
            </ErpSelect>
          </Field>
        </div>
        <div className="grid gap-4 grid-cols-3">
          <Field label="Quantity" required error={errors.quantity}>
            <ErpInput type="number" inputMode="decimal" min={0.01} step={0.01} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="Unit" required error={errors.unit}>
            <ErpSelect value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {MATERIAL_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Unit cost" error={errors.unitCost}>
            <ErpInput type="number" inputMode="decimal" min={0} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} placeholder="Auto" />
          </Field>
        </div>
      </form>
    </Drawer>
  );
}

/* ─────────────────────────── Recovery ─────────────────────────── */

function RecoveryModal({ record, onClose, actions }: { record: WasteRow | null; onClose: () => void; actions: string[] }) {
  const invalidate = useInvalidateWaste();
  const [action, setAction] = useState('RECYCLE');
  useEffect(() => { if (record) setAction(actions[0] ?? 'RECYCLE'); }, [record, actions]);
  const save = useMutation({
    mutationFn: () => wasteApi.recordRecovery(record!._id, { recoveryAction: action }),
    meta: { successMessage: 'Recovery recorded' },
    onSuccess: () => { invalidate(); onClose(); },
  });
  return (
    <Modal
      open={!!record}
      onClose={onClose}
      size="sm"
      title={`Recover ${record?.wasteCode ?? ''}`}
      description={record ? `${record.quantity} ${unitLabel(record.unit).toLowerCase()} of ${typeLabel(record.wasteType).toLowerCase()}` : undefined}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>Record recovery</Button>
        </>
      )}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">What happened to it?</legend>
        <div className="grid gap-2" role="radiogroup">
          {actions.map((a) => (
            <label key={a} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm ${action === a ? 'border-[var(--erp-accent)] bg-[var(--erp-accent-subtle)]' : 'border-[var(--erp-border)]'}`}>
              <input type="radio" name="recovery" className="h-4 w-4" checked={action === a} onChange={() => setAction(a)} />
              {recoveryLabel(a)}
            </label>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export function WastePage() {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('waste.create');
  const canUpdate = permissions.includes('*') || permissions.includes('waste.update');
  const canExport = permissions.includes('*') || permissions.includes('waste.export');

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [recovering, setRecovering] = useState<WasteRow | null>(null);
  const [selected, setSelected] = useState<WasteRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const statsQ = useQuery({ queryKey: ['waste-stats'], queryFn: () => wasteApi.stats() });
  const stats = statsQ.data;
  const { data: catalog } = useQuery({ queryKey: ['waste-catalog'], queryFn: () => wasteApi.catalog() });
  const listQ = useQuery({
    queryKey: ['waste-records', page, search, typeFilter, statusFilter],
    queryFn: () => wasteApi.listPage({ page, limit: PAGE_SIZE, search: search || undefined, wasteType: typeFilter || undefined, status: statusFilter || undefined }),
    placeholderData: (prev) => prev,
  });
  const records = (listQ.data?.items ?? []) as WasteRow[];
  const meta = listQ.data?.meta;

  const handleExport = async () => {
    setExporting(true);
    try {
      // Only set keys: wasteApi.exportCsv feeds the object to URLSearchParams, which turns an undefined
      // value into the literal "undefined" (search=undefined matched no waste code → empty export).
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (typeFilter) params.wasteType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const blob = await wasteApi.exportCsv(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'waste-records.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // By cost: quantities mix metres, pieces and kg, so only value is comparable across types.
  const chartData = recordToChartData(stats?.costByType ?? stats?.byType);
  const wasteTypes = (catalog?.wasteTypes as string[] | undefined) ?? ['FABRIC_SCRAP', 'THREAD_WASTE', 'REJECTED_PIECES', 'PRODUCTION_SCRAP'];
  const reasonCodes = (catalog?.reasonCodes as string[] | undefined) ?? ['MANUAL', 'CUTTING', 'QC_REJECT'];
  const recoveryActions = ((catalog?.recoveryActions as string[] | undefined) ?? ['RECYCLE', 'REUSE', 'DISPOSE']).filter((a) => a !== 'NONE');

  const filtersActive = !!(searchInput || typeFilter || statusFilter);
  const clear = () => { setSearchInput(''); setTypeFilter(''); setStatusFilter(''); setPage(1); };
  const toggleStatus = (s: string) => { setStatusFilter((cur) => (cur === s ? '' : s)); setPage(1); };

  return (
    <>
      <PageHeader
        title="Waste"
        description="Track scrap and rejects from production, and what was recovered."
        secondaryActions={(
          <>
            <IconButton aria-label="Refresh" loading={listQ.isFetching} onClick={() => { listQ.refetch(); statsQ.refetch(); }}><RefreshCw size={16} /></IconButton>
            <Button variant="secondary" icon={<BarChart3 size={16} />} onClick={() => navigate('/reports/waste')}>Report</Button>
            {canExport && <Button variant="secondary" icon={<Download size={16} />} loading={exporting} onClick={handleExport}>Export</Button>}
          </>
        )}
        primaryAction={canCreate ? <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>Record waste</Button> : undefined}
      />

      <KpiGrid cols={6} className="mb-4">
        <StatTile icon={Wallet} label="Total cost" value={formatCurrency(stats?.totalCost)} hint={`${stats?.totalRecords ?? 0} records`} />
        <StatTile icon={Clock} label="Last 7 days" value={formatCurrency(stats?.periodCost7d)} />
        <StatTile
          icon={Trash2} label="Awaiting recovery" value={stats?.recordedCount ?? '—'}
          highlight={(stats?.recordedCount ?? 0) > 0 ? 'warn' : undefined}
          onClick={() => toggleStatus('RECORDED')} active={statusFilter === 'RECORDED'}
        />
        <StatTile icon={Recycle} label="Recovered" value={stats?.recoveredCount ?? '—'} onClick={() => toggleStatus('RECOVERED')} active={statusFilter === 'RECOVERED'} />
        <StatTile icon={Wallet} label="Recovered value" value={formatCurrency(stats?.recoveredCost)} />
        <StatTile
          icon={TrendingUp} label="Top type" value={stats?.topType ? typeLabel(stats.topType) : '—'}
          onClick={stats?.topType ? () => { setTypeFilter(typeFilter === stats.topType ? '' : stats.topType!); setPage(1); } : undefined}
          active={!!stats?.topType && typeFilter === stats.topType}
        />
      </KpiGrid>

      {chartData.length > 0 && (
        <Section title="Waste by type" description="Cost of waste recorded, by type." className="mb-4">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Cost']} cursor={{ fill: 'var(--erp-surface-muted)' }} contentStyle={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)', borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="value" name="Quantity" fill="var(--erp-accent)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      <Section flush>
        <FilterBar
          search={<SearchInput inputSize="sm" value={searchInput} onChange={(v) => { setSearchInput(v); setPage(1); }} placeholder="Search waste code…" />}
          filters={(
            <>
              <ErpSelect inputSize="sm" aria-label="Type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                <option value="">All types</option>
                {wasteTypes.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </ErpSelect>
              <ErpSelect inputSize="sm" aria-label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="RECORDED">Awaiting recovery</option>
                <option value="RECOVERED">Recovered</option>
              </ErpSelect>
            </>
          )}
          onClear={filtersActive ? clear : undefined}
        />
        <ErpDataTable className="min-w-[820px]">
          <thead>
            <tr>
              <th>Code</th><th>Type</th><th>Source</th><th className="erp-num">Quantity</th><th className="erp-num">Cost</th><th>Status</th>
              <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading ? <TableSkeleton asRows rows={6} columns={7} /> : listQ.isError ? <QueryErrorRow colSpan={7} error={listQ.error} onRetry={() => listQ.refetch()} /> : records.length === 0 ? (
              <EmptyRow
                colSpan={7}
                icon={Trash2}
                title={filtersActive ? 'No waste records match these filters' : 'No waste recorded yet'}
                action={filtersActive
                  ? <Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button>
                  : canCreate ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating(true)}>Record waste</Button> : undefined}
              >
                {filtersActive ? undefined : 'Scrap recorded when completing batch stages also appears here.'}
              </EmptyRow>
            ) : records.map((r) => (
              <tr key={r._id} className={`erp-row-clickable${selected?._id === r._id ? ' erp-row-selected' : ''}`} onClick={() => setSelected(r)}>
                <td className="erp-cell-primary whitespace-nowrap font-mono">{r.wasteCode}</td>
                <td>{typeLabel(r.wasteType)}</td>
                <td className="max-w-[260px]">
                  <span className="block truncate">{r.materialId ? materialLabel(r.materialId) : r.skuId ? skuLabel(r.skuId) : '—'}</span>
                  {r.batchId && <span className="block truncate text-xs text-erp-text-muted">Batch {batchLabel(r.batchId)}</span>}
                </td>
                <td className="erp-num whitespace-nowrap">{r.quantity.toLocaleString()} <span className="text-erp-text-muted">{unitLabel(r.unit).toLowerCase()}</span></td>
                <td className="erp-num">{formatCurrency(r.totalCost)}</td>
                <td>
                  <StatusBadge status={r.status} tone={statusTone(r.status)} label={r.status === 'RECORDED' ? 'Awaiting recovery' : r.recoveryAction ? `${statusLabel(r.status)} · ${recoveryLabel(r.recoveryAction)}` : undefined} />
                </td>
                <td className="erp-cell-actions">
                  <div className="flex items-center justify-end gap-1">
                    {canUpdate && r.status === 'RECORDED' && (
                      <Button size="sm" variant="secondary" icon={<Recycle size={14} />} onClick={(e) => { e.stopPropagation(); setRecovering(r); }}>Recover</Button>
                    )}
                    <RowActionsMenu label={`Actions for ${r.wasteCode}`} items={[{ label: 'View details', icon: Eye, onSelect: () => setSelected(r) }]} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </ErpDataTable>
        {meta && <TablePager page={page} totalPages={meta.totalPages} total={meta.total} pageSize={PAGE_SIZE} itemLabel="records" onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />}
      </Section>

      <RecordWasteDrawer open={creating} onClose={() => setCreating(false)} wasteTypes={wasteTypes} reasonCodes={reasonCodes} />
      <RecoveryModal record={recovering} onClose={() => setRecovering(null)} actions={recoveryActions} />
      {selected && (
        <Drawer
          open
          onClose={() => setSelected(null)}
          size="sm"
          title={selected.wasteCode}
          description={typeLabel(selected.wasteType)}
          headerExtra={<div className="mt-2"><StatusBadge status={selected.status} tone={statusTone(selected.status)} label={selected.status === 'RECORDED' ? 'Awaiting recovery' : undefined} /></div>}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
              {canUpdate && selected.status === 'RECORDED' && (
                <Button icon={<Recycle size={16} />} onClick={() => { setRecovering(selected); setSelected(null); }}>Record recovery</Button>
              )}
            </>
          )}
        >
          <DescriptionList
            columns={2}
            items={[
              { label: 'Quantity', value: `${selected.quantity} ${unitLabel(selected.unit).toLowerCase()}` },
              { label: 'Cost', value: formatCurrency(selected.totalCost) },
              { label: 'Material', value: materialLabel(selected.materialId), full: true },
              { label: 'SKU', value: skuLabel(selected.skuId) },
              { label: 'Batch', value: batchLabel(selected.batchId) },
              { label: 'Reason', value: selected.reasonCode ? typeLabel(selected.reasonCode) : '—' },
              { label: 'Recovery', value: recoveryLabel(selected.recoveryAction) },
              { label: 'Recorded', value: formatDateTime(selected.createdAt), full: true },
            ]}
          />
        </Drawer>
      )}
    </>
  );
}
