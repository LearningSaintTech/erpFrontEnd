import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Barcode, CheckCircle2, Layers, Package, RefreshCw, Search, Tag } from 'lucide-react';
import { skuApi } from '../../services/manufacturing';
import { AlertBanner } from '../../components/AlertBanner';
import {
  ErpPageHeader, ErpStatusBadge, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpTabs,
} from '../../components/erp';
import type { Sku, SkuEligibleSample } from '../../types/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { colorSwatch, designIdOf, designLabel, formatPrice, sampleLabel, statusLabel } from './skuUtils';

const PAGE_SIZE = 20;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';

type TabId = 'active' | 'all';

export function SkusPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('sku.create');
  const canUpdate = permissions.includes('*') || permissions.includes('sku.update');

  const [tab, setTab] = useState<TabId>('active');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', basePrice: '', status: 'ACTIVE' });

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const listParams = useMemo(() => {
    if (tab === 'active') return { status: statusFilter || 'ACTIVE' };
    return { status: statusFilter || undefined };
  }, [tab, statusFilter]);

  const { data: stats } = useQuery({ queryKey: ['sku-stats'], queryFn: skuApi.stats });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['skus', page, listParams, search, tab],
    queryFn: () => skuApi.listPage({ page, limit: PAGE_SIZE, search: search || undefined, ...listParams }),
  });

  const skus = data?.items ?? [];
  const meta = data?.meta;

  const { data: eligible = [] } = useQuery({
    queryKey: ['sku-eligible-samples'],
    queryFn: skuApi.eligibleSamples,
    enabled: canCreate,
  });

  const { data: preview } = useQuery({
    queryKey: ['sku-preview', selectedSampleId],
    queryFn: () => skuApi.preview(selectedSampleId),
    enabled: !!selectedSampleId,
  });

  const selectedSample = eligible.find((s: SkuEligibleSample) => s._id === selectedSampleId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['skus'] });
    qc.invalidateQueries({ queryKey: ['sku-stats'] });
    qc.invalidateQueries({ queryKey: ['sku-eligible-samples'] });
    qc.invalidateQueries({ queryKey: ['sku-preview'] });
  };

  const bulkMutation = useMutation({
    mutationFn: () => skuApi.bulkCreate({
      sampleId: selectedSampleId,
      designId: typeof selectedSample!.designId === 'string'
        ? selectedSample!.designId
        : selectedSample!.designId!._id,
      basePrice: basePrice ? Number(basePrice) : undefined,
    }),
    onSuccess: (result) => {
      setBulkConfirm(false);
      setSelectedSampleId('');
      invalidate();
      showSuccess(`Created ${result.created.length} SKU(s)${result.skipped.length ? `, skipped ${result.skipped.length} existing` : ''}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => skuApi.update(id, {
      name: editForm.name || undefined,
      basePrice: editForm.basePrice ? Number(editForm.basePrice) : undefined,
      status: editForm.status,
    }),
    onSuccess: () => {
      setEditId(null);
      invalidate();
      showSuccess('SKU updated');
    },
    onError: (e: Error) => setError(e.message),
  });

  const startEdit = (s: Sku) => {
    setEditId(s._id);
    setEditForm({
      name: s.name,
      basePrice: String(s.basePrice ?? ''),
      status: s.status,
    });
  };

  return (
    <div className="skus-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="SKUs"
        subtitle={(
          <>
            Sellable variants from approved samples — uses design size/color matrix and SKU formula.
            <Link to="/sampling" className="ml-2 text-[var(--erp-accent)]">Sampling →</Link>
            <Link to="/settings/inventory-codes" className="ml-2 text-[var(--erp-accent)]">SKU formula →</Link>
          </>
        )}
        actions={(
          <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            <span className="ml-1">Refresh</span>
          </ErpButton>
        )}
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Total</p>
              <p className="text-lg font-semibold">{stats?.total ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Active</p>
              <p className="text-lg font-semibold">{stats?.active ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-amber-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Draft</p>
              <p className="text-lg font-semibold">{stats?.draft ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Barcode size={16} className="text-erp-text-muted" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Discontinued</p>
              <p className="text-lg font-semibold">{stats?.discontinued ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
      </div>

      {canCreate && (
        <ErpCard className="mb-3 !p-3">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-[var(--erp-accent)]" />
            <h3 className="text-[11px] font-semibold text-erp-text-primary">Generate SKUs from approved sample</h3>
          </div>
          <p className="mt-1 text-[10px] text-erp-text-muted">
            Bulk-create all size/color combinations from the design matrix. Existing codes are skipped.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <label className={fieldLabel}>Approved sample</label>
              <ErpSelect className="w-full !py-1.5 text-[11px]" value={selectedSampleId} onChange={(e) => setSelectedSampleId(e.target.value)}>
                <option value="">Select sample…</option>
                {eligible.map((s: SkuEligibleSample) => (
                  <option key={s._id} value={s._id}>
                    {s.sampleCode} — {s.designCode} ({s.matrixRows || 0} variants, {s.existingSkus} SKUs)
                  </option>
                ))}
              </ErpSelect>
            </div>
            <div className="w-28">
              <label className={fieldLabel}>Base price</label>
              <ErpInput className="!py-1.5 text-[11px]" type="number" min={0} placeholder="Auto" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
            <ErpButton
              className="!px-3 !py-1.5 text-[11px]"
              disabled={!selectedSampleId || !preview?.newCount}
              onClick={() => setBulkConfirm(true)}
            >
              Generate {preview?.newCount ?? 0} SKU(s)
            </ErpButton>
          </div>
          {preview && (preview.previews?.length ?? 0) > 0 && (
            <div className="mt-3 max-h-32 overflow-y-auto rounded border border-[var(--erp-border)] p-2 text-[10px] text-erp-text-muted">
              {preview.previews!.map((p, i) => (
                <div key={i} className={p.exists ? 'opacity-50' : ''}>
                  <span className="font-mono">{p.skuCode}</span> — {p.size} / {p.color?.name ?? '—'}
                  {p.exists && ' (exists)'}
                </div>
              ))}
            </div>
          )}
        </ErpCard>
      )}

      <ErpTabs
        tabs={[
          { id: 'active', label: `Active (${stats?.active ?? 0})` },
          { id: 'all', label: `All (${stats?.total ?? 0})` },
        ]}
        active={tab}
        onChange={(id) => { setTab(id as TabId); setPage(1); setStatusFilter(''); }}
      />

      <ErpCard className="mt-3 !p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--erp-border)] p-3">
          <div className="relative min-w-[180px] flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
            <ErpInput
              className="!py-1.5 pl-7 text-[11px]"
              placeholder="Search code, name, design…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
            />
          </div>
          {tab === 'all' && (
            <ErpSelect className="!py-1.5 text-[11px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="DISCONTINUED">Discontinued</option>
            </ErpSelect>
          )}
          <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => { setSearch(searchInput); setPage(1); }}>Search</ErpButton>
        </div>

        {isLoading ? (
          <p className="p-6 text-center text-[11px] text-erp-text-muted">Loading SKUs…</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[900px] text-[11px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">Design</th>
                  <th className="px-3 py-2 text-left">Sample</th>
                  <th className="px-3 py-2 text-left">Size / Color</th>
                  <th className="px-3 py-2 text-left">Price</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {skus.map((s: Sku) => (
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
                    <td className="px-3 py-2"><ErpStatusBadge status={s.status} label={statusLabel(s.status)} /></td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {canUpdate && editId !== s._id && (
                          <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => startEdit(s)}>Edit</ErpButton>
                        )}
                        <Link to="/boms" className="erp-btn-secondary !px-2 !py-1 text-[10px]">BOM →</Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {editId && skus.find((s) => s._id === editId) && (
                  <tr className="bg-[var(--erp-surface-muted)]">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[180px] flex-1">
                          <label className={fieldLabel}>Name</label>
                          <ErpInput className="!py-1 text-[11px]" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="w-24">
                          <label className={fieldLabel}>Price</label>
                          <ErpInput className="!py-1 text-[11px]" type="number" min={0} value={editForm.basePrice} onChange={(e) => setEditForm((f) => ({ ...f, basePrice: e.target.value }))} />
                        </div>
                        <div className="w-28">
                          <label className={fieldLabel}>Status</label>
                          <ErpSelect className="!py-1 text-[11px]" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                            <option value="ACTIVE">Active</option>
                            <option value="DRAFT">Draft</option>
                            <option value="DISCONTINUED">Discontinued</option>
                          </ErpSelect>
                        </div>
                        <ErpButton className="!px-2 !py-1 text-[10px]" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(editId)}>Save</ErpButton>
                        <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => setEditId(null)}>Cancel</ErpButton>
                      </div>
                    </td>
                  </tr>
                )}
                {skus.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[11px] text-erp-text-muted">
                      No SKUs yet — approve a sample, then bulk-generate from the size/color matrix
                    </td>
                  </tr>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}
        {meta && meta.totalPages > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2">
            <p className="text-[10px] text-erp-text-muted">{meta.page}/{meta.totalPages} · {meta.total} total</p>
            <div className="flex gap-1">
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</ErpButton>
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
            </div>
          </div>
        )}
      </ErpCard>

      <ConfirmDialog
        open={bulkConfirm}
        title={`Generate ${preview?.newCount ?? 0} SKU(s)?`}
        message={`From sample ${preview?.sampleCode}. ${preview?.skipCount ?? 0} existing code(s) will be skipped.`}
        confirmLabel="Generate"
        loading={bulkMutation.isPending}
        onCancel={() => setBulkConfirm(false)}
        onConfirm={() => bulkMutation.mutate()}
      />
    </div>
  );
}
