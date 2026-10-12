import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CornerDownLeft, History, KeyRound, LogOut, Plus, Search, type LucideIcon,
} from 'lucide-react';
import { useOverlayBehavior } from './erp/Overlay';
import type { NavItem } from '../config/panels';

export interface PaletteEntry {
  id: string;
  label: string;
  group: 'Pages' | 'Actions';
  /** Shown on the right, e.g. section name. */
  hint?: string;
  icon?: LucideIcon;
  keywords?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  pages: Array<NavItem & { section: string; parent?: NavItem }>;
  can: (perm: string) => boolean;
  hideDesignCreate?: boolean;
  onSignOut: () => void;
}

function score(entry: PaletteEntry, q: string): number {
  if (!q) return 1;
  const label = entry.label.toLowerCase();
  const hay = `${label} ${entry.hint || ''} ${entry.keywords || ''}`.toLowerCase();
  const parts = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!parts.every((p) => hay.includes(p))) return 0;
  if (label.startsWith(q.toLowerCase())) return 3;
  if (label.includes(q.toLowerCase())) return 2;
  return 1;
}

/** Global Ctrl/Cmd+K palette: jump to any page the user can see, or run a quick action. */
export function CommandPalette({ open, onClose, pages, can, hideDesignCreate, onSignOut }: CommandPaletteProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useOverlayBehavior({ open, panelRef, onClose, initialFocusRef: inputRef });

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const go = (to: string) => () => { onClose(); navigate(to); };
    const pageEntries: PaletteEntry[] = pages.map((p) => ({
      id: `page:${p.to}`,
      label: p.parent ? `${p.parent.label} · ${p.label}` : p.label,
      group: 'Pages',
      hint: p.section || undefined,
      icon: p.icon,
      keywords: `${p.keywords || ''} ${p.parent?.keywords || ''}`,
      run: go(p.to),
    }));
    const actions: PaletteEntry[] = [];
    if (!hideDesignCreate && can('design.create')) {
      actions.push({ id: 'act:new-design', label: 'New design', group: 'Actions', icon: Plus, keywords: 'create tech pack', run: go('/designs/new') });
    }
    if (can('inventory.read')) {
      actions.push({ id: 'act:stock-alerts', label: 'View low-stock alerts', group: 'Actions', icon: AlertTriangle, hint: 'Inventory', keywords: 'reorder shortage', run: go('/inventory?tab=alerts') });
      actions.push({ id: 'act:movements', label: 'View stock movements', group: 'Actions', icon: History, hint: 'Inventory', keywords: 'ledger transactions', run: go('/inventory?tab=movements') });
    }
    actions.push({ id: 'act:account', label: 'My account', group: 'Actions', icon: KeyRound, keywords: 'password profile', run: go('/settings/account') });
    actions.push({ id: 'act:signout', label: 'Sign out', group: 'Actions', icon: LogOut, keywords: 'logout', run: () => { onClose(); onSignOut(); } });
    return [...pageEntries, ...actions];
  }, [pages, can, hideDesignCreate, navigate, onClose, onSignOut]);

  const results = useMemo(() => {
    const q = query.trim();
    return entries
      .map((e, i) => ({ e, s: score(e, q), i }))
      .filter((r) => r.s > 0)
      .sort((a, b) => (q ? b.s - a.s || a.i - b.i : a.i - b.i))
      .map((r) => r.e);
  }, [entries, query]);

  // Keep groups contiguous in display order
  const ordered = useMemo(() => [
    ...results.filter((r) => r.group === 'Actions' && query.trim()),
    ...results.filter((r) => r.group === 'Pages'),
    ...results.filter((r) => r.group === 'Actions' && !query.trim()),
  ], [results, query]);

  const safeActive = Math.min(active, Math.max(ordered.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${safeActive}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [safeActive]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, ordered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); ordered[safeActive]?.run(); }
  };

  if (!open) return null;

  let lastGroup = '';
  return createPortal(
    <div className="erp-overlay-layer flex items-start justify-center p-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="erp-overlay-backdrop -z-10" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="erp-modal max-w-[600px] overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-[var(--erp-border)] px-4">
          <Search size={18} className="shrink-0 text-erp-text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            placeholder="Search pages and actions…"
            aria-label="Search pages and actions"
            className="!h-12 w-full !border-0 !bg-transparent !px-0 !text-[15px] !shadow-none focus:!shadow-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="erp-cmdk-list"
            aria-activedescendant={ordered[safeActive] ? `cmdk-${safeActive}` : undefined}
            aria-autocomplete="list"
          />
          <kbd className="hidden shrink-0 rounded border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] px-1.5 py-0.5 text-[13px] text-erp-text-muted sm:inline">Esc</kbd>
        </div>
        <ul ref={listRef} id="erp-cmdk-list" role="listbox" className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
          {ordered.length === 0 && (
            <li className="px-3 py-8 text-center text-[13px] text-erp-text-muted">No pages or actions match “{query}”.</li>
          )}
          {ordered.map((entry, idx) => {
            const header = entry.group !== lastGroup ? entry.group : '';
            lastGroup = entry.group;
            const Icon = entry.icon || ArrowRight;
            const on = idx === safeActive;
            return (
              <li key={entry.id} role="presentation">
                {header && <p className="px-2 pb-1 pt-2 text-xs font-semibold text-erp-text-muted">{header}</p>}
                <div
                  id={`cmdk-${idx}`}
                  role="option"
                  aria-selected={on}
                  data-index={idx}
                  className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm ${on ? 'bg-[var(--erp-accent-subtle)] text-[var(--erp-accent-text)]' : 'text-erp-text-primary'}`}
                  onMouseMove={() => setActive(idx)}
                  onClick={() => entry.run()}
                >
                  <Icon size={16} className={on ? 'text-[var(--erp-accent)]' : 'text-erp-text-muted'} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  {entry.hint && <span className="shrink-0 text-xs text-erp-text-muted">{entry.hint}</span>}
                  {on && <CornerDownLeft size={14} className="shrink-0 text-erp-text-muted" aria-hidden="true" />}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="hidden items-center gap-4 border-t border-[var(--erp-border)] bg-[var(--erp-surface-muted)] px-4 py-2 text-xs text-erp-text-muted sm:flex">
          <span><kbd className="font-sans">↑↓</kbd> to move</span>
          <span><kbd className="font-sans">Enter</kbd> to open</span>
          <span><kbd className="font-sans">Esc</kbd> to close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
