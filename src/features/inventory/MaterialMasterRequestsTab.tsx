import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardList, XCircle } from 'lucide-react';
import { inventoryApi } from '../../services/manufacturing';
import type { MaterialMasterRequest } from '../../types/api';
import {
  Button, ErpDataTable, ErpInput, ErpSelect, Field, FilterBar, Modal, RowActionsMenu, StatusBadge, usePrompt,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { UnitInput } from '../purchase/purchaseShared';
import { categoryLabel, unitLabel, formatDateTime } from './inventoryUtils';
import { useInvalidateInventory } from './inventoryLayout';

function personName(v: MaterialMasterRequest['requestedBy']): string {
  if (!v || typeof v === 'string') return '';
  return [v.firstName, v.lastName].filter(Boolean).join(' ') || v.email || '';
}

function designLabel(v: MaterialMasterRequest['designId']): { id: string; text: string } {
  if (!v) return { id: '', text: '—' };
  if (typeof v === 'string') return { id: v, text: v };
  return { id: v._id, text: [v.designCode, v.title].filter(Boolean).join(' — ') || v._id };
}

function materialCodeOf(r: MaterialMasterRequest): string {
  const m = r.materialId;
  if (m && typeof m !== 'string') return m.materialCode;
  return r.proposedCode || '—';
}

function ApproveRequestModal({ request, onClose }: { request: MaterialMasterRequest | null; onClose: () => void }) {
  const invalidate = useInvalidateInventory();
  const [form, setForm] = useState({ materialCode: '', unitCost: '', reviewNotes: '' });
  useEffect(() => {
    if (request) setForm({ materialCode: request.proposedCode || '', unitCost: String(request.unitCost ?? 0), reviewNotes: '' });
  }, [request]);

  const approve = useMutation({
    mutationFn: () => inventoryApi.approveMaterialMasterRequest(request!._id, {
      materialCode: form.materialCode.trim() || undefined,
      unitCost: Number(form.unitCost) || 0,
      reviewNotes: form.reviewNotes.trim() || undefined,
    }),
    meta: { successMessage: 'Fabric added to the material master', successDescription: 'It is attached to the requester\'s tech pack.' },
    onSuccess: () => { invalidate(); onClose(); },
  });

  const submit = (e: FormEvent) => { e.preventDefault(); approve.mutate(); };

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      size="md"
      title={`Approve ${request?.name ?? 'request'}`}
      description="Creates the material in the store master and attaches it to the pattern's tech pack."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="approve-mmr-form" icon={<CheckCircle2 size={16} />} loading={approve.isPending}>Create material</Button>
        </>
      )}
    >
      {request && (
        <form id="approve-mmr-form" onSubmit={submit} noValidate className="space-y-4">
          <p className="text-[13px] text-erp-text-secondary">
            {categoryLabel(request.category || 'FABRIC')} · {unitLabel(request.unit)}{request.notes ? ` · ${request.notes}` : ''}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Material code" hint="Leave blank to generate one.">
              <ErpInput className="font-mono" value={form.materialCode} onChange={(e) => setForm((f) => ({ ...f, materialCode: e.target.value }))} placeholder="Auto" />
            </Field>
            <Field label="Unit cost">
              <UnitInput min={0} step="0.01" unit="₹" value={form.unitCost} onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))} />
            </Field>
          </div>
          <Field label="Note to requester">
            <ErpInput value={form.reviewNotes} onChange={(e) => setForm((f) => ({ ...f, reviewNotes: e.target.value }))} placeholder="Optional" />
          </Field>
        </form>
      )}
    </Modal>
  );
}

/** Pattern masters ask the store to add fabrics they can't create themselves. */
export function MaterialMasterRequestsTab({ canApprove }: { canApprove: boolean }) {
  const invalidate = useInvalidateInventory();
  const prompt = usePrompt();
  const [status, setStatus] = useState('PENDING');
  const [approving, setApproving] = useState<MaterialMasterRequest | null>(null);

  const list = useQuery({
    queryKey: ['material-master-requests', status],
    queryFn: () => inventoryApi.listMaterialMasterRequests({ status: status || undefined, limit: 100 }).then((r) => r.items),
    refetchInterval: status === 'PENDING' ? 20000 : false,
  });
  const rows = list.data ?? [];

  const reject = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => inventoryApi.rejectMaterialMasterRequest(id, { reviewNotes: notes || undefined }),
    meta: { successMessage: 'Request declined' },
    onSuccess: () => invalidate(),
  });

  const decline = async (r: MaterialMasterRequest) => {
    const notes = await prompt({
      title: `Decline ${r.name}?`,
      message: 'The pattern master sees your reason.',
      label: 'Reason',
      placeholder: 'e.g. Use FAB-COT-002 instead',
      required: false,
      tone: 'danger',
      confirmLabel: 'Decline',
    });
    if (notes != null) reject.mutate({ id: r._id, notes: notes.trim() });
  };

  return (
    <>
      <FilterBar
        filters={(
          <ErpSelect inputSize="sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="PENDING">Waiting for review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Declined</option>
            <option value="">All requests</option>
          </ErpSelect>
        )}
      />
      <QueryState
        skeleton="table"
        skeletonColumns={7}
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        isEmpty={!rows.length}
        emptyIcon={ClipboardList}
        emptyMessage={status === 'PENDING' ? 'No fabric requests waiting' : 'No requests here'}
        emptyDescription="Pattern masters request new fabrics from their tech pack. They appear here for the store to approve."
      >
        <div className="erp-table-wrap">
          <ErpDataTable className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th>Request</th>
                <th>Fabric</th>
                <th>Category / unit</th>
                <th>Design</th>
                <th>Requested</th>
                <th>Status</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const design = designLabel(r.designId);
                return (
                  <tr key={r._id}>
                    <td className="whitespace-nowrap font-mono text-[13px] font-medium">{r.requestNumber}</td>
                    <td className="max-w-[260px]">
                      <p className="font-medium text-erp-text-primary">{r.name}</p>
                      {r.notes && <p className="line-clamp-2 text-xs text-erp-text-muted">{r.notes}</p>}
                      {r.status === 'APPROVED' && <p className="text-xs text-erp-text-muted">Store code: <span className="font-mono">{materialCodeOf(r)}</span></p>}
                      {r.status === 'REJECTED' && r.reviewNotes && <p className="text-xs text-[var(--erp-danger-text)]">{r.reviewNotes}</p>}
                    </td>
                    <td className="whitespace-nowrap text-erp-text-secondary">
                      {categoryLabel(r.category || 'FABRIC')} · {unitLabel(r.unit)}
                      {r.proposedCode && <p className="font-mono text-xs text-erp-text-muted">{r.proposedCode}</p>}
                    </td>
                    <td>
                      {design.id
                        ? <Link to={`/pattern?designId=${design.id}`} className="text-[var(--erp-accent)] hover:underline">{design.text}</Link>
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap">
                      <p>{personName(r.requestedBy) || '—'}</p>
                      <p className="text-xs text-erp-text-muted">{formatDateTime(r.createdAt)}</p>
                    </td>
                    <td><StatusBadge status={r.status} label={r.status === 'REJECTED' ? 'Declined' : undefined} /></td>
                    <td className="erp-cell-actions">
                      {canApprove && r.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="secondary" icon={<CheckCircle2 size={14} />} onClick={() => setApproving(r)}>Approve</Button>
                          <RowActionsMenu items={[{ label: 'Decline', icon: XCircle, danger: true, onSelect: () => decline(r) }]} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
        </div>
      </QueryState>
      <ApproveRequestModal request={approving} onClose={() => setApproving(null)} />
    </>
  );
}
