import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { approvalApi } from '../../../services/approvals';
import {
  Button, EmptyRow, ErpDataTable, ErpSelect, FilterBar, SearchInput, Section, StatusBadge,
  TablePager, TableSkeleton,
} from '../../../components/erp';
import { QueryState } from '../../../components/QueryState';
import { ApprovalDetailDrawer } from '../components/ApprovalDetailDrawer';
import {
  documentCode, documentTypeLabel, formatAge, submitterName,
} from '../approvalUtils';
import { useDebouncedValue } from '../../users/useDebouncedValue';

const PAGE_SIZE = 20;
const HISTORY_STATUSES = [
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'CHANGES_REQUESTED', label: 'Changes requested' },
];

export function HistoryTab({ documentTypes }: { documentTypes: string[] }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('APPROVED');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['approvals-history', page, status, typeFilter, search],
    queryFn: () => approvalApi.list({
      page,
      limit: PAGE_SIZE,
      status,
      documentType: typeFilter || undefined,
      search: search || undefined,
    }),
  });

  const items = data?.items ?? [];
  const meta = data?.meta;
  const selected = items.find((i) => i._id === selectedId) ?? null;
  const hasFilters = !!(typeFilter || search);
  const clear = () => { setTypeFilter(''); setSearchInput(''); setPage(1); };

  return (
    <>
      <Section flush>
        <FilterBar
          search={<SearchInput value={searchInput} onChange={(v) => { setSearchInput(v); setPage(1); }} placeholder="Search by code or title…" inputSize="sm" />}
          filters={(
            <>
              <ErpSelect inputSize="sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Outcome">
                {HISTORY_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </ErpSelect>
              <ErpSelect inputSize="sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} aria-label="Document type">
                <option value="">All document types</option>
                {documentTypes.map((t) => <option key={t} value={t}>{documentTypeLabel(t)}</option>)}
              </ErpSelect>
            </>
          )}
          onClear={hasFilters ? clear : undefined}
        />
        <QueryState isError={isError} error={error} onRetry={refetch}>
          <ErpDataTable>
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Submitter</th>
                <th>Completed</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton asRows rows={6} columns={5} />
              ) : items.length === 0 ? (
                <EmptyRow
                  colSpan={5}
                  icon={History}
                  title={hasFilters ? 'No decisions match these filters' : 'No decisions with this outcome yet'}
                  action={hasFilters ? <Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button> : undefined}
                >
                  {hasFilters ? undefined : 'Completed approvals are kept here for reference.'}
                </EmptyRow>
              ) : items.map((a) => (
                <tr
                  key={a._id}
                  className={`erp-row-clickable${selectedId === a._id ? ' erp-row-selected' : ''}`}
                  onClick={() => setSelectedId(a._id)}
                >
                  <td>
                    <span className="erp-cell-primary block">{documentCode(a)}</span>
                    {a.documentSummary?.title && <span className="block max-w-[18rem] truncate text-xs text-erp-text-muted">{a.documentSummary.title}</span>}
                  </td>
                  <td className="text-erp-text-secondary">{documentTypeLabel(a.documentType)}</td>
                  <td>{submitterName(a.submittedBy)}</td>
                  <td className="whitespace-nowrap text-erp-text-muted" title={a.completedAt ? new Date(a.completedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : undefined}>
                    {a.completedAt ? formatAge(a.completedAt) : '—'}
                  </td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
          {meta && (
            <TablePager
              page={page}
              totalPages={meta.totalPages}
              total={meta.total}
              pageSize={PAGE_SIZE}
              itemLabel="decisions"
              onPrev={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </QueryState>
      </Section>
      <ApprovalDetailDrawer item={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}
