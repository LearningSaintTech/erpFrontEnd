import type { ErpRole } from '../../types/api';

export function userDisplayName(u: { firstName: string; lastName: string; email?: string }) {
  const name = `${u.firstName} ${u.lastName}`.trim();
  return name || u.email || '—';
}

export function formatLastLogin(ts?: string) {
  if (!ts) return 'Never';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function groupPermissions(permissions: string[] = []) {
  const groups: Record<string, string[]> = {};
  for (const code of permissions) {
    const [mod, action] = code.split('.');
    if (!mod) continue;
    if (!groups[mod]) groups[mod] = [];
    groups[mod].push(action || code);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export function roleLabel(role: ErpRole | string | undefined) {
  if (!role || typeof role === 'string') return role || '—';
  return role.name || role.code;
}

/** Comma-separated role names for a user row (current factory). */
export function userRolesLabel(user: {
  isSuperAdmin?: boolean;
  roles?: { code?: string; name?: string }[];
}) {
  if (user.isSuperAdmin) return 'Super Admin';
  const names = (user.roles || [])
    .map((r) => r.name || r.code)
    .filter(Boolean);
  return names.length ? names.join(', ') : '—';
}

export function factoryLabel(
  factory: { code?: string; name?: string } | string | undefined,
) {
  if (!factory || typeof factory === 'string') return factory || '—';
  return factory.code ? `${factory.code} — ${factory.name}` : factory.name || '—';
}

export function formatExpiresAt(ts?: string) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

export function isExpired(ts?: string) {
  if (!ts) return false;
  return new Date(ts) < new Date();
}
