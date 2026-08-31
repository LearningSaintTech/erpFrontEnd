import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, ClipboardList, Download, Layers, Plus, RefreshCw, Search, Shirt,
} from 'lucide-react';
import { designApi } from '../../services/manufacturing';
import { useAuth } from '../../app/providers/AuthProvider';
import type { Design } from '../../types/api';
import {
  ErpPageHeader, ErpDataTable, ErpStatusBadge, ErpButton, ErpCard, ErpInput, ErpSelect, ErpSearchSelect,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { CommentPrompt } from '../approvals/components/CommentPrompt';
import {
  canViewAllDesigns, canEditDesign, canCreateDesign, canShowDesignApproverUi, isDesignAdmin,
  collectionName, designerLabel, DESIGN_STATUSES, formatDesignPrice, statusLabel,
} from './designUtils';
import { getDesignSubmitGaps } from './designFormUtils';
import { downloadCsv } from '../../utils/csvExport';
import { RevisionFeedbackInline, RejectionFeedbackInline } from './RevisionFeedbackBanner';
import { ApproverActionDropdown, type ApproverDecision } from './components/ApproverActionDropdown';
import { ReleasePatternMasterModal } from './components/ReleasePatternMasterModal';
import { hasPermission } from '../../utils/permissions';
import { toErrorMessage } from '../../utils/errors';
import { useInventoryCodes } from '../../hooks/useInventoryCodes';

const PAGE_SIZE = 20;

type ReviewPrompt = { id: string; type: 'reject' | 'revision' };

export function DesignsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, permissions } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;

  const isAdmin = isDesignAdmin(permissions, isSuperAdmin);
  const viewAll = canViewAllDesigns(permissions, isSuperAdmin);
  const canCreate = canCreateDesign(permissions, isSuperAdmin);
  const showApproverActions = canShowDesignApproverUi(permissions, isSuperAdmin);
  const canExport = !isAdmin && (permissions.includes('*') || permissions.includes('design.export'));
  const canPattern = !isAdmin && hasPermission(permissions, 'pattern.read', isSuperAdmin);
  const canSample = !isAdmin && hasPermission(permissions, 'sampling.read', isSuperAdmin);

  const exportDesigns = () => {
    downloadCsv('designs.csv', ['Code', 'Title', 'Status', 'Category', 'Target price'], designs.map((d) => [
      d.designCode,
      d.title,
      d.status,
      d.category ?? '',
      d.targetPrice ?? '',
    ]));
  };

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewPrompt, setReviewPrompt] = useState<ReviewPrompt | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<Design | null>(null);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const { data: categoryCodes = [] } = useInventoryCodes('CATEGORY');
  const { data: collectionCodes = [] } = useInventoryCodes('COLLECTION');
  const { data: stats } = useQuery({ queryKey: ['design-stats'], queryFn: designApi.stats });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['designs-page', page, statusFilter, categoryFilter, collectionFilter, search],
    queryFn: () => designApi.listPage({
      page,
      limit: PAGE_SIZE,
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      collectionId: collectionFilter || undefined,
      search: search || undefined,
    }),
  });

  const designs = data?.items ?? [];
  const meta = data?.meta;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['designs-page'] });
    qc.invalidateQueries({ queryKey: ['designs'] });
    qc.invalidateQueries({ queryKey: ['design-stats'] });
    qc.invalidateQueries({ queryKey: ['approvals-pending'] });
    qc.invalidateQueries({ queryKey: ['approvals-stats'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const action = useMutation({
    mutationFn: ({
      id, action: act, patternMasterId,
    }: { id: string; action: 'submit' | 'release' | 'clone' | 'approve'; patternMasterId?: string }) => {
      if (act === 'submit') return designApi.submit(id);
      if (act === 'clone') return designApi.clone(id);
      if (act === 'approve') return designApi.approve(id);
      return designApi.release(id, { patternMasterId });
    },
    onSuccess: (data, vars) => {
      if (vars.action === 'release') setReleaseTarget(null);
      invalidate();
      qc.invalidateQueries({ queryKey: ['pattern-developments'] });
      qc.invalidateQueries({ queryKey: ['pattern-stats'] });
      qc.invalidateQueries({ queryKey: ['designs-released'] });
      const msg = vars.action === 'submit' ? 'Submitted for approval'
        : vars.action === 'release' ? 'Design released and assigned to pattern master'
          : vars.action === 'approve' ? 'Design approved'
            : 'Design cloned';
      showSuccess(msg);
      if (vars.action === 'clone' && data?._id) {
        navigate(`/designs/${data._id}/edit`);
      }
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
  });

  const reviewAction = useMutation({
    mutationFn: ({ id, type, comments }: { id: string; type: 'reject' | 'revision'; comments: string }) =>
      type === 'reject' ? designApi.reject(id, comments) : designApi.revision(id, comments),
    onSuccess: (_, vars) => {
      setReviewPrompt(null);
      invalidate();
      showSuccess(vars.type === 'reject' ? 'Design rejected' : 'Revision requested');
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
  });

  const handleApproverDecision = (id: string, decision: ApproverDecision) => {
    if (decision === 'approve') {
      action.mutate({ id, action: 'approve' });
      return;
    }
    if (decision === 'release') {
      const design = designs.find((d) => d._id === id) ?? null;
      setReleaseTarget(design ?? { _id: id } as Design);
      return;
    }
    setReviewPrompt({ id, type: decision });
  };

  const colSpan = viewAll ? 8 : 7;

  const tabsSubtitle = useMemo(() => (
    isAdmin
      ? 'Review submissions — approve, request revision, reject, or release'
      : 'Your design tech packs — create, edit, and submit'
  ), [isAdmin]);

  return (
    <div className="designs-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title={isAdmin ? 'Design library' : 'My designs'}
        subtitle={tabsSubtitle}
        actions={
          <div className="flex gap-2">
            {canExport && designs.length > 0 && (
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[11px]" onClick={exportDesigns}>
                <Download size={12} className="mr-1 inline" /> Export CSV
              </ErpButton>
            )}
            {canCreate && (
              <Link to="/designs/new" className="erp-btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-[11px]">
                <Plus size={12} /> New design
              </Link>
            )}
          </div>
        }
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Shirt size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Total</p>
              <p className="text-lg font-semibold">{stats?.total ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Drafts</p>
              <p className="text-lg font-semibold">{stats?.draftOnly ?? stats?.draft ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-amber-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Revisions</p>
              <p className="text-lg font-semibold">{stats?.revisionRequested ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-sky-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">In review</p>
              <p className="text-lg font-semibold">{stats?.inReview ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Released</p>
              <p className="text-lg font-semibold">{stats?.released ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-erp-text-muted" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Rejected</p>
              <p className="text-lg font-semibold">{stats?.rejected ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
      </div>

      <ErpCard className="mb-3 !p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Search</label>
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
              <ErpInput
                className="!pl-7 !py-1.5 text-[11px]"
                placeholder="Title, code, style #…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { setSearch(searchInput.trim()); setPage(1); }
                }}
              />
            </div>
          </div>
          <div className="min-w-[180px]">
            <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Collection</label>
            <ErpSearchSelect
              className="w-full min-w-[180px] !py-1.5 text-[11px]"
              value={collectionFilter}
              placeholder="All collections"
              searchPlaceholder="Search collection…"
              options={collectionCodes.map((c) => ({
                value: c.code,
                label: `${c.code} — ${c.name}`,
                keywords: `${c.code} ${c.name}`,
              }))}
              onChange={(code) => { setCollectionFilter(code); setPage(1); }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Status</label>
            <ErpSelect className="!py-1.5 text-[11px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {DESIGN_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </ErpSelect>
          </div>
          <div className="min-w-[180px]">
            <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Category</label>
            <ErpSearchSelect
              className="w-full min-w-[180px] !py-1.5 text-[11px]"
              value={categoryFilter}
              placeholder="All categories"
              searchPlaceholder="Search category…"
              options={categoryCodes.map((c) => ({
                value: c.code,
                label: `${c.code} — ${c.name}`,
                keywords: `${c.code} ${c.name}`,
              }))}
              onChange={(code) => { setCategoryFilter(code); setPage(1); }}
            />
          </div>
          <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => { setSearch(searchInput.trim()); setPage(1); }}>Search</ErpButton>
          <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          </ErpButton>
        </div>
      </ErpCard>

      <ErpCard className="overflow-hidden !p-0">
        {isLoading ? (
          <p className="p-4 text-[11px] text-erp-text-muted">Loading designs…</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Style #</th>
                  <th>Collection</th>
                  {viewAll && <th>Designer</th>}
                  <th>Price</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {designs.map((d: Design) => (
                  <tr key={d._id}>
                    <td className="font-mono text-[11px]">{d.designCode}</td>
                    <td>
                      <Link to={`/designs/${d._id}/edit`} className="text-[11px] font-medium text-[var(--erp-accent)] hover:underline">
                        {d.title}
                      </Link>
                      {d.status === 'REVISION_REQUESTED' && d.revisionComments && (
                        <RevisionFeedbackInline comments={d.revisionComments} />
                      )}
                      {d.status === 'REJECTED' && d.rejectionComments && (
                        <RejectionFeedbackInline comments={d.rejectionComments} />
                      )}
                    </td>
                    <td className="font-mono text-[11px] text-erp-text-muted">{d.styleNumber || '—'}</td>
                    <td className="text-[11px] text-erp-text-muted">{collectionName(d.collectionId, d.collectionCode)}</td>
                    {viewAll && <td className="text-[11px]">{designerLabel(d.createdBy)}</td>}
                    <td className="text-[11px]">{formatDesignPrice(d)}</td>
                    <td><ErpStatusBadge status={d.status} /></td>
                    <td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {/* Designer actions */}
                        {!isAdmin && canEditDesign(permissions, isSuperAdmin, d.status) && (
                          <Link to={`/designs/${d._id}/edit`} className="erp-btn-secondary !px-2 !py-1 text-[10px]">Edit</Link>
                        )}
                        {!isAdmin && canCreate && d.status === 'DRAFT' && canEditDesign(permissions, isSuperAdmin, d.status) && (
                          <ErpButton
                            className="!px-2 !py-1 text-[10px]"
                            disabled={action.isPending || !!getDesignSubmitGaps({ hasImage: true, sizeChartData: d.sizeChartData }).sizeRange}
                            title={getDesignSubmitGaps({ hasImage: true, sizeChartData: d.sizeChartData }).sizeRange ? 'Add a size range before submit' : undefined}
                            onClick={() => action.mutate({ id: d._id, action: 'submit' })}
                          >
                            Submit
                          </ErpButton>
                        )}
                        {!isAdmin && d.status === 'REJECTED' && canCreate && (
                          <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={action.isPending} onClick={() => action.mutate({ id: d._id, action: 'clone' })}>Clone</ErpButton>
                        )}
                        {!isAdmin && d.status === 'RELEASED' && canPattern && (
                          <Link to={`/pattern?designId=${d._id}`} className="self-center text-[10px] text-[var(--erp-accent)]">Pattern →</Link>
                        )}
                        {!isAdmin && d.status === 'RELEASED' && canSample && (
                          <Link to={`/samples?designId=${d._id}`} className="self-center text-[10px] text-[var(--erp-accent)]">Sample →</Link>
                        )}

                        {/* Admin: only review decision / release */}
                        {showApproverActions && (d.status === 'IN_REVIEW' || d.status === 'APPROVED') && (
                          <ApproverActionDropdown
                            allowed={showApproverActions}
                            status={d.status}
                            compact
                            disabled={action.isPending || reviewAction.isPending}
                            loading={action.isPending || reviewAction.isPending}
                            onDecide={(decision) => handleApproverDecision(d._id, decision)}
                          />
                        )}

                        {/* Both: open to view details */}
                        <Link to={`/designs/${d._id}/edit`} className="erp-btn-secondary !px-2 !py-1 text-[10px]">
                          {isAdmin ? 'View' : 'Open'}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {designs.length === 0 && (
                  <tr>
                    <td colSpan={colSpan + 1} className="px-4 py-8 text-center text-[11px] text-erp-text-muted">
                      {isAdmin ? 'No designs match your filters' : 'No designs yet — create your first tech pack'}
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

      {showApproverActions && (
        <>
          <CommentPrompt
            open={!!reviewPrompt}
            title={reviewPrompt?.type === 'reject' ? 'Reject design' : 'Request revision'}
            message="Explain what needs to change so the designer can resubmit."
            required
            minLength={3}
            confirmLabel={reviewPrompt?.type === 'reject' ? 'Reject' : 'Send back'}
            loading={reviewAction.isPending}
            onCancel={() => setReviewPrompt(null)}
            onConfirm={(comments) => {
              if (!reviewPrompt) return;
              reviewAction.mutate({ id: reviewPrompt.id, type: reviewPrompt.type, comments });
            }}
          />
          <ReleasePatternMasterModal
            open={!!releaseTarget}
            designLabel={
              releaseTarget?.designCode
                ? `${releaseTarget.designCode}${releaseTarget.title ? ` — ${releaseTarget.title}` : ''}`
                : undefined
            }
            loading={action.isPending}
            onCancel={() => setReleaseTarget(null)}
            onConfirm={(patternMasterId) => {
              if (!releaseTarget) return;
              action.mutate({ id: releaseTarget._id, action: 'release', patternMasterId });
            }}
          />
        </>
      )}
    </div>
  );
}
