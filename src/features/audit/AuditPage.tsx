import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ScrollText } from 'lucide-react';
import { auditApi, type AuditLogFilters } from '../../services/admin';
import type { AuditLogEntry } from '../../types/api';
import {
  Badge, Button, DescriptionList, Drawer, EmptyRow, ErpDataTable, ErpInput, ErpSelect, FilterBar,
  PageHeader, SearchInput, Section, TablePager, TableSkeleton,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import {
  AUDIT_ACTION_TYPES, auditPath, describeAction, exportAuditCsv, formatTimestamp, isoDay, methodBadgeTone,
  moduleName, parseAction, relativeTime,
} from './auditUtils';
import { useDebouncedValue } from '../users/useDebouncedValue';

const PAGE_SIZE = 25;

type RangePreset = 'all' | 'today' | 'last7' | 'last30' | 'custom';
const RANGE_OPTIONS: { id: RangePreset; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'custom', label: 'Custom range' },
];

function rangeDates(preset: RangePreset, from: string, to: string) {
  const today = new Date();
  const daysAgo = (n: number) => isoDay(new Date(today.getTime() - n * 86_400_000));
  switch (preset) {
    case 'today': return { from: isoDay(today), to: isoDay(today) };
    case 'last7': return { from: daysAgo(6), to: isoDay(today) };
    case 'last30': return { from: daysAgo(29), to: isoDay(today) };
    case 'custom': return { from: from || undefined, to: to || undefined };
    default: return { from: undefined, to: undefined };
  }
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-md border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] p-3 font-mono text-xs leading-relaxed text-erp-text-secondary">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function AuditDetailDrawer({ log, onClose }: { log: AuditLogEntry | null; onClose: () => void }) {
  const parsed = parseAction(log?.action);
  const extraMeta = log?.metadata
    ? Object.fromEntries(Object.entries(log.metadata).filter(([k]) => !['path', 'ipAddress', 'userAgent', 'method'].includes(k)))
    : {};
  return (
    <Drawer
      open={!!log}
      onClose={onClose}
      size="md"
      title={log ? describeAction(log.action, log.metadata?.path) : ''}
      description={log ? `${formatTimestamp(log.timestamp)} · ${relativeTime(log.timestamp)}` : undefined}
      headerExtra={log ? <Badge tone={methodBadgeTone(parsed.method)} dot={false}>{parsed.method}</Badge> : undefined}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {log && (
        <div className="space-y-6">
          <DescriptionList
            columns={2}
            items={[
              { label: 'User', value: log.userEmail },
              { label: 'Module', value: moduleName(log.module) },
              { label: 'Record type', value: log.documentType ? moduleName(log.documentType) : undefined },
              { label: 'Record ID', value: log.documentId ? <span className="font-mono text-xs">{log.documentId}</span> : undefined },
              { label: 'Endpoint', value: <span className="break-all font-mono text-xs">{parsed.method} {auditPath(log)}</span>, full: true },
              { label: 'IP address', value: log.metadata?.ipAddress ? <span className="font-mono text-xs">{log.metadata.ipAddress}</span> : undefined },
              { label: 'Device', value: log.metadata?.userAgent ? <span className="line-clamp-3 text-xs">{log.metadata.userAgent}</span> : undefined, full: true },
            ]}
          />
          {(log.previousData != null || log.updatedData != null) && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-erp-text-primary">Data changes</h3>
              <div className="grid gap-3">
                {log.previousData != null && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-erp-text-muted">Before</p>
                    <JsonBlock value={log.previousData} />
                  </div>
                )}
                {log.updatedData != null && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-erp-text-muted">After</p>
                    <JsonBlock value={log.updatedData} />
                  </div>
                )}
              </div>
            </section>
          )}
          {Object.keys(extraMeta).length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-erp-text-primary">Other details</h3>
              <JsonBlock value={extraMeta} />
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userInput, setUserInput] = useState('');
  const userFilter = useDebouncedValue(userInput.trim());
  const [range, setRange] = useState<RangePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dates = rangeDates(range, customFrom, customTo);
  const filters: AuditLogFilters = {
    page,
    limit: PAGE_SIZE,
    module: moduleFilter || undefined,
    action: actionFilter || undefined,
    userEmail: userFilter || undefined,
    from: dates.from,
    to: dates.to,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditApi.list(filters),
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['audit-modules'],
    queryFn: auditApi.listModules,
  });

  const logs = data?.items ?? [];
  const meta = data?.meta;
  const selected = logs.find((l) => l._id === selectedId) ?? null;

  const hasActiveFilters = !!(moduleFilter || actionFilter || userFilter || range !== 'all');
  const clearFilters = () => {
    setModuleFilter(''); setActionFilter(''); setUserInput(''); setRange('all'); setCustomFrom(''); setCustomTo(''); setPage(1);
  };
  const resetPage = () => setPage(1);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        description="Every change made in the system: who did what, and when."
        secondaryActions={(
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={16} />}
            onClick={() => exportAuditCsv(logs)}
            disabled={logs.length === 0}
            title="Exports the entries on this page"
          >
            Export CSV
          </Button>
        )}
      />

      <Section flush>
        <FilterBar
          search={<SearchInput value={userInput} onChange={(v) => { setUserInput(v); resetPage(); }} placeholder="Filter by user email…" inputSize="sm" />}
          filters={(
            <>
              <ErpSelect inputSize="sm" value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); resetPage(); }} aria-label="Module">
                <option value="">All modules</option>
                {modules.map((m) => <option key={m} value={m}>{moduleName(m)}</option>)}
              </ErpSelect>
              <ErpSelect inputSize="sm" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); resetPage(); }} aria-label="Action">
                {AUDIT_ACTION_TYPES.map((a) => <option key={a.id || 'all'} value={a.id}>{a.label}</option>)}
              </ErpSelect>
              <ErpSelect inputSize="sm" value={range} onChange={(e) => { setRange(e.target.value as RangePreset); resetPage(); }} aria-label="Date range">
                {RANGE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </ErpSelect>
              {range === 'custom' && (
                <span className="flex items-center gap-1.5">
                  <ErpInput inputSize="sm" type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); resetPage(); }} aria-label="From date" />
                  <span className="text-xs text-erp-text-muted">to</span>
                  <ErpInput inputSize="sm" type="date" value={customTo} min={customFrom || undefined} onChange={(e) => { setCustomTo(e.target.value); resetPage(); }} aria-label="To date" />
                </span>
              )}
            </>
          )}
          onClear={hasActiveFilters ? clearFilters : undefined}
        />
        <QueryState isError={isError} error={error} onRetry={refetch}>
          <ErpDataTable>
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th className="hidden lg:table-cell">Endpoint</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton asRows rows={8} columns={5} />
              ) : logs.length === 0 ? (
                <EmptyRow
                  colSpan={5}
                  icon={ScrollText}
                  title={hasActiveFilters ? 'No entries match these filters' : 'No activity recorded yet'}
                  action={hasActiveFilters ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button> : undefined}
                >
                  {hasActiveFilters ? undefined : 'Entries appear as soon as someone creates or changes a record.'}
                </EmptyRow>
              ) : logs.map((log) => {
                const { method } = parseAction(log.action);
                return (
                  <tr
                    key={log._id}
                    className={`erp-row-clickable${selectedId === log._id ? ' erp-row-selected' : ''}`}
                    onClick={() => setSelectedId(log._id)}
                  >
                    <td className="whitespace-nowrap" title={formatTimestamp(log.timestamp)}>
                      <span className="block text-erp-text-primary">{relativeTime(log.timestamp)}</span>
                      <span className="block text-xs text-erp-text-muted">{formatTimestamp(log.timestamp)}</span>
                    </td>
                    <td className="max-w-[14rem] truncate" title={log.userEmail}>{log.userEmail || '—'}</td>
                    <td className="max-w-[20rem]">
                      <span className="flex items-center gap-2">
                        <Badge tone={methodBadgeTone(method)} dot={false} className="shrink-0 font-mono">{method}</Badge>
                        <span className="erp-cell-primary truncate">{describeAction(log.action, log.metadata?.path)}</span>
                      </span>
                    </td>
                    <td className="text-erp-text-secondary">{moduleName(log.module)}</td>
                    <td className="hidden max-w-[16rem] truncate font-mono text-xs text-erp-text-muted lg:table-cell" title={auditPath(log)}>
                      {auditPath(log)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
          {meta && (
            <TablePager
              page={page}
              totalPages={meta.totalPages}
              total={meta.total}
              pageSize={PAGE_SIZE}
              itemLabel="entries"
              onPrev={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </QueryState>
      </Section>

      <AuditDetailDrawer log={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
