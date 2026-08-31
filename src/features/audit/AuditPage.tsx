import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, RefreshCw, Search } from 'lucide-react';
import { auditApi, type AuditLogFilters } from '../../services/admin';
import type { AuditLogEntry } from '../../types/api';
import {
  ErpPageHeader, ErpDataTable, ErpButton, ErpInput, ErpSelect, ErpCard,
} from '../../components/erp';
import {
  auditPath, exportAuditCsv, formatTimestamp, methodTone, parseAction, relativeTime,
} from './auditUtils';

const PAGE_SIZE = 25;

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`font-mono text-[10px] font-semibold leading-none ${methodTone(method)}`}>
      {method}
    </span>
  );
}

function AuditDetailPanel({ log }: { log: AuditLogEntry }) {
  const { method, path } = parseAction(log.action);
  const hasDiff = log.previousData != null || log.updatedData != null;

  return (
    <div className="grid gap-2 border-t border-[var(--erp-border)] bg-[var(--erp-surface-muted)] px-3 py-2 text-[11px] leading-snug md:grid-cols-2">
      <div className="space-y-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Request</h4>
        <dl className="space-y-0.5">
          <div className="flex gap-1.5">
            <dt className="w-16 shrink-0 text-erp-text-muted">Method</dt>
            <dd><MethodBadge method={method} /></dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="w-16 shrink-0 text-erp-text-muted">Path</dt>
            <dd className="break-all font-mono text-[10px]">{log.metadata?.path || path || '—'}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="w-16 shrink-0 text-erp-text-muted">Module</dt>
            <dd>{log.module || '—'}</dd>
          </div>
          {log.documentType && (
            <div className="flex gap-1.5">
              <dt className="w-16 shrink-0 text-erp-text-muted">Document</dt>
              <dd>{log.documentType}{log.documentId ? ` · ${String(log.documentId).slice(-8)}` : ''}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="space-y-1">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Actor & context</h4>
        <dl className="space-y-0.5">
          <div className="flex gap-1.5">
            <dt className="w-16 shrink-0 text-erp-text-muted">User</dt>
            <dd className="truncate">{log.userEmail || '—'}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="w-16 shrink-0 text-erp-text-muted">IP</dt>
            <dd className="font-mono text-[10px]">{log.metadata?.ipAddress || '—'}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="w-16 shrink-0 text-erp-text-muted">When</dt>
            <dd title={formatTimestamp(log.timestamp)}>{formatTimestamp(log.timestamp)}</dd>
          </div>
          {log.metadata?.userAgent && (
            <div className="flex gap-1.5">
              <dt className="w-16 shrink-0 text-erp-text-muted">Agent</dt>
              <dd className="line-clamp-2 text-[10px] text-erp-text-muted">{log.metadata.userAgent}</dd>
            </div>
          )}
        </dl>
      </div>
      {hasDiff && (
        <div className="md:col-span-2">
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Data changes</h4>
          <div className="grid gap-2 lg:grid-cols-2">
            {log.previousData != null && (
              <pre className="max-h-32 overflow-auto rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] p-2 font-mono text-[10px] leading-tight">
                {JSON.stringify(log.previousData, null, 2)}
              </pre>
            )}
            {log.updatedData != null && (
              <pre className="max-h-32 overflow-auto rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] p-2 font-mono text-[10px] leading-tight">
                {JSON.stringify(log.updatedData, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ action: '', user: '', from: '', to: '' });

  const filters: AuditLogFilters = {
    page,
    limit: PAGE_SIZE,
    module: moduleFilter || undefined,
    action: actionFilter || undefined,
    userEmail: userFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditApi.list(filters),
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['audit-modules'],
    queryFn: auditApi.listModules,
  });

  const logs = data?.items ?? [];
  const meta = data?.meta;

  const summary = useMemo(() => {
    const methods = logs.reduce<Record<string, number>>((acc, log) => {
      const m = parseAction(log.action).method;
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {});
    const topModule = logs.reduce<Record<string, number>>((acc, log) => {
      const mod = log.module || 'unknown';
      acc[mod] = (acc[mod] || 0) + 1;
      return acc;
    }, {});
    const topModuleName = Object.entries(topModule).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { methods, topModuleName };
  }, [logs]);

  const applyFilters = () => {
    setActionFilter(draft.action.trim());
    setUserFilter(draft.user.trim());
    setFromDate(draft.from);
    setToDate(draft.to);
    setPage(1);
    setExpandedId(null);
  };

  const clearFilters = () => {
    setModuleFilter('');
    setActionFilter('');
    setUserFilter('');
    setFromDate('');
    setToDate('');
    setDraft({ action: '', user: '', from: '', to: '' });
    setPage(1);
    setExpandedId(null);
  };

  const hasActiveFilters = moduleFilter || actionFilter || userFilter || fromDate || toDate;

  return (
    <div className="audit-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px] [&_.erp-page-subtitle]:mt-0">
      <ErpPageHeader
        title="Audit Logs"
        subtitle="Mutation trail — who, what, when."
        actions={(
          <>
            <ErpButton
              variant="secondary"
              onClick={() => refetch()}
              disabled={isFetching}
              className="!px-2 !py-1 text-[11px] inline-flex items-center gap-1"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </ErpButton>
            <ErpButton
              variant="secondary"
              onClick={() => exportAuditCsv(logs)}
              disabled={logs.length === 0}
              className="!px-2 !py-1 text-[11px] inline-flex items-center gap-1"
            >
              <Download size={12} />
              Export
            </ErpButton>
          </>
        )}
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <ErpCard className="!p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Total</p>
          <p className="mt-0.5 text-lg font-semibold leading-tight text-erp-text-primary">{meta?.total ?? '—'}</p>
        </ErpCard>
        <ErpCard className="!p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">This page</p>
          <p className="mt-0.5 text-lg font-semibold leading-tight text-erp-text-primary">
            {summary.methods.POST ?? 0}
            <span className="ml-1 text-[10px] font-normal text-erp-text-muted">POST</span>
            <span className="mx-1 text-erp-text-muted">·</span>
            {(summary.methods.PUT ?? 0) + (summary.methods.PATCH ?? 0)}
            <span className="ml-1 text-[10px] font-normal text-erp-text-muted">upd</span>
          </p>
        </ErpCard>
        <ErpCard className="!p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Top module</p>
          <p className="mt-0.5 truncate text-lg font-semibold leading-tight text-erp-text-primary">
            {summary.topModuleName || '—'}
          </p>
        </ErpCard>
      </div>

      <ErpCard className="mb-3 !p-2.5">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-erp-text-secondary">
          <Search size={12} />
          Filters
        </div>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
          <label className="block text-[11px]">
            <span className="mb-0.5 block text-[10px] text-erp-text-muted">Module</span>
            <ErpSelect
              value={moduleFilter}
              onChange={(e) => { setModuleFilter(e.target.value); setPage(1); setExpandedId(null); }}
              className="!py-1 !text-[11px] w-full"
            >
              <option value="">All modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </ErpSelect>
          </label>
          <label className="block text-[11px]">
            <span className="mb-0.5 block text-[10px] text-erp-text-muted">Action</span>
            <ErpInput
              value={draft.action}
              onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
              placeholder="approve, POST…"
              className="!py-1 !text-[11px] w-full"
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
          </label>
          <label className="block text-[11px]">
            <span className="mb-0.5 block text-[10px] text-erp-text-muted">User</span>
            <ErpInput
              value={draft.user}
              onChange={(e) => setDraft((d) => ({ ...d, user: e.target.value }))}
              placeholder="email"
              className="!py-1 !text-[11px] w-full"
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
          </label>
          <label className="block text-[11px]">
            <span className="mb-0.5 block text-[10px] text-erp-text-muted">From</span>
            <ErpInput
              type="date"
              value={draft.from}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
              className="!py-1 !text-[11px] w-full"
            />
          </label>
          <label className="block text-[11px]">
            <span className="mb-0.5 block text-[10px] text-erp-text-muted">To</span>
            <ErpInput
              type="date"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              className="!py-1 !text-[11px] w-full"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <ErpButton onClick={applyFilters} className="!px-2 !py-1 text-[11px]">Apply</ErpButton>
          {hasActiveFilters && (
            <ErpButton variant="secondary" onClick={clearFilters} className="!px-2 !py-1 text-[11px]">Clear</ErpButton>
          )}
        </div>
      </ErpCard>

      {error && (
        <p className="erp-alert-error mb-2 text-[11px]">{(error as Error).message}</p>
      )}

      {isLoading ? (
        <p className="text-[11px] text-erp-text-muted">Loading…</p>
      ) : (
        <ErpCard className="overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <ErpDataTable className="text-[11px]">
              <thead>
                <tr>
                  <th className="w-6 px-1 py-1.5" aria-label="Expand" />
                  <th className="px-2 py-1.5 font-medium">When</th>
                  <th className="px-2 py-1.5 font-medium">User</th>
                  <th className="px-2 py-1.5 font-medium">Module</th>
                  <th className="px-2 py-1.5 font-medium">Action</th>
                  <th className="hidden px-2 py-1.5 font-medium lg:table-cell">Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const { method, label } = parseAction(log.action);
                  const expanded = expandedId === log._id;
                  return (
                    <Fragment key={log._id}>
                      <tr
                        className="cursor-pointer border-b border-[var(--erp-border)] hover:bg-[var(--erp-surface-muted)]"
                        onClick={() => setExpandedId(expanded ? null : log._id)}
                      >
                        <td className="px-1 py-1 text-erp-text-muted">
                          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1" title={formatTimestamp(log.timestamp)}>
                          <span className="text-erp-text-primary">{relativeTime(log.timestamp)}</span>
                          <span className="ml-1 text-[10px] text-erp-text-muted">{formatTimestamp(log.timestamp)}</span>
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-1" title={log.userEmail}>
                          {log.userEmail || '—'}
                        </td>
                        <td className="px-2 py-1">
                          <span className="rounded bg-[var(--erp-surface-muted)] px-1 py-px font-mono text-[10px]">
                            {log.module || '—'}
                          </span>
                        </td>
                        <td className="max-w-[10rem] px-2 py-1">
                          <div className="flex items-center gap-1">
                            <MethodBadge method={method} />
                            <span className="truncate text-[10px] text-erp-text-secondary" title={label}>
                              {label.replace(`${method} `, '')}
                            </span>
                          </div>
                        </td>
                        <td className="hidden max-w-[12rem] truncate px-2 py-1 font-mono text-[10px] text-erp-text-muted lg:table-cell" title={auditPath(log)}>
                          {auditPath(log)}
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <AuditDetailPanel log={log} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-[11px] text-erp-text-muted">
                      {hasActiveFilters
                        ? 'No audit entries match your filters.'
                        : 'No audit entries yet. Activity appears when users create or update records.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </ErpDataTable>
          </div>

          {meta && meta.totalPages > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--erp-border)] px-2 py-1.5 text-[11px]">
              <p className="text-erp-text-muted">
                {meta.page}/{meta.totalPages} · {meta.total} total
              </p>
              <div className="flex gap-1">
                <ErpButton
                  variant="secondary"
                  disabled={page <= 1}
                  className="!px-2 !py-1 text-[11px]"
                  onClick={() => { setPage((p) => p - 1); setExpandedId(null); }}
                >
                  Prev
                </ErpButton>
                <ErpButton
                  variant="secondary"
                  disabled={page >= meta.totalPages}
                  className="!px-2 !py-1 text-[11px]"
                  onClick={() => { setPage((p) => p + 1); setExpandedId(null); }}
                >
                  Next
                </ErpButton>
              </div>
            </div>
          )}
        </ErpCard>
      )}
    </div>
  );
}
