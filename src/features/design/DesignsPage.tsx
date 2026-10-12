import { useEffect, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban, CheckCircle2, ClipboardCheck, Copy, Download, ExternalLink, FilePen, LayoutGrid, List, MessageSquareWarning,
  Plus, Rocket, Ruler, Scissors, Send, Shirt,
} from 'lucide-react';
import { designApi } from '../../services/manufacturing';
import { useAuth } from '../../app/providers/AuthProvider';
import type { Design } from '../../types/api';
import {
  Button, ErpDataTable, ErpSearchSelect, ErpSelect, FilterBar, IconButton, KpiGrid, PageHeader, RowActionsMenu,
  SearchInput, Section, StatTile, StatusBadge, TablePager, Tooltip, type DropdownMenuItem,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import {
  canViewAllDesigns, canEditDesign, canCreateDesign, canShowDesignApproverUi, isDesignAdmin,
  collectionName, designerLabel, DESIGN_STATUSES, formatDesignPrice,
} from './designUtils';
import { getDesignSubmitGaps } from './designFormUtils';
import { downloadCsv } from '../../utils/csvExport';
import { RevisionFeedbackInline, RejectionFeedbackInline } from './RevisionFeedbackBanner';
import { useDesignDecisions } from './useDesignDecisions';
import { hasPermission } from '../../utils/permissions';
import { humanizeStatus } from '../../components/erp';
import { useInventoryCodes } from '../../hooks/useInventoryCodes';
import './designTypes';

const PAGE_SIZE = 20;
const VIEW_KEY = 'erp.designs.view';

type ViewMode = 'table' | 'grid';

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'table';
  } catch {
    return 'table';
  }
}

function DesignThumb({ design, size = 'sm' }: { design: Design; size?: 'sm' | 'lg' }) {
  const [broken, setBroken] = useState(false);
  const url = design.thumbnailUrl;
  if (size === 'lg') {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-[var(--erp-surface-muted)]">
        {url && !broken ? (
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <Shirt size={40} strokeWidth={1.25} className="text-erp-text-muted" aria-hidden />
        )}
      </div>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--erp-border)] bg-[var(--erp-surface-muted)]">
      {url && !broken ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <Shirt size={16} className="text-erp-text-muted" aria-hidden />
      )}
    </span>
  );
}

export function DesignsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, permissions } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;

  const isAdmin = isDesignAdmin(permissions, isSuperAdmin);
  const viewAll = canViewAllDesigns(permissions, isSuperAdmin);
  const canCreate = canCreateDesign(permissions, isSuperAdmin);
  const showApproverActions = canShowDesignApproverUi(permissions, isSuperAdmin);
  const canExport = permissions.includes('*') || permissions.includes('design.export');
  const canPattern = hasPermission(permissions, 'pattern.read', isSuperAdmin);
  const canSample = hasPermission(permissions, 'sampling.read', isSuperAdmin);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>(readView);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const changeView = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage unavailable */ }
  };

  const { data: categoryCodes = [] } = useInventoryCodes('CATEGORY');
  const { data: collectionCodes = [] } = useInventoryCodes('COLLECTION');
  const { data: stats } = useQuery({ queryKey: ['design-stats'], queryFn: designApi.stats });

  const list = useQuery({
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

  const designs = list.data?.items ?? [];
  const meta = list.data?.meta;
  const hasFilters = !!(statusFilter || categoryFilter || collectionFilter || search);

  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setCollectionFilter('');
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const toggleStatus = (status: string) => {
    setStatusFilter((s) => (s === status ? '' : status));
    setPage(1);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['designs-page'] });
    qc.invalidateQueries({ queryKey: ['designs'] });
    qc.invalidateQueries({ queryKey: ['design-stats'] });
    qc.invalidateQueries({ queryKey: ['approvals-pending'] });
    qc.invalidateQueries({ queryKey: ['approvals-stats'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const submitMutation = useMutation({
    mutationFn: (id: string) => designApi.submit(id),
    meta: { successMessage: 'Submitted for review' },
    onSuccess: invalidate,
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => designApi.clone(id),
    meta: { successMessage: 'Design cloned', successDescription: 'Opening the new draft.' },
    onSuccess: (created) => {
      invalidate();
      if (created?._id) navigate(`/designs/${created._id}/edit`);
    },
  });

  const decisions = useDesignDecisions();
  const busy = submitMutation.isPending || cloneMutation.isPending || decisions.pending;

  const exportDesigns = () => {
    downloadCsv('designs.csv', ['Code', 'Title', 'Style #', 'Status', 'Category', 'Collection', 'Target price'], designs.map((d) => [
      d.designCode,
      d.title,
      d.styleNumber ?? '',
      d.status,
      d.category ?? '',
      collectionName(d.collectionId, d.collectionCode),
      d.targetPrice ?? '',
    ]));
  };

  const open = (d: Design) => navigate(`/designs/${d._id}/edit`);
  const stop = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); };

  /** One visible, most-likely next action for the row. */
  const primaryAction = (d: Design) => {
    if (showApproverActions && d.status === 'IN_REVIEW') {
      return (
        <Button size="sm" variant="secondary" icon={<CheckCircle2 size={14} />} disabled={busy} onClick={stop(() => decisions.approve(d))}>
          Approve
        </Button>
      );
    }
    if (showApproverActions && d.status === 'APPROVED') {
      return (
        <Button size="sm" variant="secondary" icon={<Rocket size={14} />} disabled={busy} onClick={stop(() => decisions.openRelease(d))}>
          Release
        </Button>
      );
    }
    if (!isAdmin && d.status === 'DRAFT' && canCreate && canEditDesign(permissions, isSuperAdmin, d.status)) {
      const missingSizes = getDesignSubmitGaps({ hasImage: true, sizeChartData: d.sizeChartData }).sizeRange;
      const btn = (
        <Button
          size="sm"
          variant="secondary"
          icon={<Send size={14} />}
          disabled={busy || missingSizes}
          onClick={stop(() => submitMutation.mutate(d._id))}
        >
          Submit
        </Button>
      );
      return missingSizes ? <Tooltip content="Add a size range before submitting"><span>{btn}</span></Tooltip> : btn;
    }
    if (!isAdmin && d.status === 'REVISION_REQUESTED' && canEditDesign(permissions, isSuperAdmin, d.status)) {
      return (
        <Button size="sm" variant="secondary" icon={<FilePen size={14} />} onClick={stop(() => open(d))}>
          Revise
        </Button>
      );
    }
    if (!isAdmin && d.status === 'REJECTED' && canCreate) {
      return (
        <Button size="sm" variant="secondary" icon={<Copy size={14} />} disabled={busy} onClick={stop(() => cloneMutation.mutate(d._id))}>
          Clone
        </Button>
      );
    }
    return null;
  };

  const menuItems = (d: Design): DropdownMenuItem[] => [
    { label: canEditDesign(permissions, isSuperAdmin, d.status) ? 'Edit' : 'Open', icon: canEditDesign(permissions, isSuperAdmin, d.status) ? FilePen : ExternalLink, onSelect: () => open(d) },
    {
      label: 'Request revision',
      icon: MessageSquareWarning,
      hidden: !(showApproverActions && d.status === 'IN_REVIEW'),
      onSelect: () => decisions.requestRevision(d),
    },
    {
      label: 'Reject',
      icon: Ban,
      danger: true,
      hidden: !(showApproverActions && d.status === 'IN_REVIEW'),
      onSelect: () => decisions.reject(d),
    },
    { type: 'separator', hidden: d.status !== 'RELEASED' || (!canPattern && !canSample) },
    { label: 'Pattern workspace', icon: Ruler, hidden: d.status !== 'RELEASED' || !canPattern, onSelect: () => navigate(`/pattern?designId=${d._id}`) },
    { label: 'Samples', icon: Scissors, hidden: d.status !== 'RELEASED' || !canSample, onSelect: () => navigate(`/samples?designId=${d._id}`) },
  ];

  const kpis = isAdmin
    ? [
      { status: 'IN_REVIEW', label: 'To review', value: stats?.inReview, icon: ClipboardCheck, warn: (stats?.inReview ?? 0) > 0 },
      { status: 'APPROVED', label: 'To release', value: stats?.approved, icon: Rocket },
      { status: 'REVISION_REQUESTED', label: 'With designer', value: stats?.revisionRequested, icon: MessageSquareWarning },
      { status: 'DRAFT', label: 'Drafts', value: stats?.draftOnly ?? stats?.draft, icon: FilePen },
      { status: 'RELEASED', label: 'Released', value: stats?.released, icon: CheckCircle2 },
      { status: 'REJECTED', label: 'Rejected', value: stats?.rejected, icon: Ban },
    ]
    : [
      { status: 'REVISION_REQUESTED', label: 'Needs revision', value: stats?.revisionRequested, icon: MessageSquareWarning, warn: (stats?.revisionRequested ?? 0) > 0 },
      { status: 'DRAFT', label: 'Drafts', value: stats?.draftOnly ?? stats?.draft, icon: FilePen },
      { status: 'IN_REVIEW', label: 'In review', value: stats?.inReview, icon: ClipboardCheck },
      { status: 'APPROVED', label: 'Approved', value: stats?.approved, icon: CheckCircle2 },
      { status: 'RELEASED', label: 'Released', value: stats?.released, icon: Rocket },
      { status: 'REJECTED', label: 'Rejected', value: stats?.rejected, icon: Ban },
    ];

  const newDesignButton = canCreate ? (
    <Button icon={<Plus size={16} />} onClick={() => navigate('/designs/new')}>New design</Button>
  ) : undefined;

  const colSpan = viewAll ? 7 : 6;

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Design library' : 'My designs'}
        description={isAdmin
          ? 'Review submitted tech packs and release approved styles to pattern.'
          : 'Create tech packs for new styles and send them for review.'}
        secondaryActions={canExport && designs.length > 0 ? (
          <Button variant="secondary" icon={<Download size={16} />} onClick={exportDesigns}>Export</Button>
        ) : undefined}
        primaryAction={newDesignButton}
      />

      <KpiGrid cols={6} className="mb-4">
        {kpis.map((k) => (
          <StatTile
            key={k.status}
            icon={k.icon}
            label={k.label}
            value={k.value ?? '—'}
            highlight={k.warn ? 'warn' : undefined}
            active={statusFilter === k.status}
            onClick={() => toggleStatus(k.status)}
          />
        ))}
      </KpiGrid>

      <Section flush>
        <FilterBar
          search={(
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search title, code or style #…"
              inputSize="sm"
            />
          )}
          filters={(
            <>
              <ErpSelect
                inputSize="sm"
                aria-label="Status"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All statuses</option>
                {DESIGN_STATUSES.map((s) => <option key={s} value={s}>{humanizeStatus(s)}</option>)}
              </ErpSelect>
              <ErpSearchSelect
                className="min-w-[170px]"
                value={collectionFilter}
                placeholder="All collections"
                searchPlaceholder="Search collection…"
                allowClear
                options={collectionCodes.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}`, keywords: `${c.code} ${c.name}` }))}
                onChange={(code) => { setCollectionFilter(code); setPage(1); }}
              />
              <ErpSearchSelect
                className="min-w-[170px]"
                value={categoryFilter}
                placeholder="All categories"
                searchPlaceholder="Search category…"
                allowClear
                options={categoryCodes.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}`, keywords: `${c.code} ${c.name}` }))}
                onChange={(code) => { setCategoryFilter(code); setPage(1); }}
              />
            </>
          )}
          onClear={hasFilters ? clearFilters : undefined}
          actions={(
            <div className="flex items-center rounded-md border border-[var(--erp-border)] p-0.5" role="group" aria-label="View">
              <IconButton
                aria-label="Table view"
                size="sm"
                className={view === 'table' ? 'bg-[var(--erp-surface-muted)] text-erp-text-primary' : ''}
                aria-pressed={view === 'table'}
                onClick={() => changeView('table')}
              >
                <List size={16} />
              </IconButton>
              <IconButton
                aria-label="Gallery view"
                size="sm"
                className={view === 'grid' ? 'bg-[var(--erp-surface-muted)] text-erp-text-primary' : ''}
                aria-pressed={view === 'grid'}
                onClick={() => changeView('grid')}
              >
                <LayoutGrid size={16} />
              </IconButton>
            </div>
          )}
        />

        <QueryState
          skeleton="table"
          skeletonColumns={colSpan}
          isLoading={list.isLoading}
          isError={list.isError}
          error={list.error}
          onRetry={list.refetch}
          isEmpty={!designs.length}
          emptyIcon={Shirt}
          emptyMessage={hasFilters ? 'No designs match these filters' : isAdmin ? 'No designs yet' : 'Create your first design'}
          emptyDescription={hasFilters
            ? 'Try a different status, collection or search.'
            : isAdmin
              ? 'Designs appear here once designers create tech packs.'
              : 'A design is the tech pack for one style — images, colours and size range.'}
          emptyAction={hasFilters
            ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button>
            : canCreate ? <Button size="sm" icon={<Plus size={14} />} onClick={() => navigate('/designs/new')}>New design</Button> : undefined}
        >
          {view === 'table' ? (
            <ErpDataTable className="min-w-[860px]">
              <thead>
                <tr>
                  <th>Design</th>
                  <th>Style #</th>
                  <th>Collection</th>
                  {viewAll && <th>Designer</th>}
                  <th className="erp-num">Target price</th>
                  <th>Status</th>
                  <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {designs.map((d) => (
                  <tr key={d._id} className="erp-row-clickable" onClick={() => open(d)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <DesignThumb design={d} />
                        <div className="min-w-0">
                          <p className="erp-cell-primary truncate">{d.title}</p>
                          <p className="font-mono text-xs text-erp-text-muted">{d.designCode}</p>
                          {d.status === 'REVISION_REQUESTED' && d.revisionComments && (
                            <RevisionFeedbackInline comments={d.revisionComments} />
                          )}
                          {d.status === 'REJECTED' && d.rejectionComments && (
                            <RejectionFeedbackInline comments={d.rejectionComments} />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-[13px] text-erp-text-secondary">{d.styleNumber || '—'}</td>
                    <td className="text-erp-text-secondary">{collectionName(d.collectionId, d.collectionCode)}</td>
                    {viewAll && <td>{designerLabel(d.createdBy)}</td>}
                    <td className="erp-num">{formatDesignPrice(d)}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="erp-cell-actions">
                      <div className="flex items-center justify-end gap-1">
                        {primaryAction(d)}
                        <RowActionsMenu items={menuItems(d)} label={`More actions for ${d.designCode}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          ) : (
            <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {designs.map((d) => {
                const action = primaryAction(d);
                return (
                  <li key={d._id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => open(d)}
                      onKeyDown={(e) => { if (e.key === 'Enter') open(d); }}
                      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] shadow-erp-xs transition hover:border-[var(--erp-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--erp-accent)]"
                    >
                      <div className="relative">
                        <DesignThumb design={d} size="lg" />
                        <span className="absolute left-2 top-2"><StatusBadge status={d.status} /></span>
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 p-3">
                        <p className="truncate text-sm font-medium text-erp-text-primary">{d.title}</p>
                        <p className="truncate text-xs text-erp-text-muted">
                          <span className="font-mono">{d.styleNumber || d.designCode}</span>
                          {' · '}
                          {collectionName(d.collectionId, d.collectionCode)}
                        </p>
                        {viewAll && <p className="truncate text-xs text-erp-text-muted">{designerLabel(d.createdBy)}</p>}
                        <div className="mt-auto flex items-center justify-between gap-1 pt-2">
                          <span className="text-[13px] tabular-nums text-erp-text-secondary">{formatDesignPrice(d)}</span>
                          <div className="flex items-center gap-1">
                            {action}
                            <RowActionsMenu items={menuItems(d)} label={`More actions for ${d.designCode}`} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <TablePager
            page={page}
            totalPages={meta?.totalPages ?? 0}
            total={meta?.total ?? 0}
            pageSize={PAGE_SIZE}
            itemLabel="designs"
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </QueryState>
      </Section>

      {showApproverActions && decisions.releaseModal}
    </>
  );
}
