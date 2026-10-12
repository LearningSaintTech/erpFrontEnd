type Cell = string | number | null | undefined;

/** Cells that a spreadsheet would run as a formula (=, +, -, @, tab, CR) unless they are plain numbers. */
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function csvCell(v: Cell): string {
  if (typeof v === 'number' && !Number.isFinite(v)) return '';
  let s = String(v ?? '');
  if (FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text (CRLF rows, UTF-8 BOM so Excel shows ₹ and non-ASCII names correctly). */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Client-side CSV download for list exports gated by *.export permissions */
export function downloadCsv(filename: string, headers: string[], rows: Cell[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in some browsers; give it a tick.
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Pull every page of a paged list endpoint (the API caps a page at 500 rows). */
export async function fetchAllPages<T>(
  fetchPage: (p: { page: number; limit: number }) => Promise<{ items: T[]; meta?: { totalPages?: number } }>,
  { limit = 500, maxPages = 40 }: { limit?: number; maxPages?: number } = {},
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { items, meta } = await fetchPage({ page, limit });
    all.push(...items);
    const totalPages = meta?.totalPages ?? (items.length < limit ? page : page + 1);
    if (page >= totalPages || items.length === 0) break;
  }
  return all;
}
