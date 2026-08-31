import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, Plus, Search, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { hasPermission } from '../../utils/permissions';
import { useChat } from '../../app/providers/ChatProvider';
import { chatApi } from '../../services/chat';
import { usersApi } from '../../services/admin';
import { emitTyping, getChatSocket } from '../../lib/chatSocket';
import type { ChatMessage, ChatRoom } from '../../types/api';
import { ErpButton, ErpCard, ErpInput, ErpSelect } from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import {
  formatMessageTime, roomInitials, roomTitle, senderIdOf, userLabel,
} from './chatUtils';

type View = 'inbox' | 'moderate';

interface ChatMessengerProps {
  mode: 'page' | 'panel';
  view?: View;
  onViewChange?: (v: View) => void;
  className?: string;
}

export function ChatMessenger({ mode, view: viewProp, onViewChange, className = '' }: ChatMessengerProps) {
  const qc = useQueryClient();
  const { user, permissions } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const canListUsers = hasPermission(permissions, 'user.read', isSuperAdmin);
  const {
    canSend, canCreateGroup, selectedRoomId, selectRoom, closeChat,
  } = useChat();

  const [internalView, setInternalView] = useState<View>('inbox');
  const view = viewProp ?? internalView;
  const setView = onViewChange ?? setInternalView;

  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [dmUserId, setDmUserId] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myId = user?._id || '';

  const { data: roomsPage, isLoading: roomsLoading, isError: roomsError } = useQuery({
    queryKey: ['chat-rooms', view],
    queryFn: () => (view === 'moderate' ? chatApi.listAdminRooms({ limit: 80 }) : chatApi.listRooms({ limit: 80 })),
    enabled: true,
  });
  const rooms = roomsPage?.items ?? [];

  const filteredRooms = search.trim()
    ? rooms.filter((r) => roomTitle(r, myId).toLowerCase().includes(search.toLowerCase()))
    : rooms;

  const { data: messagesPage, isLoading: msgsLoading } = useQuery({
    queryKey: ['chat-messages', selectedRoomId, view === 'moderate' ? 'moderate' : 'inbox'],
    queryFn: () => (view === 'moderate'
      ? chatApi.listAdminMessages(selectedRoomId!, { limit: 150 })
      : chatApi.listMessages(selectedRoomId!, { limit: 150 })),
    enabled: !!selectedRoomId,
  });
  const messages = messagesPage?.items ?? [];

  const selectedRoom = rooms.find((r) => r._id === selectedRoomId);

  const { data: users = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: () => usersApi.list({ limit: 150 }),
    enabled: (canSend || canCreateGroup) && canListUsers,
    retry: false,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedRoomId]);

  useEffect(() => {
    const s = getChatSocket();
    if (!s) return;
    const onTyping = (payload: { roomId: string; userId: string; isTyping: boolean }) => {
      if (payload.roomId !== selectedRoomId || payload.userId === myId) return;
      setTypingUser(payload.isTyping ? 'Someone' : null);
    };
    s.on('chat:typing', onTyping);
    return () => { s.off('chat:typing', onTyping); };
  }, [selectedRoomId, myId]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!selectedRoomId) return;
    emitTyping(selectedRoomId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(selectedRoomId, false), 1500);
  };

  const send = useMutation({
    mutationFn: () => chatApi.sendMessage(selectedRoomId!, { body: draft.trim() }),
    onSuccess: () => {
      setDraft('');
      if (selectedRoomId) emitTyping(selectedRoomId, false);
      qc.invalidateQueries({ queryKey: ['chat-messages', selectedRoomId] });
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      qc.invalidateQueries({ queryKey: ['chat-stats'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const createDm = useMutation({
    mutationFn: () => chatApi.createDirect(dmUserId),
    onSuccess: (room) => {
      setDmUserId('');
      selectRoom(room._id);
      setMobileShowThread(true);
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const createGroup = useMutation({
    mutationFn: () => chatApi.createGroup({ name: groupName.trim(), memberIds: groupMembers }),
    onSuccess: (room) => {
      setShowGroup(false);
      setGroupName('');
      setGroupMembers([]);
      selectRoom(room._id);
      setMobileShowThread(true);
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const pickRoom = (id: string) => {
    selectRoom(id);
    setMobileShowThread(true);
  };

  const isPanel = mode === 'panel';
  const showList = !isPanel || !mobileShowThread;
  const showThread = !isPanel || mobileShowThread;

  return (
    <div className={`chat-messenger flex min-h-0 flex-col ${isPanel ? 'chat-messenger-panel' : ''} ${className}`}>
      {error && (
        <p className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-600">{error}</p>
      )}

      <div className={`grid min-h-0 flex-1 gap-0 ${isPanel ? 'grid-cols-1' : 'lg:grid-cols-[300px_1fr]'} ${!isPanel ? 'lg:gap-3' : ''}`}>
        {/* Room list */}
        <ErpCard
          className={`chat-panel-list flex flex-col overflow-hidden !p-0 ${showList ? '' : 'hidden'} ${isPanel ? '!border-0 !bg-transparent !shadow-none' : ''}`}
        >
          <div className="border-b border-[var(--erp-border)] p-2 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-erp-text-muted" />
              <ErpInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="!py-1.5 !pl-7 text-[11px]"
              />
            </div>
            {canSend && view === 'inbox' && canListUsers && (
              <div className="flex gap-1">
                <ErpSelect value={dmUserId} onChange={(e) => setDmUserId(e.target.value)} className="min-w-0 flex-1 text-[10px]">
                  <option value="">New message…</option>
                  {users.filter((u) => u._id !== myId).map((u) => (
                    <option key={u._id} value={u._id}>{userLabel(u)}</option>
                  ))}
                </ErpSelect>
                <ErpButton className="!px-2 !py-1 text-[10px]" disabled={!dmUserId || createDm.isPending} onClick={() => createDm.mutate()}>
                  Chat
                </ErpButton>
                {canCreateGroup && (
                  <ErpButton variant="secondary" className="!px-2 !py-1" onClick={() => setShowGroup(true)} title="New group">
                    <Plus className="h-3.5 w-3.5" />
                  </ErpButton>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            <QueryState isLoading={roomsLoading} isError={roomsError} emptyMessage="No conversations yet">
              {filteredRooms.map((room) => (
                <RoomRow
                  key={room._id}
                  room={room}
                  myId={myId}
                  active={selectedRoomId === room._id}
                  onClick={() => pickRoom(room._id)}
                />
              ))}
            </QueryState>
          </div>
        </ErpCard>

        {/* Thread */}
        <ErpCard
          className={`chat-panel-thread flex min-h-0 flex-col !p-0 ${showThread ? '' : 'hidden'} ${isPanel ? '!border-0 !shadow-none' : ''}`}
        >
          {!selectedRoomId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <MessageSquare className="h-10 w-10 text-erp-text-muted opacity-40" />
              <p className="text-[12px] font-medium text-erp-text-primary">Select a conversation</p>
              <p className="text-[10px] text-erp-text-muted">Pick someone from the list or start a new message</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-[var(--erp-border)] px-3 py-2">
                {isPanel && (
                  <button type="button" className="erp-icon-btn lg:hidden" onClick={() => setMobileShowThread(false)} aria-label="Back">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ background: 'var(--erp-accent)' }}
                >
                  {selectedRoom ? roomInitials(selectedRoom, myId) : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium">
                    {selectedRoom ? roomTitle(selectedRoom, myId) : 'Chat'}
                  </p>
                  {selectedRoom?.type === 'GROUP' && (
                    <p className="text-[10px] text-erp-text-muted">{selectedRoom.members?.length ?? 0} members</p>
                  )}
                </div>
                {isPanel && (
                  <Link to={`/chat?room=${selectedRoomId}`} className="text-[10px] text-[var(--erp-accent)] hover:underline" onClick={closeChat}>
                    Open full
                  </Link>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                <QueryState isLoading={msgsLoading} emptyMessage="No messages yet — say hello!">
                  {messages.map((m) => (
                    <MessageBubble key={m._id} message={m} myId={myId} />
                  ))}
                  {typingUser && (
                    <p className="text-[10px] italic text-erp-text-muted">{typingUser} is typing…</p>
                  )}
                  <div ref={bottomRef} />
                </QueryState>
              </div>

              {canSend && view === 'inbox' && (
                <div className="flex gap-2 border-t border-[var(--erp-border)] p-2">
                  <ErpInput
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    placeholder="Write a message…"
                    className="flex-1 text-[11px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && draft.trim()) {
                        e.preventDefault();
                        send.mutate();
                      }
                    }}
                  />
                  <ErpButton className="!px-3 !py-1.5" disabled={!draft.trim() || send.isPending} onClick={() => send.mutate()}>
                    <Send className="h-3.5 w-3.5" />
                  </ErpButton>
                </div>
              )}
            </>
          )}
        </ErpCard>
      </div>

      {showGroup && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <ErpCard className="chat-group-modal w-full max-w-md !p-4 shadow-2xl">
            <h3 className="mb-3 text-sm font-medium">Create group</h3>
            <label className="mb-1 block text-[10px] text-erp-text-muted">Name</label>
            <ErpInput value={groupName} onChange={(e) => setGroupName(e.target.value)} className="mb-3" />
            <label className="mb-1 block text-[10px] text-erp-text-muted">Members (Ctrl+click)</label>
            <select
              multiple
              value={groupMembers}
              onChange={(e) => setGroupMembers(Array.from(e.target.selectedOptions, (o) => o.value))}
              className="mb-3 h-32 w-full rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] p-2 text-[11px]"
            >
              {users.filter((u) => u._id !== myId).map((u) => (
                <option key={u._id} value={u._id}>{userLabel(u)}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setShowGroup(false)}>Cancel</ErpButton>
              <ErpButton
                disabled={!groupName.trim() || !groupMembers.length || createGroup.isPending}
                onClick={() => createGroup.mutate()}
              >
                Create
              </ErpButton>
            </div>
          </ErpCard>
        </div>
      )}
    </div>
  );
}

function RoomRow({
  room, myId, active, onClick,
}: { room: ChatRoom; myId: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 border-b border-[var(--erp-border)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--erp-surface-hover)] ${
        active ? 'bg-[var(--erp-accent-muted)]/30' : ''
      }`}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{ background: active ? 'var(--erp-accent)' : 'var(--erp-text-muted)' }}
      >
        {roomInitials(room, myId)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[11px] font-medium">{roomTitle(room, myId)}</p>
          {room.lastMessageAt && (
            <span className="shrink-0 text-[9px] text-erp-text-muted">{formatMessageTime(room.lastMessageAt)}</span>
          )}
        </div>
        <p className="truncate text-[10px] text-erp-text-muted">{room.lastMessagePreview || 'No messages'}</p>
      </div>
      {(room.unreadCount ?? 0) > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--erp-accent)] px-1 text-[9px] font-bold text-white">
          {room.unreadCount! > 9 ? '9+' : room.unreadCount}
        </span>
      )}
    </button>
  );
}

function MessageBubble({ message: m, myId }: { message: ChatMessage; myId: string }) {
  const mine = senderIdOf(m.senderId) === myId;
  const isSystem = m.messageType === 'SYSTEM';

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-1.5 text-[11px] leading-relaxed ${
          isSystem
            ? 'mx-auto bg-transparent text-center text-[10px] italic text-erp-text-muted'
            : mine
              ? 'rounded-br-md bg-[var(--erp-accent)] text-white'
              : 'chat-bubble-incoming rounded-bl-md shadow-sm'
        }`}
      >
        {!mine && !isSystem && (
          <p className="mb-0.5 text-[9px] font-semibold opacity-70">
            {userLabel(typeof m.senderId === 'object' ? m.senderId : undefined)}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        {!isSystem && m.createdAt && (
          <p className={`mt-0.5 text-[9px] ${mine ? 'text-white/70' : 'text-erp-text-muted'}`}>
            {formatMessageTime(m.createdAt)}
          </p>
        )}
      </div>
    </div>
  );
}
