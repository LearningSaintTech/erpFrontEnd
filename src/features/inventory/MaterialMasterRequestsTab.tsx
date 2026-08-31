import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../../services/manufacturing';
import type { MaterialMasterRequest } from '../../types/api';
import { ErpButton, ErpCard, ErpInput, ErpSelect, ErpStatusBadge } from '../../components/erp';
import { unitLabel, formatDateTime } from './inventoryUtils';

const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';

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

export function MaterialMasterRequestsTab({ canApprove }: { canApprove: boolean }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [error, setError] = useState('');
  const [review, setReview] = useState<{ id: string; mode: 'approve' | 'reject' } | null>(null);
  const [approveForm, setApproveForm] = useState({ materialCode: '', unitCost: '0', reviewNotes: '' });
  const [rejectNotes, setRejectNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['material-master-requests', status],
    queryFn: () => inventoryApi.listMaterialMasterRequests({
      status: status || undefined,
      limit: 100,
    }).then((r) => r.items),
    refetchInterval: status === 'PENDING' ? 20000 : false,
  });
  const items = data ?? [];

  const selected = useMemo(
    () => items.find((r) => r._id === review?.id) || null,
    [items, review],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['material-master-requests'] });
    qc.invalidateQueries({ queryKey: ['inventory-stats'] });
    qc.invalidateQueries({ queryKey: ['materials-page'] });
    qc.invalidateQueries({ queryKey: ['pattern-material-options'] });
    qc.invalidateQueries({ queryKey: ['pattern-tech-pack'] });
  };

  const approve = useMutation({
    mutationFn: () => inventoryApi.approveMaterialMasterRequest(review!.id, {
      materialCode: approveForm.materialCode.trim() || undefined,
      unitCost: Number(approveForm.unitCost) || 0,
      reviewNotes: approveForm.reviewNotes.trim() || undefined,
    }),
    onSuccess: () => {
      setReview(null);
      setError('');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const reject = useMutation({
    mutationFn: () => inventoryApi.rejectMaterialMasterRequest(review!.id, {
      reviewNotes: rejectNotes.trim() || undefined,
    }),
    onSuccess: () => {
      setReview(null);
      setRejectNotes('');
      setError('');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const openApprove = (r: MaterialMasterRequest) => {
    setError('');
    setApproveForm({
      materialCode: r.proposedCode || '',
      unitCost: String(r.unitCost ?? 0),
      reviewNotes: '',
    });
    setReview({ id: r._id, mode: 'approve' });
  };

  return (
    <div className="space-y-3">
      <ErpCard className="!p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList size={14} className="text-[var(--erp-accent)]" />
            <div>
              <h3 className="text-[11px] font-semibold text-erp-text-primary">Pattern fabric requests</h3>
              <p className="text-[10px] text-erp-text-muted">
                Pattern masters cannot create store SKUs. Approve to add the fabric and attach it to their tech pack.
              </p>
            </div>
          </div>
          <ErpSelect className="!w-36 !py-1 text-[11px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="">All</option>
          </ErpSelect>
        </div>
        {error && <p className="mb-2 text-[10px] text-red-700">{error}</p>}
        {isLoading && <p className="text-[10px] text-erp-text-muted">Loading…</p>}
        {!isLoading && items.length === 0 && (
          <p className="py-6 text-center text-[11px] text-erp-text-muted">No {status ? status.toLowerCase() : ''} requests.</p>
        )}
        <div className="space-y-2">
          {items.map((r) => {
            const design = designLabel(r.designId);
            return (
              <div key={r._id} className="rounded border border-[var(--erp-border)] p-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-medium text-erp-text-primary">
                      {r.requestNumber} · {r.name}
                    </p>
                    <p className="text-[10px] text-erp-text-muted">
                      {r.category || 'FABRIC'} · {unitLabel(r.unit)}
                      {r.proposedCode ? ` · code ${r.proposedCode}` : ''}
                      {personName(r.requestedBy) ? ` · ${personName(r.requestedBy)}` : ''}
                      {r.createdAt ? ` · ${formatDateTime(r.createdAt)}` : ''}
                    </p>
                    {design.id && (
                      <Link to={`/pattern?designId=${design.id}`} className="text-[10px] text-[var(--erp-accent)]">
                        {design.text}
                      </Link>
                    )}
                    {r.notes && <p className="mt-0.5 text-[10px] text-erp-text-muted">{r.notes}</p>}
                    {r.status === 'APPROVED' && (
                      <p className="mt-0.5 text-[10px] text-erp-text-muted">Store SKU: {materialCodeOf(r)}</p>
                    )}
                    {r.status === 'REJECTED' && r.reviewNotes && (
                      <p className="mt-0.5 text-[10px] text-red-700">{r.reviewNotes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ErpStatusBadge status={r.status} />
                    {canApprove && r.status === 'PENDING' && (
                      <>
                        <ErpButton className="!px-2 !py-1 text-[10px]" onClick={() => openApprove(r)}>Approve</ErpButton>
                        <ErpButton
                          variant="secondary"
                          className="!px-2 !py-1 text-[10px]"
                          onClick={() => { setError(''); setRejectNotes(''); setReview({ id: r._id, mode: 'reject' }); }}
                        >
                          Decline
                        </ErpButton>
                      </>
                    )}
                  </div>
                </div>
                {review?.id === r._id && review.mode === 'approve' && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div>
                      <label className={fieldLabel}>Material code</label>
                      <ErpInput
                        className="!py-1 font-mono text-[11px]"
                        value={approveForm.materialCode}
                        onChange={(e) => setApproveForm((f) => ({ ...f, materialCode: e.target.value }))}
                        placeholder="Auto if blank"
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Unit cost</label>
                      <ErpInput
                        type="number"
                        min={0}
                        className="!py-1 text-[11px]"
                        value={approveForm.unitCost}
                        onChange={(e) => setApproveForm((f) => ({ ...f, unitCost: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className={fieldLabel}>Note</label>
                      <ErpInput
                        className="!py-1 text-[11px]"
                        value={approveForm.reviewNotes}
                        onChange={(e) => setApproveForm((f) => ({ ...f, reviewNotes: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2 sm:col-span-3">
                      <ErpButton className="!px-3 !py-1 text-[10px]" disabled={approve.isPending} onClick={() => approve.mutate()}>
                        {approve.isPending ? 'Saving…' : `Create ${selected?.name || 'fabric'} & attach`}
                      </ErpButton>
                      <ErpButton variant="secondary" className="!px-3 !py-1 text-[10px]" onClick={() => setReview(null)}>Cancel</ErpButton>
                    </div>
                  </div>
                )}
                {review?.id === r._id && review.mode === 'reject' && (
                  <div className="mt-2 space-y-2">
                    <label className={fieldLabel}>Reason</label>
                    <ErpInput className="!py-1 text-[11px]" value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Optional" />
                    <div className="flex gap-2">
                      <ErpButton className="!bg-red-600 !px-3 !py-1 text-[10px] hover:!bg-red-700" disabled={reject.isPending} onClick={() => reject.mutate()}>
                        {reject.isPending ? 'Declining…' : 'Decline request'}
                      </ErpButton>
                      <ErpButton variant="secondary" className="!px-3 !py-1 text-[10px]" onClick={() => setReview(null)}>Cancel</ErpButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ErpCard>
    </div>
  );
}
