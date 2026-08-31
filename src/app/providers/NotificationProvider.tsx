import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';
import { hasPermission } from '../../utils/permissions';
import { connectChatSocket, getChatSocket } from '../../lib/chatSocket';
import type { NotificationItem } from '../../types/api';
import { notificationLink } from '../../features/notifications/notificationsUtils';

export interface NotificationToast {
  id: string;
  title: string;
  body: string;
  link: string | null;
}

const DESIGN_EVENTS = new Set([
  'design.submitted',
  'design.approved',
  'design.rejected',
  'design.revision_requested',
  'design.released',
]);

function invalidateDesignQueries(qc: ReturnType<typeof useQueryClient>, designId?: string) {
  qc.invalidateQueries({ queryKey: ['designs-page'] });
  qc.invalidateQueries({ queryKey: ['designs'] });
  qc.invalidateQueries({ queryKey: ['design-stats'] });
  qc.invalidateQueries({ queryKey: ['approvals-pending'] });
  qc.invalidateQueries({ queryKey: ['approvals-stats'] });
  if (designId) {
    qc.invalidateQueries({ queryKey: ['design', designId] });
    qc.invalidateQueries({ queryKey: ['design-timeline', designId] });
    qc.invalidateQueries({ queryKey: ['design-versions', designId] });
  }
}

interface NotificationContextValue {
  toasts: NotificationToast[];
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, permissions, factoryId } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const canNotify = hasPermission(permissions, 'notification.read', isSuperAdmin);
  const canChat = hasPermission(permissions, 'chat.read', isSuperAdmin);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback((n: NotificationItem) => {
    setToasts((t) => {
      const next = [{
        id: n._id,
        title: n.title,
        body: n.message || '',
        link: notificationLink(n),
      }, ...t.filter((x) => x.id !== n._id)];
      return next.slice(0, 4);
    });
  }, []);

  useEffect(() => {
    if (!canNotify || !factoryId || !user) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = getChatSocket()?.connected
      ? getChatSocket()!
      : connectChatSocket(token, factoryId);

    const onNotification = (payload: NotificationItem) => {
      const recipientId = typeof payload.userId === 'string' ? payload.userId : String(payload.userId);
      if (recipientId !== user._id) return;

      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      qc.invalidateQueries({ queryKey: ['notifications-recent'] });
      qc.invalidateQueries({ queryKey: ['notifications-stats'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });

      if (DESIGN_EVENTS.has(payload.eventType)) {
        invalidateDesignQueries(qc, payload.referenceId);
      }

      pushToast(payload);
    };

    const onDesignUpdated = (payload: { designId?: string }) => {
      invalidateDesignQueries(qc, payload.designId);
    };

    socket.on('notification:new', onNotification);
    socket.on('design:updated', onDesignUpdated);
    return () => {
      socket.off('notification:new', onNotification);
      socket.off('design:updated', onDesignUpdated);
    };
  }, [canNotify, canChat, factoryId, user, qc, pushToast]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((x) => x.slice(1)), 6000);
    return () => clearTimeout(t);
  }, [toasts]);

  const value = useMemo(() => ({ toasts, dismissToast }), [toasts, dismissToast]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {canNotify && toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-20 right-4 z-[9999] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 sm:bottom-6">
          {toasts.map((t) => (
            <button
              key={t.id}
              type="button"
              className="pointer-events-auto rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-3 text-left shadow-lg transition hover:border-[var(--erp-accent)]"
              onClick={() => {
                dismissToast(t.id);
                if (t.link) navigate(t.link);
              }}
            >
              <p className="text-[11px] font-semibold text-erp-text-primary">{t.title}</p>
              {t.body && <p className="mt-0.5 line-clamp-2 text-[10px] text-erp-text-muted">{t.body}</p>}
            </button>
          ))}
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  return ctx ?? { toasts: [], dismissToast: () => {} };
}
