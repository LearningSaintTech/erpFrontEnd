import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, BellDot, CalendarDays, CheckCheck, ChevronRight, Inbox,
} from 'lucide-react';
import { notificationApi } from '../../services/notifications';
import type { NotificationItem, ReportDatePreset } from '../../types/api';
import {
  Badge, Button, EmptyState, ErpSelect, FilterBar, IconButton, KpiGrid, PageHeader, SearchInput,
  Section, Skeleton, StatTile, TablePager, Tabs,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { useAuth } from '../../app/providers/AuthProvider';
import { eventLabel, isUnread, notificationLink, relativeTime } from './notificationsUtils';
import { useDebouncedValue } from '../users/useDebouncedValue';
import { PRESET_OPTIONS, presetToRange } from '../dashboard/dashboardUtils';
import { formatDateTime } from '../../utils/format';

const PAGE_SIZE = 20;
type StatusTab = 'all' | 'UNREAD' | 'READ';

export function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canRead = permissions.includes('*') || permissions.includes('notification.read');

  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [eventFilter, setEventFilter] = useState('');
  const [preset, setPreset] = useState<ReportDatePreset>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-stats'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    qc.invalidateQueries({ queryKey: ['notifications-recent'] });
  };

  const { data: stats } = useQuery({
    queryKey: ['notifications-stats'],
    queryFn: () => notificationApi.stats(),
    enabled: canRead,
  });

  const { data: catalog } = useQuery({
    queryKey: ['notifications-catalog'],
    queryFn: () => notificationApi.catalog(),
    enabled: canRead,
  });

  const range = presetToRange(preset);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications', page, statusTab, eventFilter, search, preset],
    queryFn: () => notificationApi.listPage({
      page,
      limit: PAGE_SIZE,
      status: statusTab === 'all' ? undefined : statusTab,
      eventType: eventFilter || undefined,
      search: search || undefined,
      from: range.from,
      to: range.to,
    }),
    enabled: canRead,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: invalidate,
  });

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    meta: { successMessage: 'All notifications marked as read' },
    onSuccess: invalidate,
  });

  const openNotification = (n: NotificationItem) => {
    if (isUnread(n)) markRead.mutate(n._id);
    const link = notificationLink(n);
    if (link) navigate(link);
  };

  const hasFilters = !!(search || eventFilter || preset !== 'all');
  const clear = () => { setSearchInput(''); setEventFilter(''); setPreset('all'); setPage(1); };
  const selectTab = (t: StatusTab) => { setStatusTab(t); setPage(1); };

  if (!canRead) {
    return (
      <div className="space-y-4">
        <PageHeader title="Notifications" description="Your in-app alerts and updates." />
        <Section><EmptyState icon={Bell} title="You don't have access to notifications" description="Ask an administrator for the notification permission." /></Section>
      </div>
    );
  }

  const eventTypes = catalog?.eventTypes ?? [];
  const unread = stats?.unread ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Updates about designs, production, payments and approvals."
        primaryAction={unread > 0 ? (
          <Button size="sm" variant="secondary" icon={<CheckCheck size={16} />} loading={markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all as read
          </Button>
        ) : undefined}
      />

      <KpiGrid cols={4}>
        <StatTile icon={BellDot} label="Unread" value={stats?.unread ?? '—'} onClick={() => selectTab(statusTab === 'UNREAD' ? 'all' : 'UNREAD')} active={statusTab === 'UNREAD'} />
        <StatTile icon={CalendarDays} label="Today" value={stats?.todayCount ?? '—'} />
        <StatTile icon={CheckCheck} label="Read" value={stats?.read ?? '—'} onClick={() => selectTab(statusTab === 'READ' ? 'all' : 'READ')} active={statusTab === 'READ'} />
        <StatTile icon={Inbox} label="Total" value={stats?.total ?? '—'} />
      </KpiGrid>

      <Tabs
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'UNREAD', label: 'Unread', count: stats?.unread ?? null },
          { id: 'READ', label: 'Read' },
        ]}
        active={statusTab}
        onChange={(id) => selectTab(id as StatusTab)}
        ariaLabel="Notification status"
      />

      <Section flush>
        <FilterBar
          search={<SearchInput value={searchInput} onChange={(v) => { setSearchInput(v); setPage(1); }} placeholder="Search title or message…" inputSize="sm" />}
          filters={(
            <>
              <ErpSelect inputSize="sm" value={eventFilter} onChange={(e) => { setEventFilter(e.target.value); setPage(1); }} aria-label="Event type">
                <option value="">All events</option>
                {eventTypes.map((t) => <option key={t} value={t}>{catalog?.eventTypeLabels?.[t] || eventLabel(t)}</option>)}
              </ErpSelect>
              <ErpSelect inputSize="sm" value={preset} onChange={(e) => { setPreset(e.target.value as ReportDatePreset); setPage(1); }} aria-label="Period">
                {PRESET_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </ErpSelect>
            </>
          )}
          onClear={hasFilters ? clear : undefined}
        />
        <QueryState isError={isError} error={error} onRetry={refetch}>
          {isLoading ? (
            <ul className="divide-y divide-[var(--erp-border)]" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="space-y-2 px-4 py-3.5"><Skeleton width="40%" /><Skeleton width="70%" /></li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            hasFilters || statusTab !== 'all' ? (
              <EmptyState
                title={statusTab === 'UNREAD' && !hasFilters ? 'No unread notifications' : 'No notifications match these filters'}
                description={statusTab === 'UNREAD' && !hasFilters ? 'You are all caught up.' : undefined}
                action={hasFilters ? <Button size="sm" variant="secondary" onClick={clear}>Clear filters</Button> : undefined}
              />
            ) : (
              <EmptyState icon={Bell} title="No notifications yet" description="Approvals, revision requests and status changes will show up here." />
            )
          ) : (
            <ul className="divide-y divide-[var(--erp-border)]">
              {items.map((n) => {
                const link = notificationLink(n);
                const unreadItem = isUnread(n);
                return (
                  <li key={n._id} className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--erp-row-hover)] ${unreadItem ? 'bg-[var(--erp-accent-subtle)]' : ''}`}>
                    <span className="mt-1.5 flex h-2 w-2 shrink-0 items-center" aria-hidden="true">
                      {unreadItem && <span className="h-2 w-2 rounded-full bg-[var(--erp-accent)]" />}
                    </span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left focus-visible:outline-none"
                      onClick={() => openNotification(n)}
                      disabled={!link && !unreadItem}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm ${unreadItem ? 'font-semibold text-erp-text-primary' : 'font-medium text-erp-text-secondary'} group-hover:text-[var(--erp-accent)]`}>
                          {n.title}
                        </span>
                        {(() => {
                          const ev = catalog?.eventTypeLabels?.[n.eventType] || eventLabel(n.eventType);
                          return ev.toLowerCase() !== n.title.toLowerCase() ? <Badge tone="neutral" dot={false}>{ev}</Badge> : null;
                        })()}
                        {unreadItem && <span className="sr-only">(unread)</span>}
                      </span>
                      {n.message && <span className="mt-0.5 line-clamp-2 block text-[13px] text-erp-text-muted">{n.message}</span>}
                      <span className="mt-1 block text-xs text-erp-text-muted" title={formatDateTime(n.createdAt)}>{relativeTime(n.createdAt)}</span>
                    </button>
                    <span className="flex shrink-0 items-center gap-1">
                      {unreadItem && (
                        <IconButton aria-label="Mark as read" size="sm" onClick={() => markRead.mutate(n._id)}>
                          <CheckCheck size={16} />
                        </IconButton>
                      )}
                      {link && (
                        <IconButton aria-label="Open" size="sm" onClick={() => openNotification(n)}>
                          <ChevronRight size={16} />
                        </IconButton>
                      )}
                    </span>
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
              itemLabel="notifications"
              onPrev={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </QueryState>
      </Section>
    </div>
  );
}
