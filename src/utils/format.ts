/** App-wide date formatting: "11 Oct 2026" / "11 Oct 2026, 2:51 am" (never the browser's locale default). */
export function formatDate(d?: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(d?: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
