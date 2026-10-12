import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Pencil, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { capaApi } from '../../services/admin';
import { qualityApi } from '../../services/operations';
import type { CapaRecord } from '../../types/api';
import {
  Badge, Button, DescriptionList, Drawer, EmptyRow, ErpDataTable, ErpInput, ErpSelect, Field, FilterBar, IconButton, KpiGrid,
  PageHeader, RowActionsMenu, Section, StatTile, StatusBadge, TablePager, TableSkeleton, Textarea, humanizeStatus, toast, useConfirm,
} from '../../components/erp';
import { useAuth } from '../../app/providers/AuthProvider';
import { isOverdue } from './qualityUtils';
import { QueryErrorRow } from '../production/QueryErrorRow';

const PAGE_SIZE = 15;
type Errors = Record<string, string>;

function formatDay(d?: string) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

function useInvalidateCapa() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ['capa'] }); qc.invalidateQueries({ queryKey: ['quality-stats'] }); };
}

/* ─────────────────────────── New CAPA ─────────────────────────── */

function CapaFormDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateCapa();
  const empty = { type: 'CORRECTIVE', description: '', rootCause: '', actionPlan: '', dueDate: '', inspectionId: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => { if (open) { setForm(empty); setErrors({}); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: catalog } = useQuery({ queryKey: ['quality-catalog'], queryFn: () => qualityApi.catalog(), enabled: open });
  const { data: failedInspections = [] } = useQuery({
    queryKey: ['capa-inspection-options'],
    queryFn: () => qualityApi.list({ status: 'COMPLETED', limit: 100 }).then((items) =>
      items.filter((i) => i.result === 'FAIL' || i.result === 'REWORK' || i.result === 'PARTIAL')),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => capaApi.create({
      type: form.type,
      description: form.description.trim(),
      rootCause: form.rootCause || undefined,
      actionPlan: form.actionPlan || undefined,
      dueDate: form.dueDate || undefined,
      inspectionId: form.inspectionId || undefined,
    }),
    onSuccess: (r) => {
      toast.success(`CAPA ${r.capaNumber ?? ''} created`);
      invalidate();
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (form.description.trim().length < 5) next.description = 'Describe the issue and the action needed (at least 5 characters).';
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={false}
      title="New CAPA"
      description="Record a corrective or preventive action and who needs to close it by when."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="capa-form" loading={save.isPending}>Create CAPA</Button>
        </>
      )}
    >
      <form id="capa-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <ErpSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {(catalog?.capaTypes ?? ['CORRECTIVE', 'PREVENTIVE']).map((t) => <option key={t} value={t}>{humanizeStatus(t)}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Due date">
            <ErpInput type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Issue" required error={errors.description}>
          <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What went wrong and what needs to change?" />
        </Field>
        <Field label="Root cause">
          <Textarea rows={2} value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} />
        </Field>
        <Field label="Action plan">
          <Textarea rows={2} value={form.actionPlan} onChange={(e) => setForm({ ...form, actionPlan: e.target.value })} />
        </Field>
        <Field label="Linked inspection" hint="Failed, partial or rework inspections.">
          <ErpSelect value={form.inspectionId} onChange={(e) => setForm({ ...form, inspectionId: e.target.value })}>
            <option value="">None</option>
            {failedInspections.map((i) => (
              <option key={i._id} value={i._id}>{i.inspectionNumber} · {humanizeStatus(i.inspectionType)} ({humanizeStatus(i.result ?? '')})</option>
            ))}
          </ErpSelect>
        </Field>
      </form>
    </Drawer>
  );
}

/* ─────────────────────────── CAPA detail / update ─────────────────────────── */

function CapaDetailDrawer({ record, onClose, canUpdate, canApprove, onCloseCapa }: {
  record: CapaRecord | null;
  onClose: () => void;
  canUpdate: boolean;
  canApprove: boolean;
  onCloseCapa: (r: CapaRecord) => void;
}) {
  const invalidate = useInvalidateCapa();
  const [form, setForm] = useState({ rootCause: '', actionPlan: '', dueDate: '', status: 'OPEN' });
  useEffect(() => {
    if (!record) return;
    setForm({
      rootCause: record.rootCause || '',
      actionPlan: record.actionPlan || '',
      dueDate: record.dueDate ? record.dueDate.slice(0, 10) : '',
      status: record.status ?? 'OPEN',
    });
  }, [record]);

  const update = useMutation({
    mutationFn: () => capaApi.update(record!._id, {
      rootCause: form.rootCause || undefined,
      actionPlan: form.actionPlan || undefined,
      dueDate: form.dueDate || null,
      status: form.status,
    }),
    meta: { successMessage: 'CAPA updated' },
    onSuccess: () => { invalidate(); onClose(); },
  });

  if (!record) return null;
  const closed = record.status === 'CLOSED';
  const editable = canUpdate && !closed;
  const overdue = !closed && isOverdue(record.dueDate);

  return (
    <Drawer
      open
      onClose={onClose}
      size="md"
      title={record.capaNumber ?? 'CAPA'}
      description={humanizeStatus(record.type ?? '')}
      headerExtra={(
        <div className="mt-2 flex gap-2">
          <StatusBadge status={record.status} />
          {overdue && <Badge tone="danger">Overdue</Badge>}
        </div>
      )}
      footer={(
        <>
          {canApprove && !closed && (
            <Button variant="danger" icon={<CheckCircle2 size={16} />} className="mr-auto" onClick={() => onCloseCapa(record)}>Close CAPA</Button>
          )}
          <Button variant="secondary" onClick={onClose}>{editable ? 'Cancel' : 'Close'}</Button>
          {editable && <Button type="submit" form="capa-edit-form" loading={update.isPending}>Save changes</Button>}
        </>
      )}
    >
      <div className="space-y-5">
        <DescriptionList
          columns={1}
          items={[
            { label: 'Issue', value: record.description || '—' },
            { label: 'Due', value: formatDay(record.dueDate), hidden: editable },
            { label: 'Root cause', value: record.rootCause || '—', hidden: editable },
            { label: 'Action plan', value: record.actionPlan || '—', hidden: editable },
          ]}
        />
        {editable && (
          <form id="capa-edit-form" onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <ErpSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                </ErpSelect>
              </Field>
              <Field label="Due date">
                <ErpInput type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </Field>
            </div>
            <Field label="Root cause">
              <Textarea rows={3} value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} />
            </Field>
            <Field label="Action plan">
              <Textarea rows={3} value={form.actionPlan} onChange={(e) => setForm({ ...form, actionPlan: e.target.value })} />
            </Field>
          </form>
        )}
      </div>
    </Drawer>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export function CapaPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const invalidate = useInvalidateCapa();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('quality.create');
  const canUpdate = permissions.includes('*') || permissions.includes('quality.update');
  const canApprove = permissions.includes('*') || permissions.includes('quality.approve');

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<CapaRecord | null>(null);

  const statsQ = useQuery({ queryKey: ['quality-stats'], queryFn: () => qualityApi.stats() });
  const stats = statsQ.data;
  const listQ = useQuery({
    queryKey: ['capa', page, statusFilter],
    queryFn: () => capaApi.listPage({ page, limit: PAGE_SIZE, status: statusFilter || undefined }),
    placeholderData: (prev) => prev,
  });
  const records = listQ.data?.items ?? [];
  const meta = listQ.data?.meta;

  const close = useMutation({
    mutationFn: (id: string) => capaApi.close(id),
    meta: { successMessage: 'CAPA closed' },
    onSuccess: () => { invalidate(); setSelected(null); },
  });

  const askClose = async (r: CapaRecord) => {
    const ok = await confirm({
      title: `Close ${r.capaNumber ?? 'this CAPA'}?`,
      message: 'Confirm the action plan is done and effective. Closed CAPAs cannot be edited.',
      confirmLabel: 'Close CAPA',
    });
    if (ok) close.mutate(r._id);
  };

  const filterBy = (s: string) => { setStatusFilter(s); setPage(1); };

  return (
    <>
      <PageHeader
        title="CAPA"
        description="Corrective and preventive actions raised from quality issues."
        secondaryActions={(
          <>
            <IconButton aria-label="Refresh" loading={listQ.isFetching} onClick={() => { listQ.refetch(); statsQ.refetch(); }}><RefreshCw size={16} /></IconButton>
            <Button variant="secondary" icon={<ClipboardCheck size={16} />} onClick={() => navigate('/quality/inspections')}>Inspections</Button>
          </>
        )}
        primaryAction={canCreate ? <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>New CAPA</Button> : undefined}
      />

      <KpiGrid cols={3} className="mb-4">
        <StatTile
          icon={ShieldCheck} label="Open CAPA" value={stats?.openCapa ?? '—'}
          highlight={(stats?.openCapa ?? 0) > 0 ? 'warn' : undefined}
          onClick={() => filterBy(statusFilter === 'OPEN' ? '' : 'OPEN')} active={statusFilter === 'OPEN'}
        />
        <StatTile icon={AlertTriangle} label="Failed inspections" value={stats?.failed ?? '—'} onClick={() => navigate('/quality/inspections?tab=history')} />
        <StatTile icon={AlertTriangle} label="Rework" value={stats?.rework ?? '—'} hint="Inspections sent back to the line" />
      </KpiGrid>

      <Section flush>
        <FilterBar
          filters={(
            <ErpSelect inputSize="sm" aria-label="Status" value={statusFilter} onChange={(e) => filterBy(e.target.value)}>
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="CLOSED">Closed</option>
            </ErpSelect>
          )}
          onClear={statusFilter ? () => filterBy('') : undefined}
        />
        <ErpDataTable className="min-w-[760px]">
          <thead>
            <tr><th>CAPA</th><th>Type</th><th>Issue</th><th>Due</th><th>Status</th><th className="erp-cell-actions"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {listQ.isLoading ? <TableSkeleton asRows rows={5} columns={6} /> : listQ.isError ? <QueryErrorRow colSpan={6} error={listQ.error} onRetry={() => listQ.refetch()} /> : records.length === 0 ? (
              <EmptyRow
                colSpan={6}
                title={statusFilter ? 'No CAPAs with this status' : 'No CAPAs yet'}
                icon={ShieldCheck}
                action={statusFilter
                  ? <Button size="sm" variant="secondary" onClick={() => filterBy('')}>Clear filter</Button>
                  : canCreate ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating(true)}>New CAPA</Button> : undefined}
              >
                {statusFilter ? undefined : 'Raise a CAPA when an inspection fails or a defect keeps coming back.'}
              </EmptyRow>
            ) : records.map((r) => {
              const overdue = r.status !== 'CLOSED' && isOverdue(r.dueDate);
              return (
                <tr key={r._id} className={`erp-row-clickable${selected?._id === r._id ? ' erp-row-selected' : ''}`} onClick={() => setSelected(r)}>
                  <td className="erp-cell-primary whitespace-nowrap font-mono">{r.capaNumber}</td>
                  <td>{humanizeStatus(r.type ?? '')}</td>
                  <td className="max-w-[320px] truncate" title={r.description}>{r.description}</td>
                  <td className={`whitespace-nowrap ${overdue ? 'font-medium text-[var(--erp-danger-text)]' : 'text-erp-text-muted'}`}>
                    {formatDay(r.dueDate)}{overdue && <span className="ml-1 text-xs">overdue</span>}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="erp-cell-actions">
                    <div className="flex items-center justify-end gap-1">
                      {canUpdate && r.status !== 'CLOSED' && (
                        <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={(e) => { e.stopPropagation(); setSelected(r); }}>Update</Button>
                      )}
                      <RowActionsMenu
                        label={`Actions for ${r.capaNumber}`}
                        items={[{ label: 'Close CAPA', icon: CheckCircle2, hidden: !(canApprove && r.status !== 'CLOSED'), onSelect: () => askClose(r) }]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ErpDataTable>
        {meta && <TablePager page={page} totalPages={meta.totalPages} total={meta.total} pageSize={PAGE_SIZE} itemLabel="CAPAs" onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />}
      </Section>

      <CapaFormDrawer open={creating} onClose={() => setCreating(false)} />
      <CapaDetailDrawer record={selected} onClose={() => setSelected(null)} canUpdate={canUpdate} canApprove={canApprove} onCloseCapa={askClose} />
    </>
  );
}
