import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { ErpCard, ErpPageHeader, ErpTabs } from '../../components/erp';
import { useChat } from '../../app/providers/ChatProvider';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../../services/chat';
import { ChatMessenger } from './ChatMessenger';

export function ChatPage() {
  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get('room');
  const { canModerate, selectRoom, openChat, selectedRoomId } = useChat();
  const [view, setView] = useState<'inbox' | 'moderate'>('inbox');

  const { data: stats } = useQuery({ queryKey: ['chat-stats'], queryFn: () => chatApi.stats() });

  useEffect(() => {
    if (roomParam) {
      selectRoom(roomParam);
      openChat(roomParam);
    }
  }, [roomParam, selectRoom, openChat]);

  const tabs = [{ id: 'inbox', label: `Inbox${stats?.unreadTotal ? ` (${stats.unreadTotal})` : ''}` }];
  if (canModerate) tabs.push({ id: 'moderate', label: 'Admin oversight' });

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <ErpPageHeader
        title="Messages"
        subtitle="Factory team chat — direct messages and groups. Use the header icon to open quick chat from anywhere."
      />

      {tabs.length > 1 && (
        <div className="mb-3">
          <ErpTabs
            tabs={tabs}
            active={view}
            onChange={(id) => {
              setView(id as 'inbox' | 'moderate');
              if (id === 'moderate' && selectedRoomId) selectRoom(null);
            }}
          />
        </div>
      )}

      {view === 'moderate' && (
        <ErpCard className="mb-3 !border-amber-500/30 !bg-amber-500/5 !p-2">
          <p className="flex items-center gap-2 text-[11px] text-amber-700">
            <Shield className="h-3.5 w-3.5" />
            Moderation view — you can read any factory conversation. Access is audited.
          </p>
        </ErpCard>
      )}

      <ChatMessenger mode="page" view={view} onViewChange={setView} className="min-h-0 flex-1" />
    </div>
  );
}
