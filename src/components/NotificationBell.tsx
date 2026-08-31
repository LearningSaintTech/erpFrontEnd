import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationApi } from '../services/notifications';
import { eventLabel, isUnread, notificationLink, relativeTime } from '../features/notifications/notificationsUtils';
import { useChat } from '../app/providers/ChatProvider';

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { openChat, canChat } = useChat();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: notificationApi.unreadCount,
    refetchInterval: 120_000,
  });
  const count = data?.count ?? 0;

  const { data: recent = [] } = useQuery({
    queryKey: ['notifications-recent'],
    queryFn: () => notificationApi.recent(8),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-recent'] });
      qc.invalidateQueries({ queryKey: ['notifications-stats'] });
    },
  });

  const markAll = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-recent'] });
      qc.invalidateQueries({ queryKey: ['notifications-stats'] });
    },
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleOpen = (id: string, link: string | null, eventType?: string, referenceType?: string, referenceId?: string) => {
    markRead.mutate(id);
    setOpen(false);
    if (canChat && (eventType === 'chat.message' || referenceType === 'CHAT_ROOM') && referenceId) {
      openChat(referenceId);
      return;
    }
    if (link) navigate(link);
  };

  return (
    <div className="relative flex items-center gap-2" ref={panelRef}>
      <button
        type="button"
        className="erp-icon-btn relative"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--erp-border)] px-3 py-2">
            <span className="text-xs font-semibold">Notifications</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-[10px] text-[var(--erp-accent)] hover:underline"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {recent.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-erp-text-muted">No notifications</li>
            ) : recent.map((n) => {
              const link = notificationLink(n);
              return (
                <li key={n._id}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2.5 text-left hover:bg-[var(--erp-accent-muted)]/20 ${isUnread(n) ? 'bg-[var(--erp-accent-muted)]/10' : ''}`}
                    onClick={() => handleOpen(n._id, link, n.eventType, n.referenceType, n.referenceId)}
                  >
                    <p className="text-xs font-medium leading-snug">{n.title}</p>
                    {n.message && <p className="mt-0.5 line-clamp-2 text-[10px] text-erp-text-muted">{n.message}</p>}
                    <p className="mt-1 text-[10px] text-erp-text-muted">
                      {eventLabel(n.eventType)} · {relativeTime(n.createdAt)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[var(--erp-border)] px-3 py-2 text-center">
            <Link
              to="/notifications"
              className="text-[11px] text-[var(--erp-accent)] hover:underline"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
