import { createPortal } from 'react-dom';
import { MessageSquare, X } from 'lucide-react';
import { useChat } from '../../app/providers/ChatProvider';
import { ChatPortalShell } from './ChatPortalShell';

export function ChatToastStack() {
  const { toasts, dismissToast, openChat } = useChat();

  if (!toasts.length) return null;

  return createPortal(
    <ChatPortalShell>
      <div className="pointer-events-none fixed bottom-24 right-4 z-[9995] flex w-full max-w-sm flex-col gap-2 p-4 md:bottom-[5.75rem] md:right-6">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chat-toast pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-[var(--erp-border)] p-3 text-left shadow-lg ring-1 ring-black/10 transition hover:brightness-105"
            onClick={() => {
              dismissToast(t.id);
              openChat(t.roomId);
            }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--erp-accent-muted)] text-[var(--erp-accent)]">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-erp-text-primary">{t.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[10px] text-erp-text-muted">{t.body}</p>
            </div>
            <span
              role="button"
              tabIndex={0}
              className="shrink-0 rounded p-0.5 text-erp-text-muted hover:bg-[var(--erp-border)]"
              onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); dismissToast(t.id); } }}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>
    </ChatPortalShell>,
    document.body,
  );
}
