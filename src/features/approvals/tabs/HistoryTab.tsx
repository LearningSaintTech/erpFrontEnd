import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { approvalApi } from '../../../services/approvals';
import type { ApprovalInstance } from '../../../types/api';
import {
  ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../../components/erp';
import { documentTypeLabel, formatAge, submitterName } from '../approvalUtils';

const PAGE_SIZE = 20;
const HISTORY_STATUSES = ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'];

export function HistoryTab({ documentTypes }: { documentTypes: string[] }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('APPROVED');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading, isFetching, refetch } = useQuery({
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

  return (
    <div className="space-y-3">
      <ErpCard className="!p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Outcome</label>
            <ErpSelect className="!py-1.5 text-[11px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              {HISTORY_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </ErpSelect>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Type</label>
            <ErpSelect className="!py-1.5 text-[11px]" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              {documentTypes.map((t) => <option key={t} value={t}>{documentTypeLabel(t)}</option>)}
            </ErpSelect>
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Search</label>
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
              <ErpInput
                className="!pl-7 !py-1.5 text-[11px]"
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
          <p className="p-4 text-[11px] text-erp-text-muted">Loading history…</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Submitter</th>
                  <th>Completed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a: ApprovalInstance) => (
                  <tr key={a._id}>
                    <td className="text-[11px] font-medium">
                      {a.documentSummary?.code || `…${String(a.documentId).slice(-8)}`}
                    </td>
                    <td className="text-[11px] text-erp-text-muted">{documentTypeLabel(a.documentType)}</td>
                    <td className="text-[11px]">{submitterName(a.submittedBy)}</td>
                    <td className="text-[11px] text-erp-text-muted">
                      {a.completedAt ? formatAge(a.completedAt) : '—'}
                    </td>
                    <td><ErpStatusBadge status={a.status} /></td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[11px] text-erp-text-muted">
                      No completed approvals for this filter
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
  );
}
