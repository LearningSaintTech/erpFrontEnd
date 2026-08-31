import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, ClipboardCheck, RefreshCw, Ruler, Scissors, Search, UserPlus,
} from 'lucide-react';
import { designApi, patternApi } from '../../services/manufacturing';
import { useAuth } from '../../app/providers/AuthProvider';
import { AlertBanner } from '../../components/AlertBanner';
import {
  ErpPageHeader, ErpStatusBadge, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpSearchSelect, ErpTabs,
} from '../../components/erp';
import type { Design, PatternDevelopment } from '../../types/api';
import { SuccessBanner } from '../users/SuccessBanner';
import { ConfirmDialog } from '../users/ConfirmDialog';
import { toErrorMessage } from '../../utils/errors';
import { designIdOf, designLabel, masterLabel, statusLabel } from './patternUtils';
import { queueProgress } from './patternWorkflowUtils';
import { patternCapabilities } from './patternPermissions';
import { PatternWorkspace } from './components/PatternWorkspace';

const PAGE_SIZE = 20;
const fieldLabel = 'mb-1 block text-[10px] font-medium text-erp-text-muted';

type TabId = 'active' | 'completed';

export function PatternPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const { canAssign, canReopen, myWorkOnly } = patternCapabilities(permissions, isSuperAdmin);
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkDesignId = searchParams.get('designId') ?? '';
  const [tab, setTab] = useState<TabId>('active');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [assignDesignId, setAssignDesignId] = useState('');
  const [assignMasterId, setAssignMasterId] = useState('');
  const [workspaceDesignId, setWorkspaceDesignId] = useState<string | null>(null);
  const [reopenId, setReopenId] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const openWorkspace = (designId: string) => {
    setWorkspaceDesignId(designId);
    setSearchParams({ designId });
  };

  const closeWorkspace = () => {
    setWorkspaceDesignId(null);
    setSearchParams({});
  };

  const listStatus = useMemo(() => {
    if (tab === 'completed') return 'COMPLETED';
    return statusFilter || undefined;
  }, [tab, statusFilter]);

  const { data: deepPattern, isFetched: deepLinkChecked } = useQuery({
    queryKey: ['pattern-development', deepLinkDesignId],
    queryFn: () => patternApi.get(deepLinkDesignId),
    enabled: !!deepLinkDesignId,
    retry: false,
  });

  useEffect(() => {
    if (!deepLinkDesignId) {
      setWorkspaceDesignId(null);
      return;
    }
    if (!deepLinkChecked) return;
    if (deepPattern) {
      setWorkspaceDesignId(deepLinkDesignId);
      if (deepPattern.status === 'COMPLETED') setTab('completed');
    } else {
      setWorkspaceDesignId(null);
      if (canAssign) setAssignDesignId(deepLinkDesignId);
    }
  }, [deepLinkDesignId, deepLinkChecked, deepPattern, canAssign]);

  const { data: stats } = useQuery({ queryKey: ['pattern-stats'], queryFn: patternApi.stats });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['pattern-developments', page, listStatus, search, tab, myWorkOnly ? user?._id : ''],
    queryFn: () => patternApi.listPage({
      page,
      limit: PAGE_SIZE,
      status: listStatus,
      search: search || undefined,
      patternMasterId: myWorkOnly ? user?._id : undefined,
    }),
  });

  const patterns = data?.items ?? [];
  const meta = data?.meta;

  const { data: allPatterns = [] } = useQuery({
    queryKey: ['pattern-developments-all-ids'],
    queryFn: () => patternApi.list(),
    enabled: canAssign,
  });

  const { data: designs = [] } = useQuery({
    queryKey: ['designs-released'],
    queryFn: () => designApi.list({ status: 'RELEASED' }),
    enabled: canAssign,
  });

  const { data: assignableMasters = [] } = useQuery({
    queryKey: ['pattern-masters'],
    queryFn: patternApi.listMasters,
    enabled: canAssign,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['pattern-developments'] });
    qc.invalidateQueries({ queryKey: ['pattern-stats'] });
    if (deepLinkDesignId) {
      qc.invalidateQueries({ queryKey: ['pattern-development', deepLinkDesignId] });
    }
  };

  const assignMutation = useMutation({
    mutationFn: () => patternApi.assign({ designId: assignDesignId, patternMasterId: assignMasterId }),
    onSuccess: () => {
      const did = assignDesignId;
      setAssignDesignId('');
      setAssignMasterId('');
      invalidate();
      showSuccess('Pattern master assigned');
      if (did) openWorkspace(did);
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
  });

  const reopenMutation = useMutation({
    mutationFn: (designId: string) => patternApi.reopen(designId),
    onSuccess: (_, designId) => {
      setReopenId(null);
      invalidate();
      showSuccess('Pattern development reopened');
      openWorkspace(designId);
    },
    onError: (e: unknown) => setError(toErrorMessage(e)),
  });

  const assignedDesignIds = new Set(allPatterns.map(designIdOf));
  const unassignedReleased = designs.filter((d: Design) => !assignedDesignIds.has(d._id));
  const activeCount = (stats?.assigned ?? 0) + (stats?.inProgress ?? 0);

  if (workspaceDesignId) {
    return (
      <div className="pattern-page text-xs leading-snug">
        <PatternWorkspace
          designId={workspaceDesignId}
          onClose={closeWorkspace}
          onCompleted={(id) => navigate(`/samples?designId=${id}&from=pattern`)}
        />
      </div>
    );
  }

  return (
    <div className="pattern-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      {deepLinkDesignId && deepLinkChecked && !deepPattern && canAssign && (
        <ErpCard className="mb-3 !border-amber-500/30 !bg-amber-500/5 !p-3">
          <p className="text-[11px] text-erp-text-primary">
            Design linked from pipeline — assign a pattern master below to start development.
          </p>
        </ErpCard>
      )}

      {deepLinkDesignId && deepLinkChecked && !deepPattern && myWorkOnly && (
        <ErpCard className="mb-3 !border-amber-500/30 !bg-amber-500/5 !p-3">
          <p className="text-[11px] text-erp-text-primary">
            This design is not assigned to you yet. Wait for a design manager to assign pattern development.
          </p>
        </ErpCard>
      )}

      <ErpPageHeader
        title="Pattern development"
        subtitle={
          myWorkOnly
            ? 'Your assignments — tech pack → marker → grading → sign-off → sampling.'
            : (
              <>
                Tech pack → marker → grading → sign-off → sampling.
                <Link to="/designs" className="ml-2 text-[var(--erp-accent)]">Design library →</Link>
              </>
            )
        }
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Scissors size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Total</p>
              <p className="text-lg font-semibold">{stats?.total ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-amber-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Active queue</p>
              <p className="text-lg font-semibold">{activeCount || '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <Ruler size={16} className="text-[var(--erp-accent)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">In progress</p>
              <p className="text-lg font-semibold">{stats?.inProgress ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
        <ErpCard className="!p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-erp-text-muted">Completed</p>
              <p className="text-lg font-semibold">{stats?.completed ?? '—'}</p>
            </div>
          </div>
        </ErpCard>
      </div>

      {canAssign && (
        <ErpCard className="mb-3 !p-3">
          <div className="flex items-center gap-2">
            <UserPlus size={14} className="text-[var(--erp-accent)]" />
            <h3 className="text-[11px] font-semibold text-erp-text-primary">Assign pattern master</h3>
          </div>
          <p className="mt-1 text-[10px] text-erp-text-muted">
            Released designs only. Opens the pattern workspace after assignment.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label className={fieldLabel}>Released design</label>
              <ErpSearchSelect
                className="w-full !py-1.5 text-[11px]"
                value={assignDesignId}
                placeholder="Select design…"
                searchPlaceholder="Search design…"
                options={unassignedReleased.map((d: Design) => ({
                  value: d._id,
                  label: `${d.designCode} — ${d.title}`,
                  keywords: `${d.designCode} ${d.title} ${d.styleNumber || ''}`,
                }))}
                onChange={(id) => setAssignDesignId(id)}
              />
            </div>
            <div className="min-w-[180px]">
              <label className={fieldLabel}>Pattern master</label>
              <ErpSearchSelect
                className="w-full !py-1.5 text-[11px]"
                value={assignMasterId}
                placeholder="Select user…"
                searchPlaceholder="Search master…"
                options={assignableMasters.map((u) => ({
                  value: u._id,
                  label: `${u.firstName} ${u.lastName}`.trim() || u.email,
                  keywords: `${u.firstName} ${u.lastName} ${u.email || ''}`,
                }))}
                onChange={(id) => setAssignMasterId(id)}
              />
            </div>
            <ErpButton
              className="!px-3 !py-1.5 text-[11px]"
              disabled={!assignDesignId || !assignMasterId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              Assign & open workspace
            </ErpButton>
          </div>
        </ErpCard>
      )}

      <ErpTabs
        tabs={[
          { id: 'active', label: `Active${activeCount ? ` (${activeCount})` : ''}` },
          { id: 'completed', label: `Completed${stats?.completed != null ? ` (${stats.completed})` : ''}` },
        ]}
        active={tab}
        onChange={(id) => { setTab(id as TabId); setPage(1); setStatusFilter(''); }}
      />

      <div className="mt-3 space-y-3">
        <ErpCard className="!p-3">
          <div className="flex flex-wrap items-end gap-2">
            {tab === 'active' && (
              <div>
                <label className={fieldLabel}>Status</label>
                <ErpSelect className="!py-1.5 text-[11px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All active</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In progress</option>
                </ErpSelect>
              </div>
            )}
            <div className="min-w-[160px] flex-1">
              <label className={fieldLabel}>Search</label>
              <div className="relative">
                <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
                <ErpInput
                  className="!pl-7 !py-1.5 text-[11px]"
                  placeholder="Design code or title…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { setSearch(searchInput.trim()); setPage(1); }
                  }}
                />
              </div>
            </div>
            <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => { setSearch(searchInput.trim()); setPage(1); }}>Search</ErpButton>
            <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            </ErpButton>
          </div>
        </ErpCard>

        <ErpCard className="overflow-hidden !p-0">
          {isLoading ? (
            <p className="p-4 text-[11px] text-erp-text-muted">Loading pattern queue…</p>
          ) : (
            <div className="overflow-x-auto">
              <ErpDataTable>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Design</th>
                    {!myWorkOnly && <th>Pattern master</th>}
                    <th>Workflow</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patterns.map((pd: PatternDevelopment) => {
                    const designId = designIdOf(pd);
                    const progress = queueProgress(pd);
                    return (
                      <tr key={pd._id}>
                        <td className="font-mono text-[10px]">{pd.patternDevelopmentCode || '—'}</td>
                        <td className="text-[11px]">
                          <button type="button" className="font-medium text-[var(--erp-accent)] hover:underline" onClick={() => openWorkspace(designId)}>
                            {designLabel(pd.designId)}
                          </button>
                        </td>
                        {!myWorkOnly && (
                          <td className="text-[11px]">{masterLabel(pd.patternMasterId)}</td>
                        )}
                        <td className="text-[11px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--erp-border)]">
                              <div className="h-full bg-[var(--erp-accent)]" style={{ width: `${progress.percent}%` }} />
                            </div>
                            <span className="text-[10px] text-erp-text-muted">{progress.done}/4 · {progress.label}</span>
                          </div>
                        </td>
                        <td><ErpStatusBadge status={pd.status} label={statusLabel(pd.status)} /></td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => openWorkspace(designId)}>
                              {pd.status === 'COMPLETED' ? 'View' : 'Workspace'}
                            </ErpButton>
                            {pd.status === 'COMPLETED' && (
                              <>
                                <Link to={`/samples?designId=${designId}&from=pattern`} className="self-center text-[10px] text-[var(--erp-accent)]">Sample →</Link>
                                {canReopen && (
                                  <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => setReopenId(designId)}>Reopen</ErpButton>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {patterns.length === 0 && (
                    <tr>
                      <td colSpan={myWorkOnly ? 5 : 6} className="px-4 py-8 text-center text-[11px] text-erp-text-muted">
                        {tab === 'completed'
                          ? 'No completed pattern developments'
                          : myWorkOnly
                            ? 'No assignments for you — wait for a design manager to assign released designs'
                            : 'No active assignments — release a design and assign a pattern master'}
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
      </div>

      <ConfirmDialog
        open={!!reopenId}
        title="Reopen pattern development"
        message="This resets verification flags and blocks new samples until re-completed. Use when the tech pack or fit feedback requires pattern corrections."
        confirmLabel="Reopen"
        danger
        loading={reopenMutation.isPending}
        onConfirm={() => reopenId && reopenMutation.mutate(reopenId)}
        onCancel={() => setReopenId(null)}
      />
    </div>
  );
}
