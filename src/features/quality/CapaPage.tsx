import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { capaApi } from '../../services/admin';
import { qualityApi } from '../../services/operations';
import type { CapaRecord } from '../../types/api';
import {
  ActionStack, ComposeSection, EmptyRow, ErpButton, ErpDataTable, ErpInput, ErpPageHeader,
  ErpSelect, ErpStatusBadge, StatTile, TabShell, TabToolbar, TablePager, btnSm, fieldLabel,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { useAuth } from '../../app/providers/AuthProvider';
import { formatDateTime, isOverdue, statusLabel } from './qualityUtils';

const PAGE_SIZE = 15;

export function CapaPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('quality.create');
  const canUpdate = permissions.includes('*') || permissions.includes('quality.update');
  const canApprove = permissions.includes('*') || permissions.includes('quality.approve');

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: 'CORRECTIVE',
    description: '',
    rootCause: '',
    actionPlan: '',
    dueDate: '',
    inspectionId: '',
  });

  const [editForm, setEditForm] = useState({
    rootCause: '',
    actionPlan: '',
    dueDate: '',
    status: 'OPEN',
  });

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['capa'] });
    qc.invalidateQueries({ queryKey: ['quality-stats'] });
  };

  const { data: stats } = useQuery({ queryKey: ['quality-stats'], queryFn: () => qualityApi.stats() });
  const { data: catalog } = useQuery({ queryKey: ['quality-catalog'], queryFn: () => qualityApi.catalog() });
  const { data: failedInspections = [] } = useQuery({
    queryKey: ['capa-inspection-options'],
    queryFn: () => qualityApi.list({ status: 'COMPLETED', limit: 100 }).then((items) =>
      items.filter((i) => i.result === 'FAIL' || i.result === 'REWORK' || i.result === 'PARTIAL')),
  });

  const { data: capaPage, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['capa', page, statusFilter],
    queryFn: () => capaApi.listPage({ page, limit: PAGE_SIZE, status: statusFilter || undefined }),
  });
  const records = capaPage?.items ?? [];
  const meta = capaPage?.meta;

  const create = useMutation({
    mutationFn: () => capaApi.create({
      type: form.type,
      description: form.description.trim(),
      rootCause: form.rootCause || undefined,
      actionPlan: form.actionPlan || undefined,
      dueDate: form.dueDate || undefined,
      inspectionId: form.inspectionId || undefined,
    }),
    onSuccess: (r) => {
      setForm({ type: 'CORRECTIVE', description: '', rootCause: '', actionPlan: '', dueDate: '', inspectionId: '' });
      setShowForm(false);
      showSuccess(`CAPA ${r.capaNumber} created`);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const update = useMutation({
    mutationFn: () => capaApi.update(editId!, {
      rootCause: editForm.rootCause || undefined,
      actionPlan: editForm.actionPlan || undefined,
      dueDate: editForm.dueDate || null,
      status: editForm.status,
    }),
    onSuccess: () => {
      setEditId(null);
      showSuccess('CAPA updated');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const close = useMutation({
    mutationFn: (id: string) => capaApi.close(id),
    onSuccess: () => {
      setConfirmCloseId(null);
      showSuccess('CAPA closed');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const openEdit = (r: CapaRecord) => {
    setEditId(r._id);
    setEditForm({
      rootCause: r.rootCause || '',
      actionPlan: r.actionPlan || '',
      dueDate: r.dueDate ? r.dueDate.slice(0, 10) : '',
      status: r.status ?? 'OPEN',
    });
  };

  return (
    <div className="space-y-3">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="CAPA"
        subtitle={(
          <>
            Corrective and preventive actions for quality issues.
            <Link to="/quality/inspections" className="ml-2 text-[var(--erp-accent)]">Inspections -&gt;</Link>
          </>
        )}
        actions={(
          <div className="flex gap-2">
            <ErpButton variant="secondary" className={btnSm} onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </ErpButton>
            {canCreate && (
              <ErpButton className={btnSm} onClick={() => setShowForm((v) => !v)}>
                {showForm ? <X className="mr-1 inline h-3.5 w-3.5" /> : <Plus className="mr-1 inline h-3.5 w-3.5" />}
                {showForm ? 'Cancel' : 'New CAPA'}
              </ErpButton>
            )}
          </div>
        )}
      />

      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--erp-border)] bg-[var(--erp-border)] sm:grid-cols-3">
        <StatTile icon={ShieldCheck} label="Open CAPA" value={stats?.openCapa ?? '-'} highlight={(stats?.openCapa ?? 0) > 0 ? 'warn' : undefined} />
        <StatTile icon={AlertTriangle} label="Failed inspections" value={stats?.failed ?? '-'} />
        <StatTile icon={AlertTriangle} label="Rework items" value={stats?.rework ?? '-'} />
      </div>

      <TabShell>
        {showForm && canCreate && (
          <ComposeSection title="Create CAPA" hint="Link an optional failed inspection, then track root cause and due date.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={fieldLabel}>Type</label>
                <ErpSelect className="!py-1.5 text-[12px]" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  {(catalog?.capaTypes ?? ['CORRECTIVE', 'PREVENTIVE']).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </ErpSelect>
              </div>
              <div>
                <label className={fieldLabel}>Due date</label>
                <ErpInput className="!py-1.5 text-[12px]" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Description</label>
                <ErpInput
                  className="!py-1.5 text-[12px]"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the quality issue and required action"
                />
              </div>
              <div>
                <label className={fieldLabel}>Root cause</label>
                <ErpInput className="!py-1.5 text-[12px]" value={form.rootCause} onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))} />
              </div>
              <div>
                <label className={fieldLabel}>Action plan</label>
                <ErpInput className="!py-1.5 text-[12px]" value={form.actionPlan} onChange={(e) => setForm((f) => ({ ...f, actionPlan: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Linked inspection (optional)</label>
                <ErpSelect
                  className="!py-1.5 text-[12px]"
                  value={form.inspectionId}
                  onChange={(e) => setForm((f) => ({ ...f, inspectionId: e.target.value }))}
                >
                  <option value="">None</option>
                  {failedInspections.map((i) => (
                    <option key={i._id} value={i._id}>
                      {i.inspectionNumber} - {i.inspectionType} ({i.result})
                    </option>
                  ))}
                </ErpSelect>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <ErpButton className={btnSm} disabled={!form.description.trim() || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? 'Saving...' : 'Save CAPA'}
              </ErpButton>
              <ErpButton variant="secondary" className={btnSm} onClick={() => setShowForm(false)}>Cancel</ErpButton>
            </div>
          </ComposeSection>
        )}

        <TabToolbar title="CAPA records" hint="Open, in-progress, and closed actions.">
          <div className="w-40">
            <label className={fieldLabel}>Status</label>
            <ErpSelect className="!py-1.5 text-[12px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="CLOSED">Closed</option>
            </ErpSelect>
          </div>
        </TabToolbar>

        <div className="overflow-x-auto">
          <ErpDataTable className="w-full min-w-[720px] text-[12px]">
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Description</th>
                <th>Due</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <EmptyRow colSpan={6}>Loading...</EmptyRow>
              ) : records.map((r) => (
                <tr key={r._id}>
                  <td className="whitespace-nowrap font-mono font-medium">{r.capaNumber}</td>
                  <td>{r.type}</td>
                  <td className="max-w-[280px] truncate" title={r.description}>{r.description}</td>
                  <td className={`whitespace-nowrap ${isOverdue(r.dueDate) && r.status !== 'CLOSED' ? 'text-red-600' : 'text-erp-text-muted'}`}>
                    {r.dueDate ? formatDateTime(r.dueDate).split(',')[0] : '-'}
                    {isOverdue(r.dueDate) && r.status !== 'CLOSED' && (
                      <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />
                    )}
                  </td>
                  <td><ErpStatusBadge status={r.status} label={statusLabel(r.status)} /></td>
                  <td className="text-right">
                    <ActionStack>
                      {canUpdate && r.status !== 'CLOSED' && (
                        <ErpButton variant="secondary" className={btnSm} onClick={() => openEdit(r)}>Edit</ErpButton>
                      )}
                      {canApprove && r.status !== 'CLOSED' && (
                        <ErpButton variant="secondary" className={btnSm} onClick={() => setConfirmCloseId(r._id)}>Close</ErpButton>
                      )}
                    </ActionStack>
                  </td>
                </tr>
              ))}
              {!isLoading && records.length === 0 && (
                <EmptyRow colSpan={6}>No CAPA records</EmptyRow>
              )}
            </tbody>
          </ErpDataTable>
        </div>

        {meta && (
          <TablePager
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </TabShell>

      {editId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/45 p-4" onClick={() => setEditId(null)} role="presentation">
          <div
            className="my-auto w-full max-w-md rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface,var(--erp-header-bg,#fff))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between border-b border-[var(--erp-border)] px-4 py-3">
              <h3 className="text-sm font-semibold text-erp-text-primary">Update CAPA</h3>
              <button type="button" className="rounded p-1 text-erp-text-muted hover:bg-[var(--erp-surface-muted)]" onClick={() => setEditId(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className={fieldLabel}>Status</label>
                <ErpSelect className="!py-1.5 text-[12px]" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                </ErpSelect>
              </div>
              <div>
                <label className={fieldLabel}>Root cause</label>
                <ErpInput className="!py-1.5 text-[12px]" value={editForm.rootCause} onChange={(e) => setEditForm((f) => ({ ...f, rootCause: e.target.value }))} />
              </div>
              <div>
                <label className={fieldLabel}>Action plan</label>
                <ErpInput className="!py-1.5 text-[12px]" value={editForm.actionPlan} onChange={(e) => setEditForm((f) => ({ ...f, actionPlan: e.target.value }))} />
              </div>
              <div>
                <label className={fieldLabel}>Due date</label>
                <ErpInput className="!py-1.5 text-[12px]" type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--erp-border)] px-4 py-3">
              <ErpButton variant="secondary" className={btnSm} onClick={() => setEditId(null)}>Cancel</ErpButton>
              <ErpButton className={btnSm} disabled={update.isPending} onClick={() => update.mutate()}>
                {update.isPending ? 'Saving...' : 'Save'}
              </ErpButton>
            </div>
          </div>
        </div>
      )}

      {confirmCloseId && (
        <ConfirmDialog
          open={!!confirmCloseId}
          title="Close CAPA"
          message="Mark this CAPA as closed? This requires approval permission."
          loading={close.isPending}
          onConfirm={() => close.mutate(confirmCloseId)}
          onCancel={() => setConfirmCloseId(null)}
        />
      )}
    </div>
  );
}
