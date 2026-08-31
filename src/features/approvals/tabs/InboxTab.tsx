import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, RefreshCw, Search } from 'lucide-react';
import { approvalApi } from '../../../services/approvals';
import type { ApprovalInstance } from '../../../types/api';
import {
  ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../../components/erp';
import { CommentPrompt } from '../components/CommentPrompt';
import { ApprovalDetailPanel } from '../components/ApprovalDetailPanel';
import {
  documentTypeLabel, formatAge, isOverdue, submitterName, workflowLevelLabel,
  canActOnApproval, requiredApproverLabel,
} from '../approvalUtils';

const PAGE_SIZE = 20;

type ActionType = 'approve' | 'reject' | 'changes';

export function InboxTab({
  canApprove,
  permissions,
  userId,
  documentTypes,
  onError,
  onSuccess,
}: {
  canApprove: boolean;
  permissions: string[];
  userId?: string;
  documentTypes: string[];
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ id: string; type: ActionType; documentType: string } | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['approvals-pending', page, typeFilter, search],
    queryFn: () => approvalApi.pending({
      page,
      limit: PAGE_SIZE,
      documentType: typeFilter || undefined,
      search: search || undefined,
    }),
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['approvals-pending'] });
    qc.invalidateQueries({ queryKey: ['approvals-history'] });
    qc.invalidateQueries({ queryKey: ['approvals-stats'] });
    qc.invalidateQueries({ queryKey: ['designs'] });
    qc.invalidateQueries({ queryKey: ['designs-page'] });
    qc.invalidateQueries({ queryKey: ['design-stats'] });
    qc.invalidateQueries({ queryKey: ['samples'] });
    qc.invalidateQueries({ queryKey: ['production-orders'] });
    qc.invalidateQueries({ queryKey: ['production-orders'] });
  };

  const actionMut = useMutation({
    mutationFn: async ({ id, type, comments }: { id: string; type: ActionType; documentType: string; comments?: string }) => {
      if (type === 'approve') return approvalApi.approve(id, comments);
      if (type === 'reject') return approvalApi.reject(id, comments!);
      return approvalApi.requestChanges(id, comments!);
    },
    onSuccess: (_, vars) => {
      setPrompt(null);
      setExpandedId(null);
      invalidate();
      const msg = vars.type === 'approve' ? 'Approved'
        : vars.type === 'reject' ? 'Rejected' : 'Changes requested';
      onSuccess(msg);
      if (vars.documentType === 'DESIGN') navigate('/designs');
      else if (vars.documentType === 'SAMPLE_MATERIAL' || vars.documentType === 'SAMPLE') {
        navigate('/samples');
      }
    },
    onError: (e: Error) => onError(e.message),
  });

  const runAction = (item: ApprovalInstance, type: ActionType) => {
    if (!canApprove || !canAct(item)) return;
    setPrompt({ id: item._id, type, documentType: item.documentType });
  };

  const canAct = (item: ApprovalInstance) => canActOnApproval(item, permissions, userId);

  const expanded = items.find((i) => i._id === expandedId);

  return (
    <div className="space-y-3">
      <ErpCard className="!p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Search</label>
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
              <ErpInput
                className="!pl-7 !py-1.5 text-[11px]"
                placeholder="Document type…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { setSearch(searchInput.trim()); setPage(1); }
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
              {documentTypes.map((t) => <option key={t} value={t}>{documentTypeLabel(t)}</option>)}
            </ErpSelect>
          </div>
          <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => { setSearch(searchInput.trim()); setPage(1); }}>
            Search
          </ErpButton>
          <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          </ErpButton>
        </div>
      </ErpCard>

      {expanded && (
        <ApprovalDetailPanel item={expanded} />
      )}

      <ErpCard className="overflow-hidden !p-0">
        {isLoading ? (
          <p className="p-4 text-[11px] text-erp-text-muted">Loading inbox…</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Submitter</th>
                  <th>Age</th>
                  <th>Level</th>
                  <th>Status</th>
                  {canApprove && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((a: ApprovalInstance) => {
                  const overdue = isOverdue(a.submittedAt);
                  const code = a.documentSummary?.code || `…${String(a.documentId).slice(-8)}`;
                  const actionable = canAct(a);
                  return (
                    <tr key={a._id} className={overdue ? 'bg-amber-500/5' : undefined}>
                      <td>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-left"
                          onClick={() => setExpandedId(expandedId === a._id ? null : a._id)}
                        >
                          <ChevronRight
                            size={12}
                            className={`text-erp-text-muted transition-transform ${expandedId === a._id ? 'rotate-90' : ''}`}
                          />
                          <div>
                            <p className="text-[11px] font-medium">{code}</p>
                            <p className="text-[10px] text-erp-text-muted">{documentTypeLabel(a.documentType)}</p>
                          </div>
                        </button>
                        {a.documentSummary?.route && (
                          <Link to={a.documentSummary.route} className="ml-4 text-[10px] text-[var(--erp-accent)]">
                            Open →
                          </Link>
                        )}
                      </td>
                      <td className="text-[11px]">{submitterName(a.submittedBy)}</td>
                      <td className={`text-[11px] ${overdue ? 'font-medium text-amber-600' : ''}`}>
                        {formatAge(a.submittedAt)}
                        {overdue && <span className="ml-1 text-[10px]">(SLA)</span>}
                      </td>
                      <td className="text-[10px] text-erp-text-muted">{workflowLevelLabel(a)}</td>
                      <td><ErpStatusBadge status={a.status} /></td>
                      {canApprove && (
                        <td className="text-right">
                          {actionable ? (
                            <div className="flex justify-end gap-1">
                              <ErpButton className="!px-2 !py-1 text-[10px]" disabled={actionMut.isPending} onClick={() => runAction(a, 'approve')}>
                                {(a.currentLevel ?? 1) > 1 ? `Approve L${a.currentLevel}` : 'Approve'}
                              </ErpButton>
                              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={actionMut.isPending} onClick={() => runAction(a, 'changes')}>
                                Changes
                              </ErpButton>
                              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={actionMut.isPending} onClick={() => runAction(a, 'reject')}>
                                Reject
                              </ErpButton>
                            </div>
                          ) : (
                            <span className="text-[10px] text-erp-text-muted" title={requiredApproverLabel(a)}>
                              {(() => {
                                const submitterId = typeof a.submittedBy === 'object' ? a.submittedBy?._id : a.submittedBy;
                                if (userId && submitterId && String(submitterId) === String(userId) && (a.currentLevel ?? 1) <= 1) {
                                  return 'You submitted this — another approver must act';
                                }
                                return `Awaiting ${requiredApproverLabel(a)}`;
                              })()}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={canApprove ? 6 : 5} className="px-4 py-8 text-center text-[11px] text-erp-text-muted">
                      No pending approvals — you're all caught up
                    </td>
                  </tr>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}
        {meta && meta.totalPages > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2">
            <p className="text-[10px] text-erp-text-muted">{meta.page}/{meta.totalPages} · {meta.total} pending</p>
            <div className="flex gap-1">
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</ErpButton>
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
            </div>
          </div>
        )}
      </ErpCard>

      <CommentPrompt
        open={!!prompt}
        title={
          prompt?.type === 'approve' ? 'Approve request'
            : prompt?.type === 'reject' ? 'Reject request'
              : 'Request changes'
        }
        message={
          prompt?.type === 'approve'
            ? 'Add optional comments for the submitter.'
            : 'A reason is required so the submitter knows what to fix.'
        }
        required={prompt?.type !== 'approve'}
        minLength={3}
        confirmLabel={
          prompt?.type === 'approve' ? 'Approve'
            : prompt?.type === 'reject' ? 'Reject' : 'Send back'
        }
        loading={actionMut.isPending}
        onCancel={() => setPrompt(null)}
        onConfirm={(comments) => {
          if (!prompt) return;
          actionMut.mutate({ id: prompt.id, type: prompt.type, documentType: prompt.documentType, comments });
        }}
      />
    </div>
  );
}
