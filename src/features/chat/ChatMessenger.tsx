import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, Plus, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { hasPermission } from '../../utils/permissions';
import { useChat } from '../../app/providers/ChatProvider';
import { chatApi } from '../../services/chat';
import { usersApi } from '../../services/admin';
import { emitTyping, getChatSocket } from '../../lib/chatSocket';
import type { ChatMessage, ChatRoom } from '../../types/api';
import {
  Button, ErpCard, ErpInput, ErpSelect, Field, IconButton, Modal, SearchInput,
} from '../../components/erp';
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

/** Latest messages per thread — the API caps a page at 100 (a larger limit is rejected with 422). */
const MESSAGE_PAGE = 100;

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

  const { data: messagesPage, isLoading: msgsLoading, isError: msgsError, error: msgsErr, refetch: refetchMsgs } = useQuery({
    queryKey: ['chat-messages', selectedRoomId, view === 'moderate' ? 'moderate' : 'inbox'],
    queryFn: () => (view === 'moderate'
      ? chatApi.listAdminMessages(selectedRoomId!, { limit: MESSAGE_PAGE })
      : chatApi.listMessages(selectedRoomId!, { limit: MESSAGE_PAGE })),
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
  });

  const createDm = useMutation({
    mutationFn: () => chatApi.createDirect(dmUserId),
    onSuccess: (room) => {
      setDmUserId('');
      selectRoom(room._id);
      setMobileShowThread(true);
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
    },
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
      <div className={`grid min-h-0 flex-1 gap-0 ${isPanel ? 'grid-cols-1' : 'lg:grid-cols-[300px_1fr]'} ${!isPanel ? 'lg:gap-3' : ''}`}>
        {/* Room list */}
        <ErpCard
          className={`chat-panel-list flex flex-col overflow-hidden !p-0 ${showList ? '' : 'hidden'} ${isPanel ? '!border-0 !bg-transparent !shadow-none' : ''}`}
        >
          <div className="border-b border-[var(--erp-border)] p-2 space-y-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search conversations…" inputSize="sm" />
            {canSend && view === 'inbox' && canListUsers && (
              <div className="flex gap-1">
                <ErpSelect inputSize="sm" value={dmUserId} onChange={(e) => setDmUserId(e.target.value)} className="min-w-0 flex-1" aria-label="Start a conversation with">
                  <option value="">New message…</option>
                  {users.filter((u) => u._id !== myId).map((u) => (
                    <option key={u._id} value={u._id}>{userLabel(u)}</option>
                  ))}
                </ErpSelect>
                <Button size="sm" disabled={!dmUserId} loading={createDm.isPending} onClick={() => createDm.mutate()}>
                  Chat
                </Button>
                {canCreateGroup && (
                  <IconButton aria-label="New group" size="sm" outlined onClick={() => setShowGroup(true)}>
                    <Plus size={16} />
                  </IconButton>
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
              <p className="text-[13px] font-medium text-erp-text-primary">Select a conversation</p>
              <p className="text-xs text-erp-text-muted">Pick someone from the list or start a new message</p>
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
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ background: 'var(--erp-accent)' }}
                >
                  {selectedRoom ? roomInitials(selectedRoom, myId) : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {selectedRoom ? roomTitle(selectedRoom, myId) : 'Chat'}
                  </p>
                  {selectedRoom?.type === 'GROUP' && (
                    <p className="text-xs text-erp-text-muted">{selectedRoom.members?.length ?? 0} members</p>
                  )}
                </div>
                {isPanel && (
                  <Link to={`/chat?room=${selectedRoomId}`} className="text-xs text-[var(--erp-accent)] hover:underline" onClick={closeChat}>
                    Open full
                  </Link>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                <QueryState isLoading={msgsLoading} isError={msgsError} error={msgsErr} onRetry={() => refetchMsgs()} emptyMessage="No messages yet — say hello!">
                  {messages.map((m) => (
                    <MessageBubble key={m._id} message={m} myId={myId} />
                  ))}
                  {typingUser && (
                    <p className="text-xs italic text-erp-text-muted">{typingUser} is typing…</p>
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
                    className="flex-1 text-[13px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && draft.trim()) {
                        e.preventDefault();
                        send.mutate();
                      }
                    }}
                  />
                  <Button aria-label="Send message" disabled={!draft.trim()} loading={send.isPending} onClick={() => send.mutate()} icon={<Send size={16} />} />
                </div>
              )}
            </>
          )}
        </ErpCard>
      </div>

      <GroupModal
        open={showGroup}
        onClose={() => setShowGroup(false)}
        users={users.filter((u) => u._id !== myId)}
        name={groupName}
        onNameChange={setGroupName}
        members={groupMembers}
        onMembersChange={setGroupMembers}
        saving={createGroup.isPending}
        onCreate={() => createGroup.mutate()}
      />
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
        active ? 'bg-[var(--erp-row-selected)]' : ''
      }`}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ background: active ? 'var(--erp-accent)' : 'var(--erp-text-muted)' }}
      >
        {roomInitials(room, myId)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[13px] font-medium">{roomTitle(room, myId)}</p>
          {room.lastMessageAt && (
            <span className="shrink-0 text-xs text-erp-text-muted">{formatMessageTime(room.lastMessageAt)}</span>
          )}
        </div>
        <p className="truncate text-xs text-erp-text-muted">{room.lastMessagePreview || 'No messages'}</p>
      </div>
      {(room.unreadCount ?? 0) > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--erp-accent)] px-1 text-xs font-bold text-white">
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
        className={`max-w-[82%] rounded-2xl px-3 py-1.5 text-[13px] leading-relaxed ${
          isSystem
            ? 'mx-auto bg-transparent text-center text-xs italic text-erp-text-muted'
            : mine
              ? 'rounded-br-md bg-[var(--erp-accent)] text-white'
              : 'chat-bubble-incoming rounded-bl-md shadow-sm'
        }`}
      >
        {!mine && !isSystem && (
          <p className="mb-0.5 text-xs font-semibold opacity-70">
            {userLabel(typeof m.senderId === 'object' ? m.senderId : undefined)}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        {!isSystem && m.createdAt && (
          <p className={`mt-0.5 text-xs ${mine ? 'text-white/70' : 'text-erp-text-muted'}`}>
            {formatMessageTime(m.createdAt)}
          </p>
        )}
      </div>
    </div>
  );
}

function GroupModal({
  open, onClose, users, name, onNameChange, members, onMembersChange, saving, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  users: { _id: string; firstName?: string; lastName?: string; email?: string }[];
  name: string;
  onNameChange: (v: string) => void;
  members: string[];
  onMembersChange: (v: string[]) => void;
  saving: boolean;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (open) { setFilter(''); setTouched(false); } }, [open]);
  const q = filter.trim().toLowerCase();
  const shown = q ? users.filter((u) => userLabel(u).toLowerCase().includes(q)) : users;
  const toggle = (id: string) => onMembersChange(members.includes(id) ? members.filter((m) => m !== id) : [...members, id]);
  const submit = () => {
    setTouched(true);
    if (name.trim() && members.length) onCreate();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New group"
      description="Group chats are visible to every member you add."
      size="sm"
      closeOnOverlayClick={false}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Create group</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label="Group name" required error={touched && !name.trim() ? 'Enter a group name.' : undefined}>
          <ErpInput value={name} onChange={(e) => onNameChange(e.target.value)} autoFocus />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-erp-text-secondary">
            Members <span className="text-erp-text-muted">({members.length} selected)</span>
          </p>
          <SearchInput value={filter} onChange={setFilter} placeholder="Find people…" inputSize="sm" />
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-md border border-[var(--erp-border)]">
            {shown.map((u) => (
              <li key={u._id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-[var(--erp-row-hover)]">
                  <input type="checkbox" className="h-4 w-4 rounded accent-[var(--erp-accent)]" checked={members.includes(u._id)} onChange={() => toggle(u._id)} />
                  {userLabel(u)}
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-4 text-center text-[13px] text-erp-text-muted">No people match.</li>}
          </ul>
          {touched && members.length === 0 && <p className="mt-1 text-xs text-[var(--erp-danger-text)]">Add at least one member.</p>}
        </div>
      </div>
    </Modal>
  );
}
