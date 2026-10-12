import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { InfoBanner, PageHeader, Tabs } from '../../components/erp';
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

  const tabs: { id: string; label: string; count?: number | null }[] = [
    { id: 'inbox', label: 'Inbox', count: stats?.unreadTotal ? stats.unreadTotal : null },
  ];
  if (canModerate) tabs.push({ id: 'moderate', label: 'All conversations' });

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader title="Messages" description="Direct messages and group chats with your factory team." />

      {tabs.length > 1 && (
        <div className="mb-3">
          <Tabs
            ariaLabel="Message views"
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
        <InfoBanner inset={false} tone="warn" icon={<Shield size={16} className="mt-0.5 shrink-0" />} className="mb-3">
          You can read every conversation at this factory. Each view is recorded in the audit log.
        </InfoBanner>
      )}

      <ChatMessenger mode="page" view={view} onViewChange={setView} className="min-h-0 flex-1" />
    </div>
  );
}
