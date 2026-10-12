import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, ClipboardCheck, FlaskConical, PackageSearch, Plus, Scissors, Shirt,
} from 'lucide-react';
import { sampleApi } from '../../services/manufacturing';
import {
  Button, ErpDataTable, ErpSelect, ErpTabs, FilterBar, InfoBanner, KpiGrid, PageHeader, SearchInput, Section, StatTile,
  StatusBadge, TablePager,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { useAuth } from '../../app/providers/AuthProvider';
import { samplingCapabilities } from './samplingPermissions';
import {
  designIdOf, designLabel, formatCost, sampleTypeLabel, statusLabel, SAMPLE_TYPE_LABELS,
} from './sampleUtils';
import { queueSampleProgress, ALL_SAMPLE_STATUSES } from './sampleWorkflowUtils';
import { sampleActionLabel, sampleWaitingHint } from './sampleNextActions';
import { needsMyActionStatuses } from './samplingRoles';
import { SampleWorkspace } from './components/SampleWorkspace';
import { CreateSampleDrawer } from './components/CreateSampleDrawer';
import type { Sample } from '../../types/api';
import { lowerFirst } from './sampleWorkflowUtils';

const PAGE_SIZE = 20;

type TabId = 'mine' | 'active' | 'approved' | 'all';

export function SamplesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const {
    canCreate, canApprove, canUpdate, myWorkOnly,
  } = samplingCapabilities(permissions, isSuperAdmin);
  const canInventory = permissions.includes('*') || permissions.includes('inventory.update');
  const canQc = permissions.includes('*') || permissions.includes('quality.update');
  const patternMasterScope = myWorkOnly && user?._id ? user._id : undefined;
  const allAccess = isSuperAdmin || permissions.includes('*');

  const myStatuses = useMemo(() => needsMyActionStatuses({
    isSuperAdmin: allAccess, canUpdate, canCreate, canApprove, canInventory, canQc,
  }), [allAccess, canUpdate, canCreate, canApprove, canInventory, canQc]);
  const showMine = !allAccess && myStatuses.length > 0;

  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkSampleId = searchParams.get('sampleId') ?? '';
  const deepLinkDesignId = searchParams.get('designId') ?? '';
  const fromPattern = searchParams.get('from') === 'pattern';

  const [tab, setTab] = useState<TabId>(showMine ? 'mine' : 'active');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [workspaceSampleId, setWorkspaceSampleId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDesignId, setCreateDesignId] = useState('');
  const promptedFor = useRef('');
  const autoSwitched = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // "Designs ready to sample" (dashboard) links here with ?new=1: open the New sample drawer.
  useEffect(() => {
    if (searchParams.get('new') !== '1' || !canCreate) return;
    setCreateDesignId('');
    setCreateOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, canCreate, setSearchParams]);

  const openWorkspace = (sampleId: string) => {
    setWorkspaceSampleId(sampleId);
    setSearchParams({ sampleId });
  };

  const closeWorkspace = () => {
    setWorkspaceSampleId(null);
    if (deepLinkDesignId) setSearchParams({ designId: deepLinkDesignId });
    else setSearchParams({});
  };

  const listParams = useMemo(() => {
    const base = { sampleType: typeFilter || undefined, patternMasterId: patternMasterScope };
    if (tab === 'approved') return { ...base, status: 'APPROVED' };
    if (tab === 'active') return { ...base, excludeTerminal: true, status: statusFilter || undefined };
    return { ...base, status: statusFilter || undefined };
  }, [tab, statusFilter, typeFilter, patternMasterScope]);

  const statsKey = ['sample-stats', patternMasterScope ?? 'all'] as const;
  const { data: stats } = useQuery({
    queryKey: statsKey,
    queryFn: () => sampleApi.stats(patternMasterScope ? { patternMasterId: patternMasterScope } : undefined),
  });

  const list = useQuery({
    queryKey: ['samples', page, listParams, search, tab, patternMasterScope ?? 'all'],
    queryFn: () => sampleApi.listPage({ page, limit: PAGE_SIZE, search: search || undefined, ...listParams }),
    enabled: tab !== 'mine',
  });

  // "Needs my action": active samples filtered to the statuses this user can move forward.
  const mine = useQuery({
    queryKey: ['samples', 'mine', typeFilter, search, patternMasterScope ?? 'all', myStatuses.join(',')],
    queryFn: () => sampleApi.listPage({
      page: 1,
      limit: 200,
      // Filter on the server so the queue isn't limited to the newest active samples.
      status: myStatuses.join(','),
      excludeTerminal: true,
      sampleType: typeFilter || undefined,
      search: search || undefined,
      patternMasterId: patternMasterScope,
    }),
    enabled: showMine,
  });
  const mineRows = useMemo(
    () => (mine.data?.items ?? []).filter((s) => myStatuses.includes(s.status)),
    [mine.data, myStatuses],
  );

  useEffect(() => {
    if (autoSwitched.current || !showMine || !mine.isSuccess) return;
    autoSwitched.current = true;
    if (mineRows.length === 0 && tab === 'mine') setTab('active');
  }, [showMine, mine.isSuccess, mineRows.length, tab]);

  const current = tab === 'mine' ? mine : list;
  const samples: Sample[] = tab === 'mine' ? mineRows : (list.data?.items ?? []);
  const meta = tab === 'mine' ? undefined : list.data?.meta;

  const { data: deepSample, isFetched: deepSampleChecked } = useQuery({
    queryKey: ['sample', deepLinkSampleId],
    queryFn: () => sampleApi.get(deepLinkSampleId),
    enabled: !!deepLinkSampleId,
    retry: false,
  });

  useEffect(() => {
    if (deepLinkSampleId) {
      if (!deepSampleChecked) return;
      setWorkspaceSampleId(deepSample ? deepLinkSampleId : null);
      return;
    }
    if (!deepLinkDesignId) {
      setWorkspaceSampleId(null);
      return;
    }
    const forDesign = samples.filter((s) => designIdOf(s) === deepLinkDesignId);
    const match = forDesign.find((s) => !['APPROVED', 'REJECTED'].includes(s.status)) ?? forDesign[0];
    if (match) {
      setWorkspaceSampleId(match._id);
      setSearchParams({ sampleId: match._id });
    } else if (canCreate && current.isSuccess && promptedFor.current !== deepLinkDesignId) {
      promptedFor.current = deepLinkDesignId;
      setCreateDesignId(deepLinkDesignId);
      setCreateOpen(true);
    }
  }, [deepLinkSampleId, deepLinkDesignId, deepSampleChecked, deepSample, samples, canCreate, current.isSuccess, setSearchParams]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['samples'] });
    qc.invalidateQueries({ queryKey: statsKey });
    qc.invalidateQueries({ queryKey: ['sample-eligible-designs'] });
    qc.invalidateQueries({ queryKey: ['inventory-availability'] });
    qc.invalidateQueries({ queryKey: ['approvals-pending'] });
  };

  if (workspaceSampleId) {
    return <SampleWorkspace sampleId={workspaceSampleId} onClose={closeWorkspace} onUpdated={invalidate} />;
  }

  const hasFilters = !!(statusFilter || typeFilter || search);
  const clearFilters = () => { setStatusFilter(''); setTypeFilter(''); setSearchInput(''); setSearch(''); setPage(1); };
  const filterStatus = (s: string) => {
    setTab('active');
    setStatusFilter((cur) => (cur === s ? '' : s));
    setPage(1);
  };

  const tabs = [
    ...(showMine ? [{ id: 'mine', label: 'Needs my action', count: mine.isSuccess ? (mine.data?.meta?.total ?? mineRows.length) : undefined }] : []),
    { id: 'active', label: 'Active', count: stats?.active },
    { id: 'approved', label: 'Approved', count: stats?.approved },
    { id: 'all', label: 'All', count: stats?.total },
  ];

  const emptyMessage = hasFilters
    ? 'No samples match these filters'
    : tab === 'mine'
      ? 'Nothing waiting on you'
      : tab === 'approved' ? 'No approved samples yet' : 'No samples yet';
  const emptyDescription = hasFilters
    ? 'Try a different status, type or search.'
    : tab === 'mine'
      ? 'Samples that need your action will show up here.'
      : 'Create a sample once a design has completed pattern development.';

  return (
    <>
      <PageHeader
        title="Sampling"
        description={myWorkOnly
          ? 'Samples for designs assigned to you, from materials to buyer approval.'
          : 'Track prototype and fit samples from materials to buyer approval.'}
        primaryAction={canCreate ? (
          <Button icon={<Plus size={16} />} onClick={() => { setCreateDesignId(''); setCreateOpen(true); }}>New sample</Button>
        ) : undefined}
      />

      {fromPattern && deepLinkDesignId && (
        <InfoBanner
          inset={false}
          tone="success"
          className="mb-4"
          title="Pattern development is complete"
          action={canCreate ? <Button size="sm" onClick={() => { setCreateDesignId(deepLinkDesignId); setCreateOpen(true); }}>Create sample</Button> : undefined}
        >
          {canCreate ? 'This design is ready to sample.' : 'A design manager will create the sample. It appears here once created.'}
        </InfoBanner>
      )}

      <KpiGrid cols={6} className="mb-4">
        <StatTile icon={Shirt} label="Active" value={stats?.active ?? '—'} active={tab === 'active' && !statusFilter} onClick={() => { setTab('active'); setStatusFilter(''); setPage(1); }} />
        <StatTile icon={PackageSearch} label="Materials to approve" value={stats?.materialPending ?? '—'} active={statusFilter === 'MATERIAL_REQUEST_PENDING'} onClick={() => filterStatus('MATERIAL_REQUEST_PENDING')} />
        <StatTile icon={Scissors} label="Cutting" value={stats?.inCutting ?? '—'} hint={stats?.inProduction != null ? `${stats.inProduction} in production` : undefined} active={statusFilter === 'CUTTING'} onClick={() => filterStatus('CUTTING')} />
        <StatTile icon={FlaskConical} label="QC pending" value={stats?.qcPending ?? '—'} active={statusFilter === 'QC_PENDING'} onClick={() => filterStatus('QC_PENDING')} />
        <StatTile icon={ClipboardCheck} label="Awaiting sign-off" value={stats?.pendingApproval ?? '—'} highlight={(stats?.pendingApproval ?? 0) > 0 && canApprove ? 'warn' : undefined} active={statusFilter === 'PENDING_APPROVAL'} onClick={() => filterStatus('PENDING_APPROVAL')} />
        <StatTile icon={CheckCircle2} label="Approved" value={stats?.approved ?? '—'} active={tab === 'approved'} onClick={() => { setTab('approved'); setStatusFilter(''); setPage(1); }} />
      </KpiGrid>

      <ErpTabs
        className="mb-3"
        ariaLabel="Sample queues"
        tabs={tabs}
        active={tab}
        onChange={(id) => { setTab(id as TabId); setPage(1); setStatusFilter(''); }}
      />

      <Section flush>
        <FilterBar
          search={<SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search sample or design…" inputSize="sm" />}
          filters={(
            <>
              <ErpSelect inputSize="sm" aria-label="Sample type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                <option value="">All types</option>
                {Object.entries(SAMPLE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </ErpSelect>
              {(tab === 'active' || tab === 'all') && (
                <ErpSelect inputSize="sm" aria-label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All statuses</option>
                  {ALL_SAMPLE_STATUSES.filter((s) => tab === 'all' || !['APPROVED', 'REJECTED'].includes(s)).map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </ErpSelect>
              )}
            </>
          )}
          onClear={hasFilters ? clearFilters : undefined}
        />

        <QueryState
          skeleton="table"
          skeletonColumns={6}
          isLoading={current.isLoading}
          isError={current.isError}
          error={current.error}
          onRetry={current.refetch}
          isEmpty={!samples.length}
          emptyIcon={Shirt}
          emptyMessage={emptyMessage}
          emptyDescription={emptyDescription}
          emptyAction={hasFilters
            ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button>
            : canCreate && tab !== 'mine' ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>New sample</Button> : undefined}
        >
          <ErpDataTable className="min-w-[820px]">
            <thead>
              <tr>
                <th>Sample</th>
                <th>Design</th>
                <th>Progress</th>
                <th>Status</th>
                <th className="erp-num">Sample cost</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => {
                const progress = queueSampleProgress(s.status, s.sampleType);
                const closed = ['APPROVED', 'REJECTED'].includes(s.status);
                const mineToAct = myStatuses.includes(s.status) && !closed;
                return (
                  <tr key={s._id} className="erp-row-clickable" onClick={() => openWorkspace(s._id)}>
                    <td>
                      <p className="erp-cell-primary font-mono">{s.sampleCode}</p>
                      <p className="text-xs text-erp-text-muted">
                        {sampleTypeLabel(s.sampleType)}
                        {s.iteration && s.iteration > 1 ? ` · revision ${s.iteration}` : ''}
                      </p>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="text-left text-[var(--erp-accent)] hover:underline"
                        onClick={(e) => { e.stopPropagation(); navigate(`/designs/${designIdOf(s)}/edit`); }}
                      >
                        {designLabel(s.designId)}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--erp-surface-muted)]" aria-hidden>
                          <div className="h-full rounded-full bg-[var(--erp-accent)]" style={{ width: `${progress.percent}%` }} />
                        </div>
                        <span className="text-[13px] text-erp-text-secondary">{progress.label}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={s.status} label={statusLabel(s.status)} />
                      {!closed && (
                        <p className="mt-0.5 text-xs text-erp-text-muted">
                          {mineToAct ? 'Waiting on you' : `Waiting on ${lowerFirst(sampleWaitingHint(s.status).who)}`}
                        </p>
                      )}
                    </td>
                    <td className="erp-num">{formatCost(s.totalCost)}</td>
                    <td className="erp-cell-actions">
                      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openWorkspace(s._id); }}>
                        {mineToAct ? sampleActionLabel(s.status) : 'Open'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
          {meta && (
            <TablePager
              page={page}
              totalPages={meta.totalPages ?? 0}
              total={meta.total ?? 0}
              pageSize={PAGE_SIZE}
              itemLabel="samples"
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </QueryState>
      </Section>

      {canCreate && (
        <CreateSampleDrawer
          open={createOpen}
          initialDesignId={createDesignId}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => { setCreateOpen(false); invalidate(); openWorkspace(id); }}
        />
      )}
    </>
  );
}
