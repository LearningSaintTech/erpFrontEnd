import type { ErpRole } from '../../types/api';
import { formatDateTime } from '../../utils/format';

export function userDisplayName(u: { firstName: string; lastName: string; email?: string }) {
  const name = `${u.firstName} ${u.lastName}`.trim();
  return name || u.email || '—';
}

export function formatLastLogin(ts?: string) {
  if (!ts) return 'Never';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDateTime(d);
}

const MODULE_LABELS: Record<string, string> = {
  bom: 'BOM',
  sku: 'SKU',
  mrp: 'MRP',
  capa: 'CAPA',
  inventoryCode: 'Inventory codes',
  report: 'Reports',
  user: 'Users',
  role: 'Roles',
  approval: 'Approvals',
  notification: 'Notifications',
  audit: 'Audit log',
  organization: 'Organizations',
  factory: 'Factory',
  settings: 'Settings',
};

/** "inventoryCode" → "Inventory codes", "bom" → "BOM". */
export function moduleLabel(mod: string) {
  if (MODULE_LABELS[mod]) return MODULE_LABELS[mod];
  const spaced = mod.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function permissionActionLabel(module: string, action: string) {
  if (module === 'purchase' && action === 'authorize') return 'Approve PR';
  if (module === 'purchase' && action === 'pay') return 'Mark paid';
  const spaced = action.replace(/\./g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Human label for a full permission code, e.g. "design.approve" → "Design · Approve". */
export function permissionLabel(code: string) {
  const dot = code.indexOf('.');
  if (dot === -1) return code === '*' ? 'All permissions' : code;
  const mod = code.slice(0, dot);
  return `${moduleLabel(mod)} · ${permissionActionLabel(mod, code.slice(dot + 1))}`;
}

export function groupPermissions(permissions: string[] = []) {
  const groups: Record<string, string[]> = {};
  for (const code of permissions) {
    // Split on the first dot only: codes like chat.group.create have a dotted action.
    const dot = code.indexOf('.');
    const mod = dot === -1 ? code : code.slice(0, dot);
    const action = dot === -1 ? '' : code.slice(dot + 1);
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
  return formatDateTime(d);
}

export function isExpired(ts?: string) {
  if (!ts) return false;
  return new Date(ts) < new Date();
}
