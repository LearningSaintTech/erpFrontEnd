import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Ban, CheckCircle2, Download, Pencil, Plus, Users, UserCheck, UserX,
} from 'lucide-react';
import { purchaseApi } from '../../services/operations';
import {
  Button, DescriptionList, Drawer, ErpDataTable, ErpInput, ErpSelect, Field, FilterBar, KpiGrid, PageHeader,
  RowActionsMenu, SearchInput, Section, StatTile, StatusBadge, TablePager, useConfirm,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import type { Supplier } from '../../types/api';
import { downloadCsv } from '../../utils/csvExport';
import { useDebounced, usePurchasePerms, useInvalidatePurchase } from './purchaseShared';

const PAGE_SIZE = 25;

type SupplierListParams = { page?: number; limit?: number; search?: string; status?: string };
/** The service type doesn't declare `status` yet, but GET /suppliers supports it. */
const listSuppliersPage = (params: SupplierListParams) => {
  const p: Parameters<typeof purchaseApi.listSuppliersPage>[0] = params;
  return purchaseApi.listSuppliersPage(p);
};

const emptyForm = {
  supplierCode: '',
  name: '',
  contactPerson: '',
  phone: '',
  contactEmail: '',
  gstNumber: '',
  materialsSupplied: '',
  paymentTerms: '',
  leadTimeDays: '7',
};

function useSupplierPerms() {
  const p = usePurchasePerms();
  return {
    canExport: p.canExport,
    /** POST /suppliers needs purchase.create + purchase.approve. */
    canCreate: p.canCreate && p.canApprove,
    /** PATCH /suppliers/:id needs purchase.update + purchase.approve. */
    canEdit: p.canUpdate && p.canApprove,
  };
}

/* ───────────────────────────── Form drawer ───────────────────────────── */

export function SupplierFormDrawer({
  open, onClose, supplier, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Edit mode when given. */
  supplier?: Supplier | null;
  onSaved?: (s: Supplier) => void;
}) {
  const invalidate = useInvalidatePurchase();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = !!supplier;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(supplier ? {
      supplierCode: supplier.supplierCode,
      name: supplier.name,
      contactPerson: supplier.contactPerson || '',
      phone: supplier.phone || '',
      contactEmail: supplier.contactEmail || '',
      gstNumber: supplier.gstNumber || '',
      materialsSupplied: supplier.materialsSupplied || '',
      paymentTerms: supplier.paymentTerms || '',
      leadTimeDays: String(supplier.leadTimeDays ?? 7),
    } : emptyForm);
  }, [open, supplier]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        contactEmail: form.contactEmail.trim(),
        gstNumber: form.gstNumber.trim(),
        materialsSupplied: form.materialsSupplied.trim(),
        paymentTerms: form.paymentTerms.trim(),
        leadTimeDays: Number(form.leadTimeDays) || 0,
      };
      return supplier
        ? purchaseApi.updateSupplier(supplier._id, body)
        : purchaseApi.createSupplier({ ...body, supplierCode: form.supplierCode.trim() });
    },
    meta: { successMessage: editing ? 'Vendor updated' : 'Vendor added' },
    onSuccess: (s) => {
      invalidate();
      onSaved?.(s);
      onClose();
    },
  });

  const set = (k: keyof typeof emptyForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!editing && form.supplierCode.trim().length < 2) next.supplierCode = 'Enter a vendor ID of at least 2 characters, e.g. V0038.';
    if (form.name.trim().length < 2) next.name = 'Enter the vendor name.';
    if (form.contactEmail.trim() && !/^\S+@\S+\.\S+$/.test(form.contactEmail.trim())) next.contactEmail = 'Enter a valid email address.';
    const lead = Number(form.leadTimeDays);
    if (form.leadTimeDays !== '' && (!Number.isInteger(lead) || lead < 0)) next.leadTimeDays = 'Enter whole days (0 or more).';
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={false}
      title={editing ? `Edit ${supplier?.name}` : 'New vendor'}
      description="Vendors are picked when you create a payment. They don't get a login."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="vendor-form" loading={save.isPending} disabled={!form.name.trim() || (!editing && !form.supplierCode.trim())}>
            {editing ? 'Save changes' : 'Add vendor'}
          </Button>
        </>
      )}
    >
      <form id="vendor-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <Field label="Vendor ID" required={!editing} error={errors.supplierCode} hint={editing ? 'Cannot be changed' : undefined}>
            <ErpInput className="font-mono" value={form.supplierCode} disabled={editing} placeholder="V0038" onChange={(e) => set('supplierCode', e.target.value)} autoFocus={!editing} />
          </Field>
          <Field label="Name" required error={errors.name}>
            <ErpInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sharma Textiles" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact person">
            <ErpInput value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
          </Field>
          <Field label="Mobile">
            <ErpInput type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Email" error={errors.contactEmail}>
            <ErpInput type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </Field>
          <Field label="GST number">
            <ErpInput className="font-mono uppercase" value={form.gstNumber} onChange={(e) => set('gstNumber', e.target.value)} />
          </Field>
        </div>
        <Field label="Materials supplied" hint="Helps you find the right vendor when creating a payment.">
          <ErpInput value={form.materialsSupplied} onChange={(e) => set('materialsSupplied', e.target.value)} placeholder="e.g. Cotton fabric, thread" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment terms">
            <ErpInput value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} placeholder="On delivery / Net 7 / Advance" list="vendor-terms" />
          </Field>
          <Field label="Lead time" error={errors.leadTimeDays}>
            <div className="relative">
              <ErpInput type="number" min={0} className="erp-num pr-14" value={form.leadTimeDays} onChange={(e) => set('leadTimeDays', e.target.value)} aria-label="Lead time in days" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-erp-text-muted">days</span>
            </div>
          </Field>
        </div>
        <datalist id="vendor-terms">
          <option value="On delivery" />
          <option value="Advance" />
          <option value="Net 7" />
          <option value="Net 15" />
          <option value="Net 30" />
        </datalist>
      </form>
    </Drawer>
  );
}

/* ───────────────────────────── Detail drawer ───────────────────────────── */

function SupplierDetailDrawer({
  supplier, onClose, onEdit, onToggleStatus, canEdit,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onEdit: (s: Supplier) => void;
  onToggleStatus: (s: Supplier) => void;
  canEdit: boolean;
}) {
  if (!supplier) return <Drawer open={false} onClose={onClose} title="" />;
  const active = (supplier.status || 'ACTIVE') === 'ACTIVE';
  return (
    <Drawer
      open
      onClose={onClose}
      size="md"
      title={supplier.name}
      description={`Vendor ${supplier.supplierCode}`}
      headerExtra={<StatusBadge status={supplier.status || 'ACTIVE'} />}
      footer={canEdit ? (
        <>
          <Button variant={active ? 'danger' : 'secondary'} className="mr-auto" onClick={() => onToggleStatus(supplier)}>
            {active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button icon={<Pencil size={16} />} onClick={() => onEdit(supplier)}>Edit</Button>
        </>
      ) : undefined}
    >
      <DescriptionList
        columns={2}
        items={[
          { label: 'Contact person', value: supplier.contactPerson },
          { label: 'Mobile', value: supplier.phone ? <a className="text-[var(--erp-accent)] hover:underline" href={`tel:${supplier.phone}`}>{supplier.phone}</a> : undefined },
          { label: 'Email', value: supplier.contactEmail ? <a className="text-[var(--erp-accent)] hover:underline" href={`mailto:${supplier.contactEmail}`}>{supplier.contactEmail}</a> : undefined, full: true },
          { label: 'GST number', value: supplier.gstNumber ? <span className="font-mono">{supplier.gstNumber}</span> : undefined },
          { label: 'Lead time', value: supplier.leadTimeDays != null ? `${supplier.leadTimeDays} days` : undefined },
          { label: 'Payment terms', value: supplier.paymentTerms },
          { label: 'Materials supplied', value: supplier.materialsSupplied, full: true },
        ]}
      />
      {!active && (
        <p className="mt-4 text-[13px] text-erp-text-muted">Inactive vendors can't be chosen on new payments.</p>
      )}
    </Drawer>
  );
}

/* ───────────────────────────── List panel ───────────────────────────── */

/**
 * Vendor list (filter bar, table, pager, detail + edit drawers).
 * Used on the Vendors page and the Purchase → Suppliers tab.
 */
export function SuppliersPanel({
  onNew, status: statusProp, onStatus, highlightId, focusSearch,
}: {
  onNew?: () => void;
  status?: string;
  onStatus?: (s: string) => void;
  highlightId?: string | null;
  /** Put this text in the search box (e.g. the code of a vendor just created, so it is on screen). */
  focusSearch?: string | null;
}) {
  const perms = useSupplierPerms();
  const invalidate = useInvalidatePurchase();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim());
  const [statusLocal, setStatusLocal] = useState('');
  const status = statusProp ?? statusLocal;
  const setStatus = onStatus ?? setStatusLocal;
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);

  useEffect(() => { setPage(1); }, [search, status]);
  // The list is sorted by name across several pages, so a new vendor would land off-screen.
  useEffect(() => { if (focusSearch) setQ(focusSearch); }, [focusSearch]);

  const list = useQuery({
    queryKey: ['vendors-list', page, search, status],
    queryFn: () => listSuppliersPage({ page, limit: PAGE_SIZE, search: search || undefined, status: status || undefined }),
  });
  const rows = (list.data?.items ?? []) as Supplier[];
  const meta = list.data?.meta;
  const selected = rows.find((r) => r._id === selectedId) ?? null;
  const filtered = !!search || !!status;
  const clear = () => { setQ(''); setStatus(''); };

  const setStatusMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'ACTIVE' | 'INACTIVE' }) => purchaseApi.updateSupplier(id, { status: next }),
    onSuccess: () => invalidate(),
    meta: { successMessage: 'Vendor status updated' },
  });

  const toggleStatus = async (s: Supplier) => {
    const active = (s.status || 'ACTIVE') === 'ACTIVE';
    if (active) {
      const ok = await confirm({
        title: `Deactivate ${s.name}?`,
        message: 'They will no longer appear when creating payments. Existing payments are not affected.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setStatusMut.mutate({ id: s._id, next: active ? 'INACTIVE' : 'ACTIVE' });
  };

  const exportCsv = () => {
    downloadCsv(
      'vendors.csv',
      ['Vendor ID', 'Name', 'Contact Person', 'Mobile', 'Email', 'GST No.', 'Material Supplied', 'Payment Terms', 'Lead days', 'Status'],
      rows.map((s) => [
        s.supplierCode, s.name, s.contactPerson || '', s.phone || '', s.contactEmail || '', s.gstNumber || '',
        s.materialsSupplied || '', s.paymentTerms || '', String(s.leadTimeDays ?? ''), s.status || 'ACTIVE',
      ]),
    );
  };

  return (
    <>
      <FilterBar
        search={<SearchInput value={q} onChange={setQ} placeholder="Search ID, name, GST or material…" inputSize="sm" />}
        filters={(
          <ErpSelect inputSize="sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </ErpSelect>
        )}
        onClear={filtered ? clear : undefined}
        actions={perms.canExport ? (
          <Button size="sm" variant="secondary" icon={<Download size={16} />} disabled={!rows.length} onClick={exportCsv}>Export</Button>
        ) : undefined}
      />
      <QueryState
        skeleton="table"
        skeletonColumns={7}
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        isEmpty={!rows.length}
        emptyIcon={Users}
        emptyMessage={filtered ? 'No vendors match these filters' : 'No vendors yet'}
        emptyDescription={filtered ? 'Try a different search or status.' : 'Add the suppliers you buy fabric, trims and packaging from.'}
        emptyAction={filtered
          ? <Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button>
          : perms.canCreate && onNew ? <Button size="sm" icon={<Plus size={16} />} onClick={onNew}>New vendor</Button> : undefined}
      >
        <div className="erp-table-wrap">
          <ErpDataTable className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Contact</th>
                <th>GST</th>
                <th>Materials</th>
                <th>Payment terms</th>
                <th className="erp-num">Lead time</th>
                <th>Status</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const active = (s.status || 'ACTIVE') === 'ACTIVE';
                const sel = selectedId === s._id || highlightId === s._id;
                return (
                  <tr key={s._id} className={`erp-row-clickable${sel ? ' erp-row-selected' : ''}`} onClick={() => setSelectedId(s._id)}>
                    <td>
                      <p className="erp-cell-primary">{s.name}</p>
                      <p className="font-mono text-xs text-erp-text-muted">{s.supplierCode}</p>
                    </td>
                    <td>
                      <p>{s.contactPerson || '—'}</p>
                      <p className="text-xs text-erp-text-muted">{[s.phone, s.contactEmail].filter(Boolean).join(' · ') || ''}</p>
                    </td>
                    <td className="whitespace-nowrap font-mono text-[13px]">{s.gstNumber || '—'}</td>
                    <td className="max-w-[200px] truncate" title={s.materialsSupplied}>{s.materialsSupplied || '—'}</td>
                    <td className="whitespace-nowrap">{s.paymentTerms || '—'}</td>
                    <td className="erp-num">{s.leadTimeDays != null ? `${s.leadTimeDays} d` : '—'}</td>
                    <td><StatusBadge status={s.status || 'ACTIVE'} /></td>
                    <td className="erp-cell-actions">
                      <RowActionsMenu items={[
                        { label: 'Edit', icon: Pencil, hidden: !perms.canEdit, onSelect: () => setEditing(s) },
                        { label: active ? 'Deactivate' : 'Activate', icon: active ? Ban : CheckCircle2, danger: active, hidden: !perms.canEdit, onSelect: () => toggleStatus(s) },
                      ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
        </div>
        {meta && (
          <TablePager
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={PAGE_SIZE}
            itemLabel="vendors"
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </QueryState>

      <SupplierDetailDrawer
        supplier={editing ? null : selected}
        canEdit={perms.canEdit}
        onClose={() => setSelectedId(null)}
        onEdit={(s) => setEditing(s)}
        onToggleStatus={toggleStatus}
      />
      <SupplierFormDrawer open={!!editing} supplier={editing} onClose={() => setEditing(null)} />
    </>
  );
}

/* ───────────────────────────── Page ───────────────────────────── */

export function VendorsPage() {
  const perms = useSupplierPerms();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [focusSearch, setFocusSearch] = useState<string | null>(null);

  const count = (s?: string) => ({
    queryKey: ['vendors-count', s ?? 'all'],
    queryFn: () => listSuppliersPage({ page: 1, limit: 1, status: s }).then((r) => r.meta?.total ?? r.items.length),
  });
  const { data: total } = useQuery(count());
  const { data: active } = useQuery(count('ACTIVE'));
  const { data: inactive } = useQuery(count('INACTIVE'));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendors"
        description="Suppliers you buy materials from. Pick them when you create a payment."
        primaryAction={perms.canCreate ? (
          <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>New vendor</Button>
        ) : undefined}
      />

      <KpiGrid cols={3}>
        <StatTile icon={Users} label="All vendors" value={total ?? '—'} onClick={() => setStatus('')} active={status === ''} />
        <StatTile icon={UserCheck} label="Active" value={active ?? '—'} hint="Available on payments" onClick={() => setStatus('ACTIVE')} active={status === 'ACTIVE'} />
        <StatTile icon={UserX} label="Inactive" value={inactive ?? '—'} onClick={() => setStatus('INACTIVE')} active={status === 'INACTIVE'} />
      </KpiGrid>

      <Section flush>
        <SuppliersPanel onNew={() => setCreating(true)} status={status} onStatus={setStatus} highlightId={highlightId} focusSearch={focusSearch} />
      </Section>

      <SupplierFormDrawer
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(s) => {
          setStatus('');
          setFocusSearch(s.supplierCode || s.name || null);
          setHighlightId(s._id);
          window.setTimeout(() => setHighlightId(null), 4000);
        }}
      />
    </div>
  );
}
