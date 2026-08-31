import { useMemo, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, CheckCircle2, ClipboardList, FileStack, RefreshCw, Search, Wrench,
} from 'lucide-react';
import { bomApi, skuApi, inventoryApi } from '../../services/manufacturing';
import { AlertBanner } from '../../components/AlertBanner';
import {
  ErpPageHeader, ErpStatusBadge, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpTabs,
} from '../../components/erp';
import type { Bom, BomLine, Material, MrpPreview, Sku } from '../../types/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import {
  formatCost, materialIdOf, materialLabel, mrpShortageCount, skuIdOf, skuLabel, statusLabel, workflowStep,
} from './bomUtils';

const PAGE_SIZE = 20;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';

type TabId = 'active' | 'draft' | 'all';
type EditLine = { materialId: string; quantityPerPiece: number; unit: string; wastagePercent: number };

export function BomsPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('bom.create');
  const canUpdate = permissions.includes('*') || permissions.includes('bom.update');
  const canApprove = permissions.includes('*') || permissions.includes('bom.approve');

  const [tab, setTab] = useState<TabId>('active');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createSkuId, setCreateSkuId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [confirmAction, setConfirmAction] = useState<{ id: string; step: 'approve' | 'finalize'; label: string } | null>(null);
  const [mrpView, setMrpView] = useState<{ bomId: string; mrp: MrpPreview } | null>(null);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const listParams = useMemo(() => {
    if (tab === 'active') return { status: 'ACTIVE' };
    if (tab === 'draft') return { status: 'DRAFT' };
    return { status: statusFilter || undefined };
  }, [tab, statusFilter]);

  const { data: stats } = useQuery({ queryKey: ['bom-stats'], queryFn: bomApi.stats });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['boms', page, listParams, search, tab],
    queryFn: () => bomApi.listPage({ page, limit: PAGE_SIZE, search: search || undefined, ...listParams }),
  });

  const boms = data?.items ?? [];
  const meta = data?.meta;

  const { data: skus = [] } = useQuery({
    queryKey: ['skus-active-bom'],
    queryFn: () => skuApi.list({ status: 'ACTIVE', limit: 200 }),
    enabled: canCreate,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => inventoryApi.listMaterials(),
    enabled: !!editingId || canCreate,
  });

  const { data: suggestion } = useQuery({
    queryKey: ['bom-suggest', createSkuId],
    queryFn: () => bomApi.suggestLines(createSkuId),
    enabled: !!createSkuId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['boms'] });
    qc.invalidateQueries({ queryKey: ['bom-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: () => bomApi.create({ skuId: createSkuId, fromDesign: true }),
    onSuccess: () => {
      setCreateSkuId('');
      invalidate();
      showSuccess('BOM created from design — review lines and approve');
    },
    onError: (e: Error) => setError(e.message),
  });

  const saveLines = useMutation({
    mutationFn: ({ id, lines }: { id: string; lines: EditLine[] }) =>
      bomApi.update(id, lines.map((l) => ({
        materialId: l.materialId,
        quantityPerPiece: l.quantityPerPiece,
        unit: l.unit,
        wastagePercent: l.wastagePercent,
      }))),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      showSuccess('BOM lines saved');
    },
    onError: (e: Error) => setError(e.message),
  });

  const workflow = useMutation({
    mutationFn: async ({ id, step }: { id: string; step: 'approve' | 'finalize' }) => {
      if (step === 'approve') return bomApi.approve(id);
      return bomApi.finalize(id);
    },
    onSuccess: (result, vars) => {
      setConfirmAction(null);
      invalidate();
      if (vars.step === 'finalize' && result && 'mrp' in result) {
        setMrpView({ bomId: vars.id, mrp: result.mrp });
        showSuccess('BOM activated — MRP preview generated');
      } else {
        showSuccess('BOM approved — ready to finalize');
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const loadMrp = useMutation({
    mutationFn: (id: string) => bomApi.mrpPreview(id),
    onSuccess: (mrp, id) => setMrpView({ bomId: id, mrp }),
    onError: (e: Error) => setError(e.message),
  });

  const startEdit = (b: Bom) => {
    setEditingId(b._id);
    setEditLines((b.lines || []).map((l) => ({
      materialId: materialIdOf(l),
      quantityPerPiece: l.quantityPerPiece,
      unit: l.unit || 'PIECES',
      wastagePercent: l.wastagePercent ?? 0,
    })));
  };

  const addLine = () => {
    const first = materials[0];
    if (!first) return;
    setEditLines((lines) => [...lines, {
      materialId: first._id,
      quantityPerPiece: 1,
      unit: first.unit || 'PIECES',
      wastagePercent: 0,
    }]);
  };

  return (
    <div className="boms-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Bill of Materials"
        subtitle={(
          <>
            Per-SKU material breakdown. Qty and waste freeze here as standard cost (store master rate).
            Purchase books the mill rate; cutting shows actual issued cost.
            <Link to="/skus" className="ml-2 text-[var(--erp-accent)]">SKUs →</Link>
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
            <FileStack size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Total</p>
              <p className="text-lg font-semibold">{stats?.total ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-amber-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Draft</p>
              <p className="text-lg font-semibold">{stats?.draft ?? '—'}</p>
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
            <Wrench size={16} className="text-erp-text-muted" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Approved queue</p>
              <p className="text-lg font-semibold">{stats?.approved ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
      </div>

      {canCreate && (
        <ErpCard className="mb-3 !p-3">
          <div className="flex items-center gap-2">
            <FileStack size={14} className="text-[var(--erp-accent)]" />
            <h3 className="text-[11px] font-semibold text-erp-text-primary">Create BOM</h3>
          </div>
          <p className="mt-1 text-[10px] text-erp-text-muted">
            Lines auto-filled from design BOM tab (or sample materials as fallback). One draft per SKU.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <label className={fieldLabel}>Active SKU</label>
              <ErpSelect className="w-full !py-1.5 text-[11px]" value={createSkuId} onChange={(e) => setCreateSkuId(e.target.value)}>
                <option value="">Select SKU…</option>
                {skus.map((s: Sku) => (
                  <option key={s._id} value={s._id}>{s.skuCode} — {s.name}</option>
                ))}
              </ErpSelect>
            </div>
            <ErpButton className="!px-3 !py-1.5 text-[11px]" disabled={!createSkuId || createMutation.isPending} onClick={() => createMutation.mutate()}>
              Create BOM
            </ErpButton>
          </div>
          {suggestion && (suggestion.lines?.length ?? 0) > 0 && (
            <p className="mt-2 text-[10px] text-erp-text-muted">
              Preview ({suggestion.source}): {suggestion.lines!.length} line(s) — {suggestion.lines!.map((l) => l.materialCode || l.materialName).join(', ')}
            </p>
          )}
        </ErpCard>
      )}

      <ErpTabs
        tabs={[
          { id: 'active', label: `Active (${stats?.active ?? 0})` },
          { id: 'draft', label: `Draft (${stats?.draft ?? 0})` },
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
              placeholder="Search BOM or SKU…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
            />
          </div>
          {tab === 'all' && (
            <ErpSelect className="!py-1.5 text-[11px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="ACTIVE">Active</option>
              <option value="OBSOLETE">Obsolete</option>
            </ErpSelect>
          )}
          <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => { setSearch(searchInput); setPage(1); }}>Search</ErpButton>
        </div>

        {isLoading ? (
          <p className="p-6 text-center text-[11px] text-erp-text-muted">Loading BOMs…</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[960px] text-[11px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">BOM</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">Lines</th>
                  <th className="px-3 py-2 text-left">Std cost/pc</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {boms.map((b: Bom) => {
                  const step = workflowStep(b.status);
                  const isEditing = editingId === b._id;
                  return (
                    <Fragment key={b._id}>
                      <tr className="border-t border-[var(--erp-border)]">
                        <td className="px-3 py-2">
                          <span className="font-mono text-[10px]">{b.bomCode}</span>
                          <p className="text-[10px] text-erp-text-muted">v{b.version} · {step.label}</p>
                        </td>
                        <td className="px-3 py-2">{skuLabel(b.skuId)}</td>
                        <td className="px-3 py-2">{b.lines?.length ?? 0}</td>
                        <td className="px-3 py-2">{formatCost(b.totalCostPerPiece)}</td>
                        <td className="px-3 py-2"><ErpStatusBadge status={b.status} label={statusLabel(b.status)} /></td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {canUpdate && b.status === 'DRAFT' && !isEditing && (
                              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => startEdit(b)}>Edit</ErpButton>
                            )}
                            {canApprove && b.status === 'DRAFT' && (
                              <ErpButton className="!px-2 !py-1 text-[10px]" onClick={() => setConfirmAction({ id: b._id, step: 'approve', label: 'Approve this BOM?' })}>Approve</ErpButton>
                            )}
                            {canUpdate && b.status === 'APPROVED' && (
                              <ErpButton className="!px-2 !py-1 text-[10px]" onClick={() => setConfirmAction({ id: b._id, step: 'finalize', label: 'Freeze this BOM as standard cost and run MRP?' })}>Freeze & MRP</ErpButton>
                            )}
                            {b.status === 'ACTIVE' && (
                              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => loadMrp.mutate(b._id)}>MRP</ErpButton>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="bg-[var(--erp-surface-muted)]">
                          <td colSpan={6} className="px-3 py-3">
                            <p className="mb-2 text-[10px] font-semibold">Edit lines — {b.bomCode}</p>
                            <div className="space-y-2">
                              {editLines.map((l, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-2">
                                  <ErpSelect className="min-w-[140px] !py-1 text-[10px]" value={l.materialId} onChange={(e) => {
                                    const mat = materials.find((m: Material) => m._id === e.target.value);
                                    setEditLines((lines) => lines.map((x, j) => j === i ? { ...x, materialId: e.target.value, unit: mat?.unit || x.unit } : x));
                                  }}>
                                    {materials.map((m: Material) => (
                                      <option key={m._id} value={m._id}>{m.materialCode}</option>
                                    ))}
                                  </ErpSelect>
                                  <ErpInput type="number" min={0} step="0.01" className="w-20 !py-1 text-[10px]" value={l.quantityPerPiece} onChange={(e) => setEditLines((lines) => lines.map((x, j) => j === i ? { ...x, quantityPerPiece: Number(e.target.value) } : x))} />
                                  <span className="text-[10px] text-erp-text-muted">{l.unit}/pc</span>
                                  <ErpInput type="number" min={0} max={100} className="w-16 !py-1 text-[10px]" value={l.wastagePercent} onChange={(e) => setEditLines((lines) => lines.map((x, j) => j === i ? { ...x, wastagePercent: Number(e.target.value) } : x))} />
                                  <span className="text-[10px] text-erp-text-muted">% waste</span>
                                  <span className="text-[10px] text-erp-text-muted">
                                    std {formatCost(materials.find((m: Material) => m._id === l.materialId)?.unitCost)}
                                  </span>
                                  <ErpButton variant="secondary" className="!px-2 !py-0.5 text-[10px]" onClick={() => setEditLines((lines) => lines.filter((_, j) => j !== i))}>Remove</ErpButton>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <ErpButton className="!px-2 !py-1 text-[10px]" disabled={!editLines.length || saveLines.isPending} onClick={() => saveLines.mutate({ id: b._id, lines: editLines })}>Save</ErpButton>
                              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => setEditingId(null)}>Cancel</ErpButton>
                              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={addLine}>Add line</ErpButton>
                            </div>
                          </td>
                        </tr>
                      )}
                      {!isEditing && b.lines && b.lines.length > 0 && (
                        <tr className="text-[10px] text-erp-text-muted">
                          <td colSpan={6} className="border-t border-[var(--erp-border)]/50 px-3 py-1.5">
                            {b.lines.map((l: BomLine, i) => (
                              <span key={i}>
                                {i > 0 && ' · '}
                                {materialLabel(l.materialId)} {l.quantityPerPiece} {l.unit}/pc
                                {(l.wastagePercent ?? 0) > 0 && ` (+${l.wastagePercent}% waste)`}
                                {l.unitCost != null && l.unitCost > 0 && ` · std ${formatCost(l.unitCost)}`}
                              </span>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {boms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[11px] text-erp-text-muted">
                      No BOMs — create active SKUs first, then build a BOM from the design tech pack
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

      {mrpView && (
        <ErpCard className="mt-3 !p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold">MRP preview</h3>
            <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => setMrpView(null)}>Close</ErpButton>
          </div>
          {mrpView.mrp.hasShortage && (
            <div className="mb-2 flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700">
              <AlertTriangle size={12} />
              {mrpShortageCount(mrpView.mrp)} material(s) short — check inventory before production
            </div>
          )}
          <p className="mb-2 text-[10px] text-erp-text-muted">
            Qty {mrpView.mrp.orderQuantity} · Standard {formatCost(mrpView.mrp.totalCost)}
          </p>
          <ErpDataTable className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left">Material</th>
                <th className="px-2 py-1 text-right">Required</th>
                <th className="px-2 py-1 text-right">Available</th>
                <th className="px-2 py-1 text-right">Short</th>
                <th className="px-2 py-1 text-right">Std cost</th>
              </tr>
            </thead>
            <tbody>
              {(mrpView.mrp.lines || []).map((l, i) => (
                <tr key={i} className="border-t border-[var(--erp-border)]">
                  <td className="px-2 py-1">{materialLabel(l.materialId)}</td>
                  <td className="px-2 py-1 text-right">{l.requiredQty} {l.unit}</td>
                  <td className="px-2 py-1 text-right">{l.availableQty}</td>
                  <td className={`px-2 py-1 text-right ${(l.shortageQty ?? 0) > 0 ? 'text-amber-600 font-medium' : ''}`}>{l.shortageQty ?? 0}</td>
                  <td className="px-2 py-1 text-right">{formatCost(l.extendedCost)}</td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        </ErpCard>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.label ?? 'Confirm'}
        message="This advances the BOM lifecycle."
        confirmLabel="Continue"
        loading={workflow.isPending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          workflow.mutate({ id: confirmAction.id, step: confirmAction.step });
        }}
      />
    </div>
  );
}
