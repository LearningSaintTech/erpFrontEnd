import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Clock, ExternalLink, Inbox, Layers, User, X,
} from 'lucide-react';
import { approvalApi } from '../../../services/approvals';
import type { ApprovalInstance } from '../../../types/api';
import {
  Badge, Button, EmptyState, ErpSelect, FilterBar, RowActionsMenu, SearchInput, Section,
  Skeleton, TablePager,
} from '../../../components/erp';
import { QueryState } from '../../../components/QueryState';
import { ApprovalDetailDrawer } from '../components/ApprovalDetailDrawer';
import {
  blockedReason, canActOnApproval, documentCode, documentTypeLabel, formatAge, isOverSla,
  submitterName, workflowLevelLabel,
} from '../approvalUtils';
import { useApprovalActions } from '../useApprovalActions';
import { useDebouncedValue } from '../../users/useDebouncedValue';

const PAGE_SIZE = 20;

export function InboxTab({
  canApprove,
  permissions,
  userId,
  documentTypes,
}: {
  canApprove: boolean;
  permissions: string[];
  userId?: string;
  documentTypes: string[];
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
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
  const selected = items.find((i) => i._id === selectedId) ?? null;
  const hasFilters = !!(search || typeFilter);

  const actions = useApprovalActions({ onDone: () => setSelectedId(null) });
  const canAct = (item: ApprovalInstance) => canApprove && canActOnApproval(item, permissions, userId);

  const clear = () => { setSearchInput(''); setTypeFilter(''); setPage(1); };

  return (
    <>
      <Section flush>
        <FilterBar
          search={(
            <SearchInput
              value={searchInput}
              onChange={(v) => { setSearchInput(v); setPage(1); }}
              placeholder="Search by code or title…"
              inputSize="sm"
            />
          )}
          filters={(
            <ErpSelect
              inputSize="sm"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              aria-label="Document type"
            >
              <option value="">All document types</option>
              {documentTypes.map((t) => <option key={t} value={t}>{documentTypeLabel(t)}</option>)}
            </ErpSelect>
          )}
          onClear={hasFilters ? clear : undefined}
        />
        <QueryState
          isLoading={false}
          isError={isError}
          error={error}
          onRetry={refetch}
        >
          {isLoading ? (
            <ul className="divide-y divide-[var(--erp-border)]" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="flex-1 space-y-2"><Skeleton width="30%" /><Skeleton width="55%" /></div>
                  <Skeleton width={80} height={28} />
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            hasFilters ? (
              <EmptyState
                title="No approvals match these filters"
                description="Try a different document type or search term."
                action={<Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="You're all caught up"
                description="Documents submitted for approval appear here."
              />
            )
          ) : (
            <ul className="divide-y divide-[var(--erp-border)]">
              {[...items].sort((x, y) => Number(canAct(y)) - Number(canAct(x))).map((a) => {
                const overSla = isOverSla(a);
                const actionable = canAct(a);
                const isSelected = selectedId === a._id;
                const busy = actions.pendingId === a._id;
                return (
                  <li
                    key={a._id}
                    className={`group flex cursor-pointer flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--erp-row-hover)] sm:flex-row sm:items-center ${isSelected ? 'bg-[var(--erp-row-selected)]' : ''}`}
                    onClick={() => setSelectedId(a._id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="truncate text-left text-sm font-semibold text-erp-text-primary hover:text-[var(--erp-accent)] focus-visible:outline-none focus-visible:underline"
                          onClick={(e) => { e.stopPropagation(); setSelectedId(a._id); }}
                        >
                          {documentCode(a)}
                        </button>
                        <Badge dot={false} tone="neutral">{documentTypeLabel(a.documentType)}</Badge>
                        {overSla && <Badge tone="warning" dot>Over SLA</Badge>}
                      </div>
                      {a.documentSummary?.title && (
                        <p className="mt-0.5 truncate text-[13px] text-erp-text-secondary">
                          {a.documentSummary.title}
                          {a.documentSummary.subtitle && <span className="text-erp-text-muted"> · {a.documentSummary.subtitle}</span>}
                        </p>
                      )}
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-erp-text-muted">
                        <span className="inline-flex items-center gap-1"><User size={12} aria-hidden="true" />{submitterName(a.submittedBy)}</span>
                        <span className={`inline-flex items-center gap-1 ${overSla ? 'font-medium text-[var(--erp-warning-text)]' : ''}`}>
                          <Clock size={12} aria-hidden="true" />{formatAge(a.submittedAt)}
                        </span>
                        <span className="inline-flex items-center gap-1"><Layers size={12} aria-hidden="true" />{workflowLevelLabel(a)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 sm:justify-end" onClick={(e) => e.stopPropagation()}>
                      {actionable ? (
                        <>
                          <Button
                            size="sm"
                            loading={busy}
                            disabled={actions.isPending && !busy}
                            onClick={() => actions.run(a, 'approve')}
                          >
                            {(a.currentLevel ?? 1) > 1 ? `Approve L${a.currentLevel}` : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={actions.isPending}
                            onClick={() => actions.run(a, 'changes')}
                          >
                            Request changes
                          </Button>
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Open document', icon: ExternalLink, hidden: !a.documentSummary?.route,
                                onSelect: () => navigate(a.documentSummary!.route!),
                              },
                              { label: 'View details and history', icon: Layers, onSelect: () => setSelectedId(a._id) },
                              { type: 'separator' },
                              { label: 'Reject…', icon: X, danger: true, onSelect: () => actions.run(a, 'reject') },
                            ]}
                          />
                        </>
                      ) : (
                        <span className="max-w-[16rem] text-xs text-erp-text-muted">{blockedReason(a, userId)}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {meta && (
            <TablePager
              page={page}
              totalPages={meta.totalPages}
              total={meta.total}
              pageSize={PAGE_SIZE}
              itemLabel="pending"
              onPrev={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </QueryState>
      </Section>

      <ApprovalDetailDrawer
        item={selected}
        onClose={() => setSelectedId(null)}
        canAct={selected ? canAct(selected) : false}
        userId={userId}
        onAction={actions.run}
        actionPending={actions.isPending}
      />
    </>
  );
}
