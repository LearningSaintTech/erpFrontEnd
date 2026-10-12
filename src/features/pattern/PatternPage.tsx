import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, ClipboardList, ExternalLink, FileText, Hourglass, RotateCcw, Ruler, Scissors, UserPlus,
} from 'lucide-react';
import { designApi, patternApi } from '../../services/manufacturing';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  Button, ErpDataTable, ErpSelect, ErpTabs, FilterBar, InfoBanner, KpiGrid, PageHeader, RowActionsMenu,
  SearchInput, Section, StatTile, StatusBadge, TablePager, useConfirm,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import type { Design, PatternDevelopment } from '../../types/api';
import { designIdOf, designLabel, masterLabel } from './patternUtils';
import { queueProgress } from './patternWorkflowUtils';
import { patternCapabilities } from './patternPermissions';
import { PatternWorkspace } from './components/PatternWorkspace';
import { AssignPatternDrawer } from './components/AssignPatternDrawer';

const PAGE_SIZE = 20;

type TabId = 'active' | 'completed';

export function PatternPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const { canAssign, canReopen, myWorkOnly } = patternCapabilities(permissions, isSuperAdmin);
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkDesignId = searchParams.get('designId') ?? '';
  const [tab, setTab] = useState<TabId>('active');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDesignId, setAssignDesignId] = useState('');
  const [workspaceDesignId, setWorkspaceDesignId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

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
      if (canAssign) {
        setAssignDesignId(deepLinkDesignId);
        setAssignOpen(true);
      }
    }
  }, [deepLinkDesignId, deepLinkChecked, deepPattern, canAssign]);

  const { data: stats } = useQuery({ queryKey: ['pattern-stats'], queryFn: patternApi.stats });

  // "Active" without a status filter = everything not completed — filtered and paged on the server.
  const activeAll = tab === 'active' && !statusFilter;
  const list = useQuery({
    queryKey: ['pattern-developments', page, activeAll ? 'ASSIGNED,IN_PROGRESS' : listStatus, search, tab, myWorkOnly ? user?._id : ''],
    queryFn: () => patternApi.listPage({
      page,
      limit: PAGE_SIZE,
      status: activeAll ? 'ASSIGNED,IN_PROGRESS' : listStatus,
      search: search || undefined,
      patternMasterId: myWorkOnly ? user?._id : undefined,
    }),
  });

  const patterns = list.data?.items ?? [];
  const meta = list.data?.meta;

  const { data: allPatterns = [] } = useQuery({
    queryKey: ['pattern-developments-all-ids'],
    queryFn: () => patternApi.list(),
    enabled: canAssign,
  });

  const { data: releasedDesigns = [] } = useQuery({
    queryKey: ['designs-released'],
    queryFn: () => designApi.list({ status: 'RELEASED' }),
    enabled: canAssign,
  });

  const assignedDesignIds = new Set(allPatterns.map(designIdOf));
  const unassignedCount = releasedDesigns.filter((d: Design) => !assignedDesignIds.has(d._id)).length;
  const activeCount = (stats?.assigned ?? 0) + (stats?.inProgress ?? 0);

  const reopenMutation = useMutation({
    mutationFn: (designId: string) => patternApi.reopen(designId),
    meta: { successMessage: 'Pattern development reopened' },
    onSuccess: (_, designId) => {
      qc.invalidateQueries({ queryKey: ['pattern-developments'] });
      qc.invalidateQueries({ queryKey: ['pattern-stats'] });
      qc.invalidateQueries({ queryKey: ['pattern-development', designId] });
      openWorkspace(designId);
    },
  });

  const reopen = async (pd: PatternDevelopment) => {
    const ok = await confirm({
      title: `Reopen ${pd.patternDevelopmentCode || 'pattern development'}?`,
      message: 'Sign-offs are cleared and new samples are blocked until the pattern master completes it again. Use this when fit feedback needs pattern corrections.',
      confirmLabel: 'Reopen',
      tone: 'danger',
    });
    if (ok) reopenMutation.mutate(designIdOf(pd));
  };

  const hasFilters = !!(statusFilter || search);
  const clearFilters = () => { setStatusFilter(''); setSearchInput(''); setSearch(''); setPage(1); };
  const setStatus = (s: string) => { setTab('active'); setStatusFilter((cur) => (cur === s ? '' : s)); setPage(1); };

  if (workspaceDesignId) {
    return (
      <PatternWorkspace
        designId={workspaceDesignId}
        onClose={closeWorkspace}
        onCompleted={(id) => navigate(`/samples?designId=${id}&from=pattern`)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Pattern development"
        description={myWorkOnly
          ? 'Designs assigned to you — build the tech pack, marker and grading, then sign off.'
          : 'Turn released designs into production-ready patterns before sampling.'}
        primaryAction={canAssign ? (
          <Button icon={<UserPlus size={16} />} onClick={() => { setAssignDesignId(''); setAssignOpen(true); }}>
            Assign pattern master
          </Button>
        ) : undefined}
      />

      {deepLinkDesignId && deepLinkChecked && !deepPattern && myWorkOnly && (
        <InfoBanner inset={false} tone="warn" className="mb-4">
          This design is not assigned to you yet. A design manager needs to assign it first.
        </InfoBanner>
      )}

      <KpiGrid cols={4} className="mb-4">
        {canAssign ? (
          <StatTile
            icon={Hourglass}
            label="Waiting for assignment"
            value={unassignedCount}
            hint="Released designs"
            highlight={unassignedCount > 0 ? 'warn' : undefined}
            onClick={() => { setAssignDesignId(''); setAssignOpen(true); }}
          />
        ) : (
          <StatTile
            icon={ClipboardList}
            label="My active patterns"
            value={activeCount}
            active={tab === 'active' && !statusFilter}
            onClick={() => { setTab('active'); setStatusFilter(''); setPage(1); }}
          />
        )}
        <StatTile icon={Scissors} label="Not started" value={stats?.assigned ?? '—'} active={tab === 'active' && statusFilter === 'ASSIGNED'} onClick={() => setStatus('ASSIGNED')} />
        <StatTile icon={Ruler} label="In progress" value={stats?.inProgress ?? '—'} active={tab === 'active' && statusFilter === 'IN_PROGRESS'} onClick={() => setStatus('IN_PROGRESS')} />
        <StatTile icon={CheckCircle2} label="Completed" value={stats?.completed ?? '—'} active={tab === 'completed'} onClick={() => { setTab('completed'); setStatusFilter(''); setPage(1); }} />
      </KpiGrid>

      <ErpTabs
        className="mb-3"
        ariaLabel="Pattern queue"
        tabs={[
          { id: 'active', label: 'Active', count: activeCount },
          { id: 'completed', label: 'Completed', count: stats?.completed },
        ]}
        active={tab}
        onChange={(id) => { setTab(id as TabId); setPage(1); setStatusFilter(''); }}
      />

      <Section flush>
        <FilterBar
          search={<SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search design code or title…" inputSize="sm" />}
          filters={tab === 'active' ? (
            <ErpSelect inputSize="sm" aria-label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All active</option>
              <option value="ASSIGNED">Not started</option>
              <option value="IN_PROGRESS">In progress</option>
            </ErpSelect>
          ) : undefined}
          onClear={hasFilters ? clearFilters : undefined}
        />
        <QueryState
          skeleton="table"
          skeletonColumns={myWorkOnly ? 5 : 6}
          isLoading={list.isLoading}
          isError={list.isError}
          error={list.error}
          onRetry={list.refetch}
          isEmpty={!patterns.length}
          emptyIcon={Ruler}
          emptyMessage={hasFilters
            ? 'No patterns match these filters'
            : tab === 'completed'
              ? 'No completed patterns yet'
              : myWorkOnly ? 'Nothing assigned to you' : 'No patterns in progress'}
          emptyDescription={hasFilters
            ? 'Try a different status or search.'
            : myWorkOnly
              ? 'Released designs appear here when a design manager assigns them to you.'
              : 'Release a design, then assign a pattern master to start.'}
          emptyAction={hasFilters
            ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button>
            : canAssign && tab === 'active' ? <Button size="sm" onClick={() => setAssignOpen(true)}>Assign pattern master</Button> : undefined}
        >
          <ErpDataTable className="min-w-[760px]">
            <thead>
              <tr>
                <th>Design</th>
                {!myWorkOnly && <th>Pattern master</th>}
                <th>Progress</th>
                <th>Status</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {patterns.map((pd: PatternDevelopment) => {
                const designId = designIdOf(pd);
                const progress = queueProgress(pd);
                const completed = pd.status === 'COMPLETED';
                return (
                  <tr key={pd._id} className="erp-row-clickable" onClick={() => openWorkspace(designId)}>
                    <td>
                      <p className="erp-cell-primary">{designLabel(pd.designId)}</p>
                      <p className="font-mono text-xs text-erp-text-muted">{pd.patternDevelopmentCode || '—'}</p>
                    </td>
                    {!myWorkOnly && <td>{masterLabel(pd.patternMasterId)}</td>}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--erp-surface-muted)]" aria-hidden>
                          <div className="h-full rounded-full bg-[var(--erp-accent)]" style={{ width: `${progress.percent}%` }} />
                        </div>
                        <span className="text-[13px] text-erp-text-secondary">
                          {completed ? 'Complete' : `Step ${Math.min(progress.done + 1, 4)} of 4 · ${progress.label}`}
                        </span>
                      </div>
                    </td>
                    <td><StatusBadge status={pd.status} label={pd.status === 'ASSIGNED' ? 'Not started' : undefined} /></td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {completed ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => { e.stopPropagation(); navigate(`/samples?designId=${designId}&from=pattern`); }}
                          >
                            Go to sampling
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openWorkspace(designId); }}>
                            {pd.status === 'ASSIGNED' ? 'Start' : 'Continue'}
                          </Button>
                        )}
                        <RowActionsMenu
                          label={`More actions for ${pd.patternDevelopmentCode || 'pattern'}`}
                          items={[
                            { label: 'Open workspace', icon: ExternalLink, onSelect: () => openWorkspace(designId) },
                            { label: 'View design', icon: FileText, onSelect: () => navigate(`/designs/${designId}/edit`) },
                            { type: 'separator', hidden: !(completed && canReopen) },
                            { label: 'Reopen for corrections', icon: RotateCcw, danger: true, hidden: !(completed && canReopen), onSelect: () => reopen(pd) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
          <TablePager
            page={page}
            totalPages={meta?.totalPages ?? 0}
            total={meta?.total ?? 0}
            pageSize={PAGE_SIZE}
            itemLabel="patterns"
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </QueryState>
      </Section>

      {canAssign && (
        <AssignPatternDrawer
          open={assignOpen}
          initialDesignId={assignDesignId}
          onClose={() => { setAssignOpen(false); if (deepLinkDesignId && !deepPattern) setSearchParams({}); }}
          onAssigned={(designId) => { setAssignOpen(false); openWorkspace(designId); }}
        />
      )}
    </>
  );
}
