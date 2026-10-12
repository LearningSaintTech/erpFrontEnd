import { Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { AppLoader } from './AppLoader';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
