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
  return d.toLocaleDateString();
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
