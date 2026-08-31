import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { inventoryCodeApi } from '../../../services/manufacturing';
import type { InventoryCode, InventoryCodeType } from '../../../types/api';
import {
  ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../../components/erp';
import { ConfirmDialog } from '../../users/ConfirmDialog';
import { CODE_TYPES, CODE_TYPE_GROUPS, codeTypeLabel } from '../inventoryCodeUtils';

const PAGE_SIZE = 20;

type FormState = {
  type: InventoryCodeType;
  code: string;
  name: string;
  sortOrder: number;
  remarks: string;
};

const emptyForm = (): FormState => ({
  type: 'CATEGORY',
  code: '',
  name: '',
  sortOrder: 0,
  remarks: '',
});

export function InventoryCodesTab({
  onError,
  onSuccess,
  canConfigure,
}: {
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
  canConfigure: boolean;
}) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryCode | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<InventoryCode | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['inventory-codes-page', page, typeFilter, showInactive, search],
    queryFn: () => inventoryCodeApi.listPage({
      page,
      limit: PAGE_SIZE,
      type: typeFilter || undefined,
      inactiveOnly: showInactive || undefined,
      search: search || undefined,
    }),
  });

  const { data: typeCounts = {} } = useQuery({
    queryKey: ['inventory-codes-stats'],
    queryFn: inventoryCodeApi.stats,
  });

  const codes = data?.items ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (editing) {
      setForm({
        type: editing.type,
        code: editing.code,
        name: editing.name,
        sortOrder: editing.sortOrder ?? 0,
        remarks: editing.remarks || '',
      });
      setFormOpen(true);
    }
  }, [editing]);

  const kpis = useMemo(() => (
    CODE_TYPES.map((t) => ({
      type: t.value,
      label: t.label,
      count: typeCounts[t.value] ?? 0,
    }))
  ), [typeCounts]);

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        type: form.type,
        code: form.code.trim(),
        name: form.name.trim(),
        sortOrder: form.sortOrder,
        remarks: form.remarks,
      };
      return editing
        ? inventoryCodeApi.update(editing._id, body)
        : inventoryCodeApi.create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-codes-page'] });
      qc.invalidateQueries({ queryKey: ['inventory-codes'] });
      qc.invalidateQueries({ queryKey: ['inventory-codes-stats'] });
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm());
      onSuccess(editing ? 'Code updated' : 'Code created');
    },
    onError: (e: Error) => onError(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      inventoryCodeApi.update(id, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-codes-page'] });
      qc.invalidateQueries({ queryKey: ['inventory-codes'] });
      qc.invalidateQueries({ queryKey: ['inventory-codes-stats'] });
      onSuccess('Status updated');
    },
    onError: (e: Error) => onError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => inventoryCodeApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-codes-page'] });
      qc.invalidateQueries({ queryKey: ['inventory-codes'] });
      qc.invalidateQueries({ queryKey: ['inventory-codes-stats'] });
      setDeleteTarget(null);
      onSuccess('Code deleted');
    },
    onError: (e: Error) => onError(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm());
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {kpis.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => { setTypeFilter(t.type === typeFilter ? '' : t.type); setPage(1); }}
            className="text-left"
          >
            <ErpCard className={`!p-3${typeFilter === t.type ? ' ring-1 ring-[var(--erp-accent)]' : ''}`}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">{t.label}</p>
              <p className="mt-0.5 text-lg font-semibold text-erp-text-primary">{t.count}</p>
              <p className="mt-0.5 text-[10px] text-erp-text-muted">codes</p>
            </ErpCard>
          </button>
        ))}
      </div>

      <ErpCard className="!p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Search</label>
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
              <ErpInput
                className="!pl-7 !py-1.5 text-[11px]"
                placeholder="Code, name, remarks…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(searchInput.trim());
                    setPage(1);
                  }
                }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Type</label>
            <ErpSelect
              className="!py-1.5 text-[11px]"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">All types</option>
              {CODE_TYPE_GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {CODE_TYPES.filter((t) => t.group === group).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </ErpSelect>
          </div>
          <label className="flex items-center gap-1.5 pb-1.5 text-[11px] text-erp-text-muted">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }}
              className="rounded"
            />
            Inactive only
          </label>
          <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => { setSearch(searchInput.trim()); setPage(1); }}>
            Search
          </ErpButton>
          <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          </ErpButton>
          {canConfigure && (
            <ErpButton className="!px-2 !py-1.5 text-[11px]" onClick={openCreate}>
              <Plus size={12} className="mr-1 inline" /> Add code
            </ErpButton>
          )}
        </div>
      </ErpCard>

      {formOpen && canConfigure && (
        <ErpCard className="!p-3">
          <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">
            {editing ? 'Edit code' : 'New inventory code'}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] text-erp-text-muted">Type</label>
              <ErpSelect
                className="w-full !py-1.5 text-[11px]"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as InventoryCodeType }))}
              >
                {CODE_TYPE_GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {CODE_TYPES.filter((t) => t.group === group).map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </optgroup>
                ))}
              </ErpSelect>
              <p className="mt-0.5 text-[10px] text-erp-text-muted">
                {CODE_TYPES.find((t) => t.value === form.type)?.hint}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-erp-text-muted">Code</label>
              <ErpInput className="w-full !py-1.5 font-mono text-[11px]" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-erp-text-muted">Name</label>
              <ErpInput className="w-full !py-1.5 text-[11px]" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-erp-text-muted">Sort order</label>
              <ErpInput type="number" min={0} className="w-full !py-1.5 text-[11px]" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] text-erp-text-muted">Remarks</label>
              <ErpInput className="w-full !py-1.5 text-[11px]" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <ErpButton
              className="!px-3 !py-1.5 text-[11px]"
              disabled={!form.code.trim() || !form.name.trim() || saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? 'Saving…' : editing ? 'Update' : 'Create'}
            </ErpButton>
            <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={closeForm}>Cancel</ErpButton>
          </div>
        </ErpCard>
      )}

      <ErpCard className="overflow-hidden !p-0">
        {isLoading ? (
          <p className="p-4 text-[11px] text-erp-text-muted">Loading codes…</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Order</th>
                  <th>Status</th>
                  {canConfigure && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c._id}>
                    <td className="text-[11px]">{codeTypeLabel(c.type)}</td>
                    <td className="font-mono text-[11px]">{c.code}</td>
                    <td className="text-[11px]">{c.name}</td>
                    <td className="text-[11px] text-erp-text-muted">{c.sortOrder ?? 0}</td>
                    <td>
                      <ErpStatusBadge status={c.isActive !== false ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    {canConfigure && (
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <ErpButton
                            variant="secondary"
                            className="!px-1.5 !py-1 text-[10px]"
                            onClick={() => toggleMut.mutate({ id: c._id, isActive: c.isActive === false })}
                          >
                            {c.isActive !== false ? 'Deactivate' : 'Activate'}
                          </ErpButton>
                          <ErpButton variant="secondary" className="!px-1.5 !py-1" onClick={() => setEditing(c)}>
                            <Pencil size={11} />
                          </ErpButton>
                          <ErpButton variant="secondary" className="!px-1.5 !py-1 !text-red-500" onClick={() => setDeleteTarget(c)}>
                            <Trash2 size={11} />
                          </ErpButton>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {codes.length === 0 && (
                  <tr>
                    <td colSpan={canConfigure ? 6 : 5} className="px-4 py-8 text-center text-[11px] text-erp-text-muted">
                      No codes match your filters
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
        open={!!deleteTarget}
        title="Delete inventory code"
        message={`Remove "${deleteTarget?.code}" (${deleteTarget?.name})? Designs referencing this code may need manual review.`}
        confirmLabel="Delete"
        danger
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget._id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
