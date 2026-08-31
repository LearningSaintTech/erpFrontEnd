import { createPortal } from 'react-dom';
import { MessageSquare, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useChat } from '../../app/providers/ChatProvider';
import { ChatMessenger } from '../../features/chat/ChatMessenger';
import { ErpButton } from '../erp';
import { ChatPortalShell } from './ChatPortalShell';

export function ChatPanel() {
  const { canChat, panelOpen, closeChat, unreadTotal } = useChat();

  if (!canChat) return null;

  return createPortal(
    <ChatPortalShell>
      <div
        className={`chat-panel-backdrop fixed inset-0 z-[9980] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          panelOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeChat}
        aria-hidden={!panelOpen}
      />

      <aside
        className={`chat-panel-drawer fixed bottom-0 right-0 top-0 z-[9985] flex w-full max-w-md flex-col border-l border-[var(--erp-border)] shadow-2xl transition-transform duration-300 ease-out md:bottom-4 md:right-4 md:top-auto md:h-[min(720px,calc(100vh-6rem))] md:max-h-[calc(100vh-6rem)] md:rounded-xl md:border ${
          panelOpen ? 'pointer-events-auto translate-x-0' : 'pointer-events-none translate-x-full md:translate-x-[calc(100%+1rem)]'
        }`}
        role="dialog"
        aria-label="Messages"
        aria-hidden={!panelOpen}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--erp-border)] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--erp-accent)]" />
            <div>
              <h2 className="text-[13px] font-semibold text-erp-text-primary">Messages</h2>
              {unreadTotal > 0 && (
                <p className="text-[10px] text-erp-text-muted">{unreadTotal} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/chat" onClick={closeChat}>
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]">All chats</ErpButton>
            </Link>
            <button type="button" className="erp-icon-btn" onClick={closeChat} aria-label="Close messages">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="chat-panel-body min-h-0 flex-1 overflow-hidden bg-[var(--erp-surface,var(--erp-header-bg))] p-2">
          <ChatMessenger mode="panel" className="chat-messenger-panel h-full" />
        </div>
      </aside>
    </ChatPortalShell>,
    document.body,
  );
}
