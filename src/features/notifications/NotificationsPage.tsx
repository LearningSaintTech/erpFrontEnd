import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, RefreshCw, Search } from 'lucide-react';
import { notificationApi } from '../../services/notifications';
import type { NotificationItem } from '../../types/api';
import {
  ErpPageHeader, ErpButton, ErpCard, ErpDataTable, ErpInput, ErpSelect, ErpStatusBadge,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
import { useAuth } from '../../app/providers/AuthProvider';
import { eventLabel, isUnread, notificationLink, relativeTime, statusLabel } from './notificationsUtils';

const PAGE_SIZE = 20;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';
const btnSm = '!px-2 !py-1 text-[10px]';

export function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canRead = permissions.includes('*') || permissions.includes('notification.read');

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

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

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['notifications', page, statusFilter, eventFilter, search],
    queryFn: () => notificationApi.listPage({
      page,
      limit: PAGE_SIZE,
      status: statusFilter || undefined,
      eventType: eventFilter || undefined,
      search: search || undefined,
    }),
    enabled: canRead,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => { invalidate(); },
    onError: (e: Error) => setError(e.message),
  });

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      showSuccess('All notifications marked as read');
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const openNotification = (n: NotificationItem) => {
    if (isUnread(n)) markRead.mutate(n._id);
    const link = notificationLink(n);
    if (link) navigate(link);
  };

  if (!canRead) {
    return (
      <div>
        <ErpPageHeader title="Notifications" subtitle="Your in-app alerts and updates" />
        <p className="text-sm text-erp-text-muted">You do not have permission to view notifications.</p>
      </div>
    );
  }

  const eventTypes = catalog?.eventTypes ?? [];

  return (
    <div>
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Notifications"
        subtitle="Design, production, purchase, and approval updates"
        actions={(
          <div className="flex gap-2">
            <ErpButton variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </ErpButton>
            {(stats?.unread ?? 0) > 0 && (
              <ErpButton variant="secondary" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
                <CheckCheck className="mr-1 inline h-3.5 w-3.5" />
                Mark all read
              </ErpButton>
            )}
          </div>
        )}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Unread</span>
          <p className="mt-1 text-lg font-semibold">{stats?.unread ?? '—'}</p>
        </ErpCard>
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Read</span>
          <p className="mt-1 text-lg font-semibold">{stats?.read ?? '—'}</p>
        </ErpCard>
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Today</span>
          <p className="mt-1 text-lg font-semibold">{stats?.todayCount ?? '—'}</p>
        </ErpCard>
        <ErpCard className="p-3">
          <span className="text-[10px] text-erp-text-muted">Total</span>
          <p className="mt-1 text-lg font-semibold">{stats?.total ?? '—'}</p>
        </ErpCard>
      </div>

      <ErpCard className="p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <span className={fieldLabel}>Search</span>
            <div className="flex gap-2">
              <ErpInput
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Title or message…"
                onKeyDown={(e) => e.key === 'Enter' && (setSearch(searchInput), setPage(1))}
              />
              <ErpButton variant="secondary" onClick={() => { setSearch(searchInput); setPage(1); }}>
                <Search className="h-3.5 w-3.5" />
              </ErpButton>
            </div>
          </div>
          <label>
            <span className={fieldLabel}>Status</span>
            <ErpSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="UNREAD">Unread</option>
              <option value="READ">Read</option>
            </ErpSelect>
          </label>
          <label>
            <span className={fieldLabel}>Event type</span>
            <ErpSelect value={eventFilter} onChange={(e) => { setEventFilter(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>{catalog?.eventTypeLabels?.[t] || eventLabel(t)}</option>
              ))}
            </ErpSelect>
          </label>
        </div>

        <ErpDataTable>
          <thead>
            <tr>
              <th>Notification</th>
              <th>Event</th>
              <th>When</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="py-8 text-center text-erp-text-muted">Loading…</td></tr>
            ) : items.map((n) => {
              const link = notificationLink(n);
              return (
                <tr
                  key={n._id}
                  className={isUnread(n) ? 'bg-[var(--erp-accent-muted)]/30' : undefined}
                >
                  <td>
                    <button
                      type="button"
                      className={`text-left ${link ? 'hover:text-[var(--erp-accent)]' : ''}`}
                      onClick={() => openNotification(n)}
                    >
                      <p className="font-medium text-sm">{n.title}</p>
                      {n.message && <p className="mt-0.5 text-xs text-erp-text-muted line-clamp-2">{n.message}</p>}
                    </button>
                  </td>
                  <td className="text-xs text-erp-text-muted">{eventLabel(n.eventType)}</td>
                  <td className="text-xs text-erp-text-muted" title={new Date(n.createdAt).toLocaleString()}>
                    {relativeTime(n.createdAt)}
                  </td>
                  <td>
                    <ErpStatusBadge status={n.status} label={statusLabel(n.status)} />
                  </td>
                  <td className="text-right">
                    {isUnread(n) && (
                      <ErpButton variant="secondary" className={btnSm} onClick={() => markRead.mutate(n._id)}>
                        Mark read
                      </ErpButton>
                    )}
                    {link && (
                      <ErpButton variant="secondary" className={`${btnSm} ml-1`} onClick={() => openNotification(n)}>
                        Open
                      </ErpButton>
                    )}
                  </td>
                </tr>
              );
            })}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <Bell className="mx-auto mb-2 h-8 w-8 text-erp-text-muted opacity-50" />
                  <p className="text-erp-text-muted">No notifications yet</p>
                </td>
              </tr>
            )}
          </tbody>
        </ErpDataTable>

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-erp-text-muted">
            <span>Page {meta.page} of {meta.totalPages}</span>
            <div className="flex gap-2">
              <ErpButton variant="secondary" className={btnSm} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</ErpButton>
              <ErpButton variant="secondary" className={btnSm} disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
            </div>
          </div>
        )}
      </ErpCard>

      <p className="mt-4 text-center text-xs text-erp-text-muted">
        <Link to="/approvals" className="text-[var(--erp-accent)] hover:underline">View pending approvals</Link>
      </p>
    </div>
  );
}
