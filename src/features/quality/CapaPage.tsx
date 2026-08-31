import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { capaApi } from '../../services/admin';
import { qualityApi } from '../../services/operations';
import type { CapaRecord } from '../../types/api';
import {
  ErpPageHeader, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { useAuth } from '../../app/providers/AuthProvider';
import { formatDateTime, isOverdue, statusLabel } from './qualityUtils';

const PAGE_SIZE = 15;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const btnSm = '!px-2 !py-1 text-[10px]';

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
    <div>
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="CAPA"
        subtitle="Corrective and preventive actions for quality issues"
        actions={(
          <div className="flex gap-2">
            <ErpButton variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </ErpButton>
            {canCreate && (
              <ErpButton onClick={() => setShowForm((v) => !v)}>
                <Plus className="mr-1 inline h-3.5 w-3.5" />
                New CAPA
              </ErpButton>
            )}
          </div>
        )}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Open CAPA</span>
          <p className="mt-1 text-lg font-semibold">{stats?.openCapa ?? '—'}</p>
        </ErpCard>
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Failed inspections</span>
          <p className="mt-1 text-lg font-semibold">{stats?.failed ?? '—'}</p>
        </ErpCard>
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Rework items</span>
          <p className="mt-1 text-lg font-semibold">{stats?.rework ?? '—'}</p>
        </ErpCard>
      </div>

      {showForm && canCreate && (
        <ErpCard className="mb-6 p-4">
          <h3 className="mb-3 text-sm font-medium">Create CAPA</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={fieldLabel}>Type</span>
              <ErpSelect value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {(catalog?.capaTypes ?? ['CORRECTIVE', 'PREVENTIVE']).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </ErpSelect>
            </label>
            <label>
              <span className={fieldLabel}>Due date</span>
              <ErpInput type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </label>
            <label className="sm:col-span-2">
              <span className={fieldLabel}>Description</span>
              <ErpInput
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the quality issue and required action"
              />
            </label>
            <label>
              <span className={fieldLabel}>Root cause</span>
              <ErpInput value={form.rootCause} onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))} />
            </label>
            <label>
              <span className={fieldLabel}>Action plan</span>
              <ErpInput value={form.actionPlan} onChange={(e) => setForm((f) => ({ ...f, actionPlan: e.target.value }))} />
            </label>
            <label className="sm:col-span-2">
              <span className={fieldLabel}>Linked inspection (optional)</span>
              <ErpSelect
                value={form.inspectionId}
                onChange={(e) => setForm((f) => ({ ...f, inspectionId: e.target.value }))}
              >
                <option value="">None</option>
                {failedInspections.map((i) => (
                  <option key={i._id} value={i._id}>
                    {i.inspectionNumber} — {i.inspectionType} ({i.result})
                  </option>
                ))}
              </ErpSelect>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <ErpButton
              disabled={!form.description.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              Save CAPA
            </ErpButton>
            <ErpButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</ErpButton>
          </div>
        </ErpCard>
      )}

      <ErpCard className="p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label>
            <span className={fieldLabel}>Status filter</span>
            <ErpSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="CLOSED">Closed</option>
            </ErpSelect>
          </label>
        </div>

        <ErpDataTable>
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
              <tr><td colSpan={6} className="py-8 text-center text-erp-text-muted">Loading…</td></tr>
            ) : records.map((r) => (
              <tr key={r._id}>
                <td className="font-mono text-xs">{r.capaNumber}</td>
                <td>{r.type}</td>
                <td className="max-w-[240px] truncate" title={r.description}>{r.description}</td>
                <td className={`text-xs ${isOverdue(r.dueDate) && r.status !== 'CLOSED' ? 'text-red-500' : 'text-erp-text-muted'}`}>
                  {r.dueDate ? formatDateTime(r.dueDate).split(',')[0] : '—'}
                  {isOverdue(r.dueDate) && r.status !== 'CLOSED' && (
                    <AlertTriangle className="ml-1 inline h-3 w-3" />
                  )}
                </td>
                <td><ErpStatusBadge status={r.status} label={statusLabel(r.status)} /></td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    {canUpdate && r.status !== 'CLOSED' && (
                      <ErpButton variant="secondary" className={btnSm} onClick={() => openEdit(r)}>
                        Edit
                      </ErpButton>
                    )}
                    {canApprove && r.status !== 'CLOSED' && (
                      <ErpButton
                        variant="secondary"
                        className={btnSm}
                        onClick={() => setConfirmCloseId(r._id)}
                      >
                        Close
                      </ErpButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && records.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-erp-text-muted">No CAPA records</td></tr>
            )}
          </tbody>
        </ErpDataTable>

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-erp-text-muted">
            <span>Page {meta.page} of {meta.totalPages}</span>
            <div className="flex gap-2">
              <ErpButton variant="secondary" className={btnSm} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </ErpButton>
              <ErpButton variant="secondary" className={btnSm} disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </ErpButton>
            </div>
          </div>
        )}
      </ErpCard>

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <ErpCard className="w-full max-w-md p-5">
            <h3 className="mb-4 text-base font-semibold">Update CAPA</h3>
            <div className="space-y-3">
              <label>
                <span className={fieldLabel}>Status</span>
                <ErpSelect value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                </ErpSelect>
              </label>
              <label>
                <span className={fieldLabel}>Root cause</span>
                <ErpInput value={editForm.rootCause} onChange={(e) => setEditForm((f) => ({ ...f, rootCause: e.target.value }))} />
              </label>
              <label>
                <span className={fieldLabel}>Action plan</span>
                <ErpInput value={editForm.actionPlan} onChange={(e) => setEditForm((f) => ({ ...f, actionPlan: e.target.value }))} />
              </label>
              <label>
                <span className={fieldLabel}>Due date</span>
                <ErpInput type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setEditId(null)}>Cancel</ErpButton>
              <ErpButton disabled={update.isPending} onClick={() => update.mutate()}>Save</ErpButton>
            </div>
          </ErpCard>
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
