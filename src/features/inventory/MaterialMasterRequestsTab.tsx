import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../../services/manufacturing';
import type { MaterialMasterRequest } from '../../types/api';
import { ErpButton, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge } from '../../components/erp';
import { categoryLabel, unitLabel, formatDateTime } from './inventoryUtils';
import { TabToolbar, btnSm, fieldLabel } from './inventoryLayout';

function personName(v: MaterialMasterRequest['requestedBy']): string {
  if (!v || typeof v === 'string') return '';
  return [v.firstName, v.lastName].filter(Boolean).join(' ') || v.email || '';
}

function designLabel(v: MaterialMasterRequest['designId']): { id: string; text: string } {
  if (!v) return { id: '', text: '-' };
  if (typeof v === 'string') return { id: v, text: v };
  return { id: v._id, text: [v.designCode, v.title].filter(Boolean).join(' - ') || v._id };
}

function materialCodeOf(r: MaterialMasterRequest): string {
  const m = r.materialId;
  if (m && typeof m !== 'string') return m.materialCode;
  return r.proposedCode || '-';
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
    <div>
      <TabToolbar
        title="Pattern fabric requests"
        hint="Pattern masters cannot create store SKUs. Approve to add the fabric and attach it to their tech pack."
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className="text-[var(--erp-accent)]" />
          <ErpSelect className="!w-36 !py-1.5 text-[12px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="">All</option>
          </ErpSelect>
        </div>
      </TabToolbar>

      {error && <p className="px-4 pt-3 text-[12px] text-red-700">{error}</p>}
      {isLoading && <p className="p-6 text-[13px] text-erp-text-muted">Loading...</p>}
      {!isLoading && items.length === 0 && (
        <p className="px-4 py-10 text-center text-[13px] text-erp-text-muted">
          No {status ? status.toLowerCase() : ''} requests.
        </p>
      )}

      {!isLoading && items.length > 0 && (
        <div className="overflow-x-auto">
          <ErpDataTable className="w-full min-w-[960px] text-[12px]">
            <thead>
              <tr>
                <th>Request</th>
                <th>Fabric</th>
                <th>Specs</th>
                <th>Design</th>
                <th>Requested by</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const design = designLabel(r.designId);
                const isOpen = review?.id === r._id;
                return (
                  <Fragment key={r._id}>
                    <tr>
                      <td className="whitespace-nowrap font-mono text-[12px] font-medium">{r.requestNumber}</td>
                      <td>
                        <p className="font-medium text-erp-text-primary">{r.name}</p>
                        {r.notes && <p className="mt-0.5 max-w-xs text-[12px] text-erp-text-muted">{r.notes}</p>}
                        {r.status === 'APPROVED' && (
                          <p className="mt-0.5 text-[11px] text-erp-text-muted">Store SKU: {materialCodeOf(r)}</p>
                        )}
                        {r.status === 'REJECTED' && r.reviewNotes && (
                          <p className="mt-0.5 text-[11px] text-red-700">{r.reviewNotes}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-erp-text-muted">
                        {categoryLabel(r.category || 'FABRIC')}
                        <span className="mx-1 text-[var(--erp-border)]">|</span>
                        {unitLabel(r.unit)}
                        {r.proposedCode ? (
                          <>
                            <span className="mx-1 text-[var(--erp-border)]">|</span>
                            <span className="font-mono">{r.proposedCode}</span>
                          </>
                        ) : null}
                      </td>
                      <td>
                        {design.id ? (
                          <Link to={`/pattern?designId=${design.id}`} className="text-[var(--erp-accent)] hover:underline">
                            {design.text}
                          </Link>
                        ) : '-'}
                      </td>
                      <td>{personName(r.requestedBy) || '-'}</td>
                      <td className="whitespace-nowrap text-erp-text-muted">{formatDateTime(r.createdAt)}</td>
                      <td><ErpStatusBadge status={r.status} /></td>
                      <td className="text-right">
                        {canApprove && r.status === 'PENDING' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <ErpButton className={btnSm} onClick={() => openApprove(r)}>Approve</ErpButton>
                            <ErpButton
                              variant="secondary"
                              className={btnSm}
                              onClick={() => { setError(''); setRejectNotes(''); setReview({ id: r._id, mode: 'reject' }); }}
                            >
                              Decline
                            </ErpButton>
                          </div>
                        ) : (
                          <span className="text-erp-text-muted">-</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && review?.mode === 'approve' && (
                      <tr className="bg-[var(--erp-surface-muted)]">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
                            <div>
                              <label className={fieldLabel}>Material code</label>
                              <ErpInput
                                className="!py-1.5 font-mono text-[12px]"
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
                                className="!py-1.5 text-[12px]"
                                value={approveForm.unitCost}
                                onChange={(e) => setApproveForm((f) => ({ ...f, unitCost: e.target.value }))}
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className={fieldLabel}>Note</label>
                              <ErpInput
                                className="!py-1.5 text-[12px]"
                                value={approveForm.reviewNotes}
                                onChange={(e) => setApproveForm((f) => ({ ...f, reviewNotes: e.target.value }))}
                              />
                            </div>
                            <div className="flex gap-2 sm:col-span-3">
                              <ErpButton className={btnSm} disabled={approve.isPending} onClick={() => approve.mutate()}>
                                {approve.isPending ? 'Saving...' : `Create ${selected?.name || 'fabric'} and attach`}
                              </ErpButton>
                              <ErpButton variant="secondary" className={btnSm} onClick={() => setReview(null)}>Cancel</ErpButton>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isOpen && review?.mode === 'reject' && (
                      <tr className="bg-[var(--erp-surface-muted)]">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="max-w-xl space-y-3">
                            <div>
                              <label className={fieldLabel}>Reason</label>
                              <ErpInput className="!py-1.5 text-[12px]" value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Optional" />
                            </div>
                            <div className="flex gap-2">
                              <ErpButton className={`!bg-red-600 hover:!bg-red-700 ${btnSm}`} disabled={reject.isPending} onClick={() => reject.mutate()}>
                                {reject.isPending ? 'Declining...' : 'Decline request'}
                              </ErpButton>
                              <ErpButton variant="secondary" className={btnSm} onClick={() => setReview(null)}>Cancel</ErpButton>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </ErpDataTable>
        </div>
      )}
    </div>
  );
}
