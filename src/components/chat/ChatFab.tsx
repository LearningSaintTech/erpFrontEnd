import { createPortal } from 'react-dom';
import { MessageSquare } from 'lucide-react';
import { useChat } from '../../app/providers/ChatProvider';

export function ChatFab() {
  const { canChat, openChat, panelOpen, unreadTotal } = useChat();

  if (!canChat || panelOpen) return null;

  return createPortal(
    <div className="chat-fab-root pointer-events-none fixed inset-0 z-[9990]">
      <div className="pointer-events-none absolute bottom-5 right-5 md:bottom-6 md:right-6">
        <button
          type="button"
          className="chat-fab-btn group pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--erp-accent,#3b82f6)]"
          style={{
            backgroundColor: 'var(--erp-accent, #3b82f6)',
            boxShadow: '0 8px 24px color-mix(in srgb, var(--erp-accent, #3b82f6) 35%, transparent)',
          }}
          title={unreadTotal > 0 ? `${unreadTotal} unread messages` : 'Open messages'}
          aria-label={`Open messages${unreadTotal ? `, ${unreadTotal} unread` : ''}`}
          onClick={() => openChat()}
        >
          <MessageSquare className="h-6 w-6" strokeWidth={2} />

          {unreadTotal > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </span>
          )}

          <span
            className="pointer-events-none absolute right-full mr-3 hidden origin-right scale-95 whitespace-nowrap rounded-full border border-[var(--erp-border,#e2e8f0)] bg-[var(--erp-surface,#fff)] px-3 py-1.5 text-[11px] font-medium text-[var(--erp-text-primary,#0f172a)] opacity-0 shadow-md transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 sm:block"
            aria-hidden
          >
            {unreadTotal > 0 ? `${unreadTotal} unread · Open chat` : 'Open messages'}
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
