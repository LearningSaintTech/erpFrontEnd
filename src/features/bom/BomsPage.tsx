import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, BarChart3, Ban, CheckCircle2, ClipboardCheck, Eye, FileStack, MessageSquareWarning, Pencil, Plus, Snowflake,
} from 'lucide-react';
import { bomApi } from '../../services/manufacturing';
import {
  Badge, Button, ErpDataTable, ErpSelect, ErpTabs, FilterBar, KpiGrid, PageHeader, RowActionsMenu, SearchInput, Section,
  StatTile, StatusBadge, TablePager, Tooltip,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import type { Bom } from '../../types/api';
import { useAuth } from '../../app/providers/AuthProvider';
import './bomTypes';
import { formatCost, isOwnSubmission, skuLabel } from './bomUtils';
import { useBomActions } from './useBomActions';
import { BomDetailDrawer, MrpModal, NewBomDrawer } from './BomOverlays';

const PAGE_SIZE = 20;

type TabId = 'active' | 'draft' | 'all';

export function BomsPage() {
  const { permissions, user } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('bom.create');
  const canUpdate = permissions.includes('*') || permissions.includes('bom.update');
  const canApprove = permissions.includes('*') || permissions.includes('bom.approve');
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<TabId>(canApprove && !canUpdate ? 'all' : 'active');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(canApprove && !canUpdate ? 'PENDING_APPROVAL' : '');
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<{ bom: Bom; edit?: boolean } | null>(null);
  const actions = useBomActions();

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const listParams = useMemo(() => {
    if (tab === 'active') return { status: 'ACTIVE' };
    if (tab === 'draft') return { status: 'DRAFT' };
    return { status: statusFilter || undefined };
  }, [tab, statusFilter]);

  const { data: stats } = useQuery({ queryKey: ['bom-stats'], queryFn: bomApi.stats });

  const list = useQuery({
    queryKey: ['boms', page, listParams, search, tab],
    queryFn: () => bomApi.listPage({ page, limit: PAGE_SIZE, search: search || undefined, ...listParams }),
  });

  const boms = list.data?.items ?? [];
  const meta = list.data?.meta;


  const hasFilters = !!(search || (tab === 'all' && statusFilter));
  const clearFilters = () => { setSearchInput(''); setSearch(''); setStatusFilter(''); setPage(1); };
  const showStatus = (s: string) => {
    if (s === 'ACTIVE') { setTab('active'); setStatusFilter(''); } else if (s === 'DRAFT') { setTab('draft'); setStatusFilter(''); } else { setTab('all'); setStatusFilter((cur) => (cur === s && tab === 'all' ? '' : s)); }
    setPage(1);
  };

  const busy = actions.pending;
  // Drafts, Ready to freeze, Active, Total + optional Awaiting approval / Needs review (Total dropped at 5 to keep the grid even).
  const kpiCount = 4 + (stats?.pendingApproval != null ? 1 : 0) + (stats?.needsReview != null ? 1 : 0);

  const primaryAction = (b: Bom) => {
    const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
    if (canApprove && b.status === 'PENDING_APPROVAL' && !isOwnSubmission(b, user)) {
      return <Button size="sm" variant="secondary" icon={<CheckCircle2 size={14} />} disabled={busy} onClick={stop(() => actions.approve(b))}>Approve</Button>;
    }
    if (canUpdate && b.status === 'DRAFT') {
      return <Button size="sm" variant="secondary" disabled={busy} onClick={stop(() => actions.submit(b))}>Submit</Button>;
    }
    if (canUpdate && b.status === 'APPROVED' && b.isLatestVersion !== false) {
      return <Button size="sm" variant="secondary" icon={<Snowflake size={14} />} disabled={busy} onClick={stop(() => actions.finalize(b))}>Freeze</Button>;
    }
    if (b.status === 'ACTIVE') {
      return <Button size="sm" variant="secondary" icon={<BarChart3 size={14} />} disabled={busy} onClick={stop(() => actions.showMrp(b))}>MRP</Button>;
    }
    return null;
  };

  return (
    <>
      <PageHeader
        title="Bills of materials"
        description="Per-SKU materials and quantities, frozen as the standard cost before production."
        primaryAction={canCreate ? <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>New BOM</Button> : undefined}
      />

      <KpiGrid cols={kpiCount >= 5 ? 6 : 4} className="mb-4">
        <StatTile icon={Pencil} label="Drafts" value={stats?.draft ?? '—'} active={tab === 'draft'} onClick={() => showStatus('DRAFT')} />
        {stats?.pendingApproval != null && (
          <StatTile
            icon={ClipboardCheck}
            label="Awaiting approval"
            value={stats.pendingApproval}
            highlight={canApprove && stats.pendingApproval > 0 ? 'warn' : undefined}
            active={tab === 'all' && statusFilter === 'PENDING_APPROVAL'}
            onClick={() => showStatus('PENDING_APPROVAL')}
          />
        )}
        <StatTile icon={Snowflake} label="Ready to freeze" value={stats?.approved ?? '—'} active={tab === 'all' && statusFilter === 'APPROVED'} onClick={() => showStatus('APPROVED')} />
        <StatTile icon={CheckCircle2} label="Active" value={stats?.active ?? '—'} active={tab === 'active'} onClick={() => showStatus('ACTIVE')} />
        {stats?.needsReview != null && (
          <StatTile icon={AlertTriangle} label="Needs review" value={stats.needsReview} highlight={stats.needsReview > 0 ? 'warn' : undefined} hint="Source pattern reopened" />
        )}
        {kpiCount !== 5 && (
          <StatTile icon={FileStack} label="Total" value={stats?.total ?? '—'} active={tab === 'all' && !statusFilter} onClick={() => { setTab('all'); setStatusFilter(''); setPage(1); }} />
        )}
      </KpiGrid>

      <ErpTabs
        className="mb-3"
        ariaLabel="BOM lists"
        tabs={[
          { id: 'active', label: 'Active', count: stats?.active },
          { id: 'draft', label: 'Draft', count: stats?.draft },
          { id: 'all', label: 'All', count: stats?.total },
        ]}
        active={tab}
        onChange={(id) => { setTab(id as TabId); setPage(1); setStatusFilter(''); }}
      />

      <Section flush>
        <FilterBar
          search={<SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search BOM or SKU…" inputSize="sm" />}
          filters={tab === 'all' ? (
            <ErpSelect inputSize="sm" aria-label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Awaiting approval</option>
              <option value="APPROVED">Approved</option>
              <option value="ACTIVE">Active</option>
              <option value="OBSOLETE">Obsolete</option>
            </ErpSelect>
          ) : undefined}
          onClear={hasFilters ? clearFilters : undefined}
        />
        <QueryState
          skeleton="table"
          skeletonColumns={6}
          isLoading={list.isLoading}
          isError={list.isError}
          error={list.error}
          onRetry={list.refetch}
          isEmpty={!boms.length}
          emptyIcon={FileStack}
          emptyMessage={hasFilters ? 'No BOMs match these filters' : tab === 'active' ? 'No active BOMs yet' : 'No BOMs yet'}
          emptyDescription={hasFilters ? 'Try a different status or search.' : 'Build a BOM for each active SKU, then approve and freeze it.'}
          emptyAction={hasFilters
            ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button>
            : canCreate ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreating(true)}>New BOM</Button> : undefined}
        >
          <ErpDataTable className="min-w-[820px]">
            <thead>
              <tr>
                <th>BOM</th>
                <th>SKU</th>
                <th className="erp-num">Lines</th>
                <th className="erp-num">Std cost / piece</th>
                <th>Status</th>
                <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {boms.map((b: Bom) => (
                <tr key={b._id} className={`erp-row-clickable${selected?.bom._id === b._id ? ' erp-row-selected' : ''}`} onClick={() => setSelected({ bom: b })}>
                  <td>
                    <p className="erp-cell-primary font-mono">{b.bomCode}</p>
                    <p className="text-xs text-erp-text-muted">Version {b.version}{b.isLatestVersion === false ? ' · older' : ''}</p>
                  </td>
                  <td>{skuLabel(b.skuId)}</td>
                  <td className="erp-num">{b.lines?.length ?? 0}</td>
                  <td className="erp-num">{formatCost(b.totalCostPerPiece)}</td>
                  <td>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={b.status} />
                      {b.status === 'ACTIVE' && b.needsReview && (
                        <Tooltip content={b.reviewReason || 'Source pattern was reopened — build and freeze a new version'}>
                          <span><Badge tone="warning" dot>Needs review</Badge></span>
                        </Tooltip>
                      )}
                      {b.status === 'DRAFT' && (b.revisionComments || b.rejectionComments) && (
                        <Tooltip content={b.revisionComments || b.rejectionComments}>
                          <span><Badge tone="warning" dot>{b.revisionComments ? 'Changes requested' : 'Rejected'}</Badge></span>
                        </Tooltip>
                      )}
                    </span>
                  </td>
                  <td className="erp-cell-actions">
                    <div className="flex items-center justify-end gap-1">
                      {primaryAction(b)}
                      <RowActionsMenu
                        label={`More actions for ${b.bomCode}`}
                        items={[
                          { label: 'View details', icon: Eye, onSelect: () => setSelected({ bom: b }) },
                          { label: 'Edit lines', icon: Pencil, hidden: !(canUpdate && b.status === 'DRAFT'), onSelect: () => setSelected({ bom: b, edit: true }) },
                          { label: 'Approve', icon: CheckCircle2, hidden: !(canApprove && b.status === 'DRAFT'), onSelect: () => actions.approve(b) },
                          { type: 'separator', hidden: !(canApprove && b.status === 'PENDING_APPROVAL') },
                          { label: 'Request changes', icon: MessageSquareWarning, hidden: !(canApprove && b.status === 'PENDING_APPROVAL'), onSelect: () => actions.requestChanges(b) },
                          { label: 'Reject', icon: Ban, danger: true, hidden: !(canApprove && b.status === 'PENDING_APPROVAL'), onSelect: () => actions.reject(b) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
          <TablePager
            page={page}
            totalPages={meta?.totalPages ?? 0}
            total={meta?.total ?? 0}
            pageSize={PAGE_SIZE}
            itemLabel="BOMs"
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </QueryState>
      </Section>

      {canCreate && (
        <NewBomDrawer
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(bom) => { setCreating(false); setSelected({ bom }); }}
        />
      )}
      <BomDetailDrawer
        bom={selected?.bom ?? null}
        startEditing={selected?.edit}
        onClose={() => setSelected(null)}
        actions={actions}
        canUpdate={canUpdate}
        canApprove={canApprove}
      />
      <MrpModal view={actions.mrpView} onClose={actions.closeMrp} />
    </>
  );
}
