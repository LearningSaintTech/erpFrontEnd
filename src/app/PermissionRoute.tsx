import { Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { hasPermission } from '../utils/permissions';

interface PermissionRouteProps {
  children: React.ReactNode;
  perm?: string;
  anyOf?: string[];
  superAdminOnly?: boolean;
  redirectTo?: string;
}

export function PermissionRoute({
  children,
  perm,
  anyOf,
  superAdminOnly,
  redirectTo = '/',
}: PermissionRouteProps) {
  const { user, permissions, loading } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-[11px] text-erp-text-muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  if (superAdminOnly && !isSuperAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  if (perm && !hasPermission(permissions, perm, isSuperAdmin)) {
    return <Navigate to={redirectTo} replace />;
  }

  if (anyOf?.length) {
    const allowed = anyOf.some((p) => hasPermission(permissions, p, isSuperAdmin));
    if (!allowed) return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
