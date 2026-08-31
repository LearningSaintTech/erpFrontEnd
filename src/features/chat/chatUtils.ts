import type { ChatMessage, ChatRoom, ErpUser } from '../../types/api';

export function userLabel(u?: ErpUser | { firstName?: string; lastName?: string; email?: string }) {
  if (!u) return 'User';
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return name || u.email || 'User';
}

export function senderIdOf(sender?: ChatMessage['senderId']): string | undefined {
  if (!sender) return undefined;
  return typeof sender === 'string' ? sender : sender._id;
}

export function roomTitle(room: ChatRoom, myId: string) {
  if (room.type === 'GROUP') return room.name || 'Group';
  const members = room.members ?? [];
  const other = members.find((m) => {
    const uid = typeof m.userId === 'object' ? m.userId?._id : m.userId;
    return uid && uid !== myId;
  });
  const otherUser = typeof other?.userId === 'object' ? other.userId : undefined;
  return otherUser ? userLabel(otherUser) : 'Direct chat';
}

export function roomInitials(room: ChatRoom, myId: string): string {
  const title = roomTitle(room, myId);
  const parts = title.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return title.slice(0, 2).toUpperCase();
}

export function formatMessageTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function chatRoomPath(roomId: string) {
  return `/chat?room=${roomId}`;
}
