import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';
import { hasPermission } from '../../utils/permissions';
import { chatApi } from '../../services/chat';
import {
  connectChatSocket, disconnectChatSocket, emitMarkRead, getChatSocket, joinChatRoom, leaveChatRoom,
} from '../../lib/chatSocket';
import type { ChatMessage } from '../../types/api';
import { senderIdOf, userLabel } from '../../features/chat/chatUtils';

export interface ChatToast {
  id: string;
  roomId: string;
  title: string;
  body: string;
}

interface ChatContextValue {
  canChat: boolean;
  canSend: boolean;
  canCreateGroup: boolean;
  canModerate: boolean;
  panelOpen: boolean;
  selectedRoomId: string | null;
  unreadTotal: number;
  toasts: ChatToast[];
  openChat: (roomId?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
  selectRoom: (roomId: string | null) => void;
  dismissToast: (id: string) => void;
  openToast: (toast: ChatToast) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, permissions, factoryId } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const qc = useQueryClient();
  const location = useLocation();
  const prevRoomRef = useRef<string | null>(null);

  const canChat = hasPermission(permissions, 'chat.read', isSuperAdmin);
  const canNotify = hasPermission(permissions, 'notification.read', isSuperAdmin);
  const canSend = hasPermission(permissions, 'chat.send', isSuperAdmin);
  const canCreateGroup = hasPermission(permissions, 'chat.group.create', isSuperAdmin);
  const canModerate = hasPermission(permissions, 'chat.moderate', isSuperAdmin);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ChatToast[]>([]);

  const { data: stats } = useQuery({
    queryKey: ['chat-stats'],
    queryFn: () => chatApi.stats(),
    enabled: canChat && !!factoryId,
    refetchInterval: 30_000,
  });

  const unreadTotal = stats?.unreadTotal ?? 0;

  const selectRoom = useCallback((roomId: string | null) => {
    setSelectedRoomId(roomId);
    if (roomId) {
      chatApi.markRead(roomId).catch(() => {});
      emitMarkRead(roomId);
      qc.invalidateQueries({ queryKey: ['chat-stats'] });
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
    }
  }, [qc]);

  const openChat = useCallback((roomId?: string) => {
    if (roomId) selectRoom(roomId);
    setPanelOpen(true);
  }, [selectRoom]);

  const closeChat = useCallback(() => setPanelOpen(false), []);
  const toggleChat = useCallback(() => setPanelOpen((v) => !v), []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const openToast = useCallback((toast: ChatToast) => {
    setToasts((t) => {
      const next = [toast, ...t.filter((x) => x.roomId !== toast.roomId)];
      return next.slice(0, 4);
    });
  }, []);

  // Global socket — stays connected while user has chat access
  useEffect(() => {
    if ((!canChat && !canNotify) || !factoryId || !user) {
      disconnectChatSocket();
      return;
    }
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = connectChatSocket(token, factoryId);

    const onMessage = (msg: ChatMessage) => {
      const roomId = typeof msg.roomId === 'string' ? msg.roomId : String(msg.roomId);
      const isMine = senderIdOf(msg.senderId) === user._id;

      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      qc.invalidateQueries({ queryKey: ['chat-stats'] });

      if (roomId === selectedRoomId) {
        qc.setQueryData(
          ['chat-messages', roomId, 'inbox'],
          (old: { items: ChatMessage[]; meta?: unknown } | undefined) => {
            if (!old) return old;
            if (old.items.some((m) => m._id === msg._id)) return old;
            return { ...old, items: [...old.items, msg] };
          },
        );
      }

      if (isMine) return;

      const onChatPage = location.pathname === '/chat';
      const panelShowsRoom = panelOpen && selectedRoomId === roomId;
      if (panelShowsRoom || (onChatPage && selectedRoomId === roomId)) return;

      const senderName = userLabel(typeof msg.senderId === 'object' ? msg.senderId : undefined);
      openToast({
        id: msg._id,
        roomId,
        title: senderName,
        body: msg.body.length > 80 ? `${msg.body.slice(0, 80)}…` : msg.body,
      });
    };

    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [canChat, canNotify, factoryId, user, selectedRoomId, panelOpen, location.pathname, qc, openToast]);

  // Reconnect when factory changes
  useEffect(() => {
    if ((!canChat && !canNotify) || !factoryId) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    connectChatSocket(token, factoryId);
  }, [canChat, canNotify, factoryId]);

  // Join/leave socket room when selection changes
  useEffect(() => {
    if (!canChat) return;
    const prev = prevRoomRef.current;
    if (prev && prev !== selectedRoomId) leaveChatRoom(prev);
    if (selectedRoomId) joinChatRoom(selectedRoomId);
    prevRoomRef.current = selectedRoomId;
  }, [canChat, selectedRoomId]);

  // Auto-dismiss toasts
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((x) => x.slice(1)), 6000);
    return () => clearTimeout(t);
  }, [toasts]);

  const value = useMemo<ChatContextValue>(() => ({
    canChat,
    canSend,
    canCreateGroup,
    canModerate,
    panelOpen,
    selectedRoomId,
    unreadTotal,
    toasts,
    openChat,
    closeChat,
    toggleChat,
    selectRoom,
    dismissToast,
    openToast,
  }), [
    canChat, canSend, canCreateGroup, canModerate, panelOpen, selectedRoomId, unreadTotal, toasts,
    openChat, closeChat, toggleChat, selectRoom, dismissToast, openToast,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    return {
      canChat: false,
      canSend: false,
      canCreateGroup: false,
      canModerate: false,
      panelOpen: false,
      selectedRoomId: null,
      unreadTotal: 0,
      toasts: [] as ChatToast[],
      openChat: () => {},
      closeChat: () => {},
      toggleChat: () => {},
      selectRoom: () => {},
      dismissToast: () => {},
      openToast: () => {},
    } satisfies ChatContextValue;
  }
  return ctx;
}
