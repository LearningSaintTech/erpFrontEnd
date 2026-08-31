import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Recycle, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { wasteApi, productionApi } from '../../services/operations';
import { inventoryApi, skuApi } from '../../services/manufacturing';
import type { WasteRecord } from '../../types/api';
import {
  ErpPageHeader, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  batchLabel, formatCurrency, materialLabel, recordToChartData,
  recoveryLabel, skuLabel, statusLabel, typeLabel,
} from './wasteUtils';

const PAGE_SIZE = 15;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const btnSm = '!px-2 !py-1 text-[10px]';

export function WastePage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('waste.create');
  const canUpdate = permissions.includes('*') || permissions.includes('waste.update');
  const canExport = permissions.includes('*') || permissions.includes('waste.export');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recoverId, setRecoverId] = useState<string | null>(null);
  const [recoveryAction, setRecoveryAction] = useState('RECYCLE');

  const [form, setForm] = useState({
    wasteType: 'FABRIC_SCRAP',
    batchId: '',
    materialId: '',
    skuId: '',
    quantity: '1',
    unit: 'METERS',
    reasonCode: 'MANUAL',
    unitCost: '',
  });

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['waste-stats'] });
    qc.invalidateQueries({ queryKey: ['waste-records'] });
    qc.invalidateQueries({ queryKey: ['waste-summary'] });
  };

  const { data: stats } = useQuery({ queryKey: ['waste-stats'], queryFn: () => wasteApi.stats() });
  const { data: catalog } = useQuery({ queryKey: ['waste-catalog'], queryFn: () => wasteApi.catalog() });

  const { data: pageData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['waste-records', page, search, typeFilter, statusFilter],
    queryFn: () => wasteApi.listPage({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      wasteType: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
  });
  const records = pageData?.items ?? [];
  const meta = pageData?.meta;

  const { data: batches = [] } = useQuery({
    queryKey: ['batches-waste'],
    queryFn: () => productionApi.listBatchesPage({ limit: 100 }).then((r) => r.items),
    enabled: showForm,
  });
  const { data: materials = [] } = useQuery({
    queryKey: ['materials-waste'],
    queryFn: () => inventoryApi.listMaterialsPage({ limit: 200 }).then((r) => r.items),
    enabled: showForm,
  });
  const { data: skus = [] } = useQuery({
    queryKey: ['skus-waste'],
    queryFn: () => skuApi.listPage({ limit: 200 }).then((r) => r.items),
    enabled: showForm,
  });

  const createMut = useMutation({
    mutationFn: () => wasteApi.create({
      wasteType: form.wasteType,
      batchId: form.batchId || undefined,
      materialId: form.materialId || undefined,
      skuId: form.skuId || undefined,
      quantity: Number(form.quantity) || 1,
      unit: form.unit,
      reasonCode: form.reasonCode,
      unitCost: form.unitCost ? Number(form.unitCost) : undefined,
    }),
    onSuccess: (r) => {
      setShowForm(false);
      showSuccess(`Waste record ${r.wasteCode} created`);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const recoveryMut = useMutation({
    mutationFn: () => wasteApi.recordRecovery(recoverId!, { recoveryAction }),
    onSuccess: () => {
      setRecoverId(null);
      showSuccess('Recovery recorded');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleExport = async () => {
    try {
      const blob = await wasteApi.exportCsv({
        search: search || undefined,
        wasteType: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'waste-records.csv';
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('Export downloaded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const chartData = recordToChartData(stats?.byType);
  const wasteTypes = (catalog?.wasteTypes as string[] | undefined) ?? [
    'FABRIC_SCRAP', 'THREAD_WASTE', 'REJECTED_PIECES', 'PRODUCTION_SCRAP',
  ];
  const recoveryActions = ((catalog?.recoveryActions as string[] | undefined) ?? ['RECYCLE', 'REUSE', 'DISPOSE'])
    .filter((a) => a !== 'NONE');

  return (
    <div>
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Waste Management"
        subtitle="Track scrap, rejects, and recovery actions across production"
        actions={(
          <div className="flex flex-wrap gap-2">
            <ErpButton variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </ErpButton>
            {canExport && (
              <ErpButton variant="secondary" onClick={handleExport}>
                <Download className="mr-1 inline h-3.5 w-3.5" />
                Export
              </ErpButton>
            )}
            {canCreate && (
              <ErpButton onClick={() => setShowForm((v) => !v)}>
                <Plus className="mr-1 inline h-3.5 w-3.5" />
                Record waste
              </ErpButton>
            )}
          </div>
        )}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Total cost</span>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(stats?.totalCost)}</p>
        </ErpCard>
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Records</span>
          <p className="mt-1 text-lg font-semibold">{stats?.totalRecords ?? '—'}</p>
        </ErpCard>
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Awaiting recovery</span>
          <p className="mt-1 text-lg font-semibold">{stats?.recordedCount ?? '—'}</p>
        </ErpCard>
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Recovered</span>
          <p className="mt-1 text-lg font-semibold">{stats?.recoveredCount ?? '—'}</p>
        </ErpCard>
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Last 7 days</span>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(stats?.periodCost7d)}</p>
        </ErpCard>
        <ErpCard className="p-3">
          <Link to="/reports/waste" className="block hover:opacity-90">
            <span className="text-[10px] text-erp-text-muted">Top type</span>
            <p className="mt-1 text-sm font-semibold">{stats?.topType ? typeLabel(stats.topType) : '—'}</p>
          </Link>
        </ErpCard>
      </div>

      {chartData.length > 0 && (
        <ErpCard className="mb-6 p-4">
          <p className="mb-3 text-sm font-medium">Waste by type (quantity)</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--erp-text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--erp-glass-elevated)', border: '1px solid var(--erp-border)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="value" fill="var(--erp-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ErpCard>
      )}

      {showForm && canCreate && (
        <ErpCard className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-medium">New waste record</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label>
              <span className={fieldLabel}>Type</span>
              <ErpSelect value={form.wasteType} onChange={(e) => setForm((f) => ({ ...f, wasteType: e.target.value }))}>
                {wasteTypes.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </ErpSelect>
            </label>
            <label>
              <span className={fieldLabel}>Batch</span>
              <ErpSelect value={form.batchId} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}>
                <option value="">None</option>
                {batches.map((b) => <option key={b._id} value={b._id}>{b.batchNumber}</option>)}
              </ErpSelect>
            </label>
            <label>
              <span className={fieldLabel}>Material</span>
              <ErpSelect value={form.materialId} onChange={(e) => {
                const mat = materials.find((m) => m._id === e.target.value);
                setForm((f) => ({
                  ...f,
                  materialId: e.target.value,
                  unit: mat?.unit || f.unit,
                  unitCost: mat?.unitCost != null ? String(mat.unitCost) : f.unitCost,
                }));
              }}>
                <option value="">None</option>
                {materials.map((m) => <option key={m._id} value={m._id}>{m.materialCode} — {m.name}</option>)}
              </ErpSelect>
            </label>
            <label>
              <span className={fieldLabel}>SKU</span>
              <ErpSelect value={form.skuId} onChange={(e) => setForm((f) => ({ ...f, skuId: e.target.value }))}>
                <option value="">None</option>
                {skus.map((s) => <option key={s._id} value={s._id}>{s.skuCode}</option>)}
              </ErpSelect>
            </label>
            <label>
              <span className={fieldLabel}>Quantity</span>
              <ErpInput type="number" min={0.01} step={0.01} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </label>
            <label>
              <span className={fieldLabel}>Unit</span>
              <ErpInput value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </label>
            <label>
              <span className={fieldLabel}>Unit cost</span>
              <ErpInput type="number" min={0} value={form.unitCost} onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))} placeholder="Auto from material" />
            </label>
            <label>
              <span className={fieldLabel}>Reason</span>
              <ErpSelect value={form.reasonCode} onChange={(e) => setForm((f) => ({ ...f, reasonCode: e.target.value }))}>
                {((catalog?.reasonCodes as string[]) ?? ['MANUAL', 'CUTTING', 'QC_REJECT']).map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </ErpSelect>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <ErpButton disabled={createMut.isPending} onClick={() => createMut.mutate()}>Save record</ErpButton>
            <ErpButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</ErpButton>
          </div>
        </ErpCard>
      )}

      <ErpCard className="p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <span className={fieldLabel}>Search code</span>
            <div className="flex gap-2">
              <ErpInput
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="WST-…"
                onKeyDown={(e) => e.key === 'Enter' && (setSearch(searchInput), setPage(1))}
              />
              <ErpButton variant="secondary" onClick={() => { setSearch(searchInput); setPage(1); }}>
                <Search className="h-3.5 w-3.5" />
              </ErpButton>
            </div>
          </div>
          <label>
            <span className={fieldLabel}>Type</span>
            <ErpSelect value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {wasteTypes.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </ErpSelect>
          </label>
          <label>
            <span className={fieldLabel}>Status</span>
            <ErpSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="RECORDED">Recorded</option>
              <option value="RECOVERED">Recovered</option>
            </ErpSelect>
          </label>
        </div>

        <ErpDataTable>
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Batch / Material</th>
              <th>Qty</th>
              <th>Cost</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="py-8 text-center text-erp-text-muted">Loading…</td></tr>
            ) : records.map((r: WasteRecord) => (
              <tr key={r._id}>
                <td className="font-mono text-xs">{r.wasteCode}</td>
                <td>{typeLabel(r.wasteType)}</td>
                <td className="text-xs text-erp-text-muted">
                  {batchLabel(r.batchId)}
                  {r.materialId && <span className="block">{materialLabel(r.materialId)}</span>}
                  {r.skuId && <span className="block">{skuLabel(r.skuId)}</span>}
                </td>
                <td>{r.quantity} {r.unit}</td>
                <td>{formatCurrency(r.totalCost)}</td>
                <td>
                  <ErpStatusBadge status={r.status} label={statusLabel(r.status)} />
                  {r.recoveryAction && r.status === 'RECOVERED' && (
                    <span className="ml-1 text-[10px] text-erp-text-muted">({recoveryLabel(r.recoveryAction)})</span>
                  )}
                </td>
                <td className="text-right">
                  {canUpdate && r.status === 'RECORDED' && (
                    <ErpButton variant="secondary" className={btnSm} onClick={() => setRecoverId(r._id)}>
                      <Recycle className="mr-0.5 inline h-3 w-3" />
                      Recover
                    </ErpButton>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && records.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-erp-text-muted">No waste records</td></tr>
            )}
          </tbody>
        </ErpDataTable>

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-erp-text-muted">
            <span>Page {meta.page} of {meta.totalPages} · {meta.total} total</span>
            <div className="flex gap-2">
              <ErpButton variant="secondary" className={btnSm} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</ErpButton>
              <ErpButton variant="secondary" className={btnSm} disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
            </div>
          </div>
        )}
      </ErpCard>

      {recoverId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <ErpCard className="w-full max-w-sm p-5">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Trash2 className="h-4 w-4" />
              Record recovery
            </h3>
            <label className="block">
              <span className={fieldLabel}>Recovery action</span>
              <ErpSelect value={recoveryAction} onChange={(e) => setRecoveryAction(e.target.value)}>
                {recoveryActions.map((a) => <option key={a} value={a}>{recoveryLabel(a)}</option>)}
              </ErpSelect>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setRecoverId(null)}>Cancel</ErpButton>
              <ErpButton disabled={recoveryMut.isPending} onClick={() => recoveryMut.mutate()}>Confirm</ErpButton>
            </div>
          </ErpCard>
        </div>
      )}
    </div>
  );
}
