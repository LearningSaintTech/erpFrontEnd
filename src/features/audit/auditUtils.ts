import type { AuditLogEntry } from '../../types/api';

export function parseAction(action?: string) {
  if (!action) return { method: '—', path: '', label: '—' };
  const idx = action.indexOf('_');
  if (idx === -1) return { method: action, path: '', label: action };
  const method = action.slice(0, idx);
  const path = action.slice(idx + 1);
  return { method, path, label: `${method} ${path}` };
}

export function formatTimestamp(ts?: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function relativeTime(ts?: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function methodTone(method: string) {
  switch (method.toUpperCase()) {
    case 'POST': return 'text-[var(--erp-success-text)]';
    case 'PUT':
    case 'PATCH': return 'text-[var(--erp-accent)]';
    case 'DELETE': return 'text-[var(--erp-danger-text)]';
    default: return 'text-erp-text-muted';
  }
}

export function auditPath(log: AuditLogEntry) {
  return log.metadata?.path || parseAction(log.action).path || '—';
}

export function exportAuditCsv(logs: AuditLogEntry[]) {
  const header = ['Timestamp', 'User', 'Module', 'Method', 'Path', 'IP'];
  const rows = logs.map((log) => {
    const { method, path } = parseAction(log.action);
    return [
      formatTimestamp(log.timestamp),
      log.userEmail || '',
      log.module || '',
      method,
      log.metadata?.path || path,
      log.metadata?.ipAddress || '',
    ];
  });
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const VERBS: Record<string, string> = {
  submit: 'Submitted', approve: 'Approved', reject: 'Rejected', 'request-changes': 'Requested changes on',
  release: 'Released', unlock: 'Unlocked', 'reset-password': 'Reset password for', revoke: 'Revoked',
  deactivate: 'Deactivated', activate: 'Activated', cancel: 'Cancelled', close: 'Closed', complete: 'Completed',
  start: 'Started', clone: 'Cloned', 'mark-paid': 'Marked paid', pay: 'Paid', assign: 'Assigned',
  'change-password': 'Changed password for', read: 'Marked read', 'read-all': 'Marked all read',
  advance: 'Advanced', dispatch: 'Dispatched', receive: 'Received', convert: 'Converted', restore: 'Restored',
};

const METHOD_VERB: Record<string, string> = {
  POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted',
};

function words(s: string) {
  return s.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim();
}

function singular(s: string) {
  if (s.endsWith('ies')) return `${s.slice(0, -3)}y`;
  if (s.endsWith('ses')) return s.slice(0, -2);
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
  return s;
}

function sentence(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "POST_/purchase-requisitions/:id/submit" → "Submitted purchase requisition". */
export function describeAction(action?: string, fallbackPath?: string) {
  const { method, path } = parseAction(action);
  const raw = (path || fallbackPath || '').replace(/^\/?api\/v\d+/, '');
  const segs = raw.split('/').filter(Boolean);
  if (segs.length === 0) return action || '—';
  const resource = words(singular(segs[0]));
  const hasId = segs.slice(1).some((s) => OBJECT_ID.test(s));
  const rest = segs.slice(1).filter((s) => !OBJECT_ID.test(s));
  const last = rest[rest.length - 1];
  if (last && VERBS[last]) {
    const between = rest.slice(0, -1).map(words).join(' ');
    return sentence(`${VERBS[last]} ${resource}${between ? ` ${between}` : ''}`);
  }
  const verb = METHOD_VERB[method.toUpperCase()] ?? method;
  if (rest.length === 0) return sentence(`${verb} ${resource}`);
  if (hasId || method.toUpperCase() !== 'POST') return sentence(`${verb} ${resource} ${rest.map(words).join(' ')}`);
  return `${sentence(resource)}: ${rest.map(words).join(' ')}`;
}

export function moduleName(mod?: string) {
  if (!mod) return '—';
  const known: Record<string, string> = { rbac: 'Access control', bom: 'BOM', sku: 'SKU', capa: 'CAPA', mrp: 'MRP' };
  return known[mod.toLowerCase()] ?? sentence(words(mod));
}

export const AUDIT_ACTION_TYPES = [
  { id: '', label: 'All actions' },
  { id: 'POST_', label: 'Created or actioned' },
  { id: 'PATCH_', label: 'Edited' },
  { id: 'PUT_', label: 'Saved settings / replaced' },
  { id: 'DELETE_', label: 'Deleted' },
];

export function methodBadgeTone(method: string): 'success' | 'info' | 'danger' | 'neutral' {
  switch (method.toUpperCase()) {
    case 'POST': return 'success';
    case 'PUT':
    case 'PATCH': return 'info';
    case 'DELETE': return 'danger';
    default: return 'neutral';
  }
}

export function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
