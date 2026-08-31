import { MessageSquare } from 'lucide-react';
import { useChat } from '../../app/providers/ChatProvider';

export function ChatBell() {
  const { canChat, toggleChat, unreadTotal, panelOpen } = useChat();

  if (!canChat) return null;

  return (
    <button
      type="button"
      className={`erp-icon-btn relative ${panelOpen ? 'ring-2 ring-[var(--erp-accent)]/40' : ''}`}
      title="Messages"
      aria-label={`Messages${unreadTotal ? `, ${unreadTotal} unread` : ''}`}
      onClick={toggleChat}
    >
      <MessageSquare className="h-5 w-5" />
      {unreadTotal > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--erp-accent)] px-1 text-[10px] font-bold text-white">
          {unreadTotal > 9 ? '9+' : unreadTotal}
        </span>
      )}
    </button>
  );
}
