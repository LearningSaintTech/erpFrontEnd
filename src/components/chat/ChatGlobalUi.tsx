import { useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { ChatFab } from './ChatFab';
import { ChatPanel } from './ChatPanel';
import { ChatToastStack } from './ChatToastStack';

/** Global chat overlay — rendered outside the app shell so the FAB is never clipped. */
export function ChatGlobalUi() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading || !user || location.pathname === '/login') return null;

  return (
    <>
      <ChatFab />
      <ChatPanel />
      <ChatToastStack />
    </>
  );
}
