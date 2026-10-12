import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { inventoryCodeApi } from '../../../services/manufacturing';
import type { InventoryCode, InventoryCodeType } from '../../../types/api';
import {
  Button, Drawer, EmptyRow, ErpDataTable, ErpInput, ErpSelect, Field, FilterBar, RowActionsMenu,
  SearchInput, Section, StatusBadge, TablePager, TableSkeleton, useConfirm,
} from '../../../components/erp';
import { QueryState } from '../../../components/QueryState';
import { CODE_TYPES, CODE_TYPE_GROUPS, codeTypeLabel } from '../inventoryCodeUtils';
import { useDebouncedValue } from '../../users/useDebouncedValue';

const PAGE_SIZE = 20;

type FormState = {
  type: InventoryCodeType;
  code: string;
  name: string;
  sortOrder: number;
  remarks: string;
};

const emptyForm = (type?: InventoryCodeType): FormState => ({
  type: type ?? 'CATEGORY',
  code: '',
  name: '',
  sortOrder: 0,
  remarks: '',
});

function TypeOptions({ counts }: { counts?: Record<string, number> }) {
  return (
    <>
      {CODE_TYPE_GROUPS.map((group) => (
        <optgroup key={group} label={group}>
          {CODE_TYPES.filter((t) => t.group === group).map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}{counts ? ` (${counts[t.value] ?? 0})` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export function InventoryCodesTab({
  canConfigure,
  createOpen,
  onCreateOpenChange,
}: {
  canConfigure: boolean;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<InventoryCode | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
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
  const hasFilters = !!(search || typeFilter || showInactive);
  const clear = () => { setSearchInput(''); setTypeFilter(''); setShowInactive(false); setPage(1); };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inventory-codes-page'] });
    qc.invalidateQueries({ queryKey: ['inventory-codes'] });
    qc.invalidateQueries({ queryKey: ['inventory-codes-stats'] });
  };

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => inventoryCodeApi.update(id, { isActive }),
    onSuccess: invalidate,
    meta: { successMessage: 'Status updated' },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => inventoryCodeApi.delete(id),
    meta: { successMessage: 'Code deleted' },
    onSuccess: invalidate,
  });

  const askDelete = async (c: InventoryCode) => {
    const ok = await confirm({
      title: `Delete ${c.code}?`,
      message: `"${c.name}" is removed from the ${codeTypeLabel(c.type).toLowerCase()} list. Designs that already use it may need review. Deactivate instead if you only want to hide it.`,
      confirmLabel: 'Delete code',
      tone: 'danger',
    });
    if (ok) deleteMut.mutate(c._id);
  };

  const cols = canConfigure ? 6 : 5;

  return (
    <>
      <Section flush>
        <FilterBar
          search={<SearchInput value={searchInput} onChange={(v) => { setSearchInput(v); setPage(1); }} placeholder="Search code, name or remarks…" inputSize="sm" />}
          filters={(
            <>
              <ErpSelect inputSize="sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} aria-label="Code type">
                <option value="">All types</option>
                <TypeOptions counts={typeCounts} />
              </ErpSelect>
              <label className="flex items-center gap-2 text-[13px] text-erp-text-secondary">
                <input type="checkbox" className="h-4 w-4 rounded accent-[var(--erp-accent)]" checked={showInactive} onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }} />
                Inactive only
              </label>
            </>
          )}
          onClear={hasFilters ? clear : undefined}
        />
        <QueryState isError={isError} error={error} onRetry={refetch}>
          <ErpDataTable>
            <thead>
              <tr>
                <th>Type</th>
                <th>Code</th>
                <th>Name</th>
                <th className="erp-num">Sort order</th>
                <th>Status</th>
                {canConfigure && <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton asRows rows={6} columns={cols} />
              ) : codes.length === 0 ? (
                <EmptyRow
                  colSpan={cols}
                  icon={Tags}
                  title={hasFilters ? 'No codes match these filters' : 'No inventory codes yet'}
                  action={hasFilters
                    ? <Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button>
                    : canConfigure ? <Button size="sm" icon={<Plus size={16} />} onClick={() => onCreateOpenChange(true)}>New code</Button> : undefined}
                >
                  {hasFilters ? undefined : 'Codes such as categories, fits and colours are used to build SKUs.'}
                </EmptyRow>
              ) : codes.map((c) => (
                <tr
                  key={c._id}
                  className={canConfigure ? 'erp-row-clickable' : undefined}
                  onClick={canConfigure ? () => setEditing(c) : undefined}
                >
                  <td className="text-erp-text-secondary">{codeTypeLabel(c.type)}</td>
                  <td className="erp-cell-primary font-mono">{c.code}</td>
                  <td>{c.name}</td>
                  <td className="erp-num">{c.sortOrder ?? 0}</td>
                  <td><StatusBadge status={c.isActive !== false ? 'ACTIVE' : 'INACTIVE'} /></td>
                  {canConfigure && (
                    <td className="erp-cell-actions">
                      <RowActionsMenu items={[
                        { label: 'Edit', icon: Pencil, onSelect: () => setEditing(c) },
                        c.isActive !== false
                          ? { label: 'Deactivate', icon: Ban, onSelect: () => toggleMut.mutate({ id: c._id, isActive: false }) }
                          : { label: 'Activate', icon: CheckCircle2, onSelect: () => toggleMut.mutate({ id: c._id, isActive: true }) },
                        { type: 'separator' },
                        { label: 'Delete', icon: Trash2, danger: true, onSelect: () => askDelete(c) },
                      ]} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
          {meta && (
            <TablePager
              page={page}
              totalPages={meta.totalPages}
              total={meta.total}
              pageSize={PAGE_SIZE}
              itemLabel="codes"
              onPrev={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </QueryState>
      </Section>

      {canConfigure && (
        <CodeFormDrawer
          open={createOpen || !!editing}
          editing={editing}
          defaultType={(typeFilter || undefined) as InventoryCodeType | undefined}
          onClose={() => { setEditing(null); onCreateOpenChange(false); }}
          onSaved={invalidate}
        />
      )}
    </>
  );
}

function CodeFormDrawer({
  open, editing, defaultType, onClose, onSaved,
}: {
  open: boolean;
  editing: InventoryCode | null;
  defaultType?: InventoryCodeType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(editing
      ? { type: editing.type, code: editing.code, name: editing.name, sortOrder: editing.sortOrder ?? 0, remarks: editing.remarks || '' }
      : emptyForm(defaultType));
  }, [open, editing, defaultType]);

  const save = useMutation({
    mutationFn: () => {
      const body = { type: form.type, code: form.code.trim(), name: form.name.trim(), sortOrder: form.sortOrder, remarks: form.remarks };
      return editing ? inventoryCodeApi.update(editing._id, body) : inventoryCodeApi.create(body);
    },
    meta: { successMessage: editing ? 'Code updated' : 'Code created' },
    onSuccess: () => { onSaved(); onClose(); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.code.trim()) next.code = 'Enter the short code used in SKUs, e.g. BLK.';
    if (!form.name.trim()) next.name = 'Enter a readable name, e.g. Black.';
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };

  const hint = CODE_TYPES.find((t) => t.value === form.type)?.hint;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={false}
      title={editing ? `Edit ${editing.code}` : 'New inventory code'}
      description="Codes feed SKU generation and the dropdowns on designs, patterns and BOMs."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="code-form" loading={save.isPending}>{editing ? 'Save changes' : 'Create code'}</Button>
        </>
      )}
    >
      <form id="code-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Type" required hint={hint}>
          <ErpSelect value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as InventoryCodeType }))}>
            <TypeOptions />
          </ErpSelect>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" required error={errors.code}>
            <ErpInput className="font-mono" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} autoFocus />
          </Field>
          <Field label="Name" required error={errors.name}>
            <ErpInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Sort order" hint="Lower numbers appear first.">
            <ErpInput type="number" min={0} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
          </Field>
        </div>
        <Field label="Remarks">
          <ErpInput value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
        </Field>
      </form>
    </Drawer>
  );
}
