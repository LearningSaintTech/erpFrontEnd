import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export type ErpSearchOption = {
  value: string;
  label: string;
  keywords?: string;
};

function matchesQuery(opt: ErpSearchOption, q: string) {
  if (!q) return true;
  const hay = `${opt.label} ${opt.value} ${opt.keywords || ''}`.toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}

export function ErpSearchSelect({
  value,
  onChange,
  options,
  placeholder = '— Select —',
  disabled = false,
  loading = false,
  className = 'w-full !py-1.5 text-[11px]',
  allowClear = true,
  emptyText = 'No matches',
  searchPlaceholder = 'Search…',
  id,
}: {
  value: string;
  onChange: (value: string, option: ErpSearchOption | null) => void;
  options: ErpSearchOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  allowClear?: boolean;
  emptyText?: string;
  searchPlaceholder?: string;
  id?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240, maxHeight: 240, openUp: false });

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => matchesQuery(o, q));
  }, [options, query]);

  const safeHighlight = filtered.length === 0 ? 0 : Math.min(highlight, filtered.length - 1);

  const updatePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(280, openUp ? spaceAbove : spaceBelow));
    setPos({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: Math.max(rect.width, 200),
      maxHeight,
      openUp,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    const onWin = () => updatePos();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
    // Reset search only when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    itemRefs.current[safeHighlight]?.scrollIntoView({ block: 'nearest' });
  }, [safeHighlight]);

  const pick = (opt: ErpSearchOption | null) => {
    onChange(opt?.value || '', opt);
    setOpen(false);
  };

  const onTriggerKey = (e: KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[safeHighlight];
      if (opt) pick(opt);
    }
  };

  const display = loading ? 'Loading…' : (selected?.label || placeholder);
  const muted = !selected || loading;

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { if (!disabled && !loading) setOpen((o) => !o); }}
        onKeyDown={onTriggerKey}
        className={`erp-select flex w-full min-w-0 items-center justify-between gap-1 text-left disabled:cursor-not-allowed disabled:opacity-60 ${className}`.trim()}
      >
        <span className={`min-w-0 truncate ${muted ? 'text-erp-text-muted' : 'text-erp-text-primary'}`}>
          {display}
        </span>
        <ChevronDown size={12} className={`shrink-0 text-erp-text-muted ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          data-erp-search-panel="true"
          className="fixed z-[11000] overflow-hidden rounded-md border border-[var(--erp-border)] bg-[var(--erp-surface,#fff)] shadow-lg"
          style={{
            top: pos.openUp ? undefined : pos.top,
            bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxHeight,
          }}
        >
          <div className="relative border-b border-[var(--erp-border)] p-1.5">
            <Search size={12} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-erp-text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onSearchKey}
              placeholder={searchPlaceholder}
              className="erp-input w-full !py-1 !pl-7 !text-[11px]"
              aria-label="Filter options"
            />
          </div>
          <ul
            role="listbox"
            className="overflow-y-auto py-0.5"
            style={{ maxHeight: Math.max(80, pos.maxHeight - 44) }}
          >
            {allowClear && value && !query.trim() && (
              <li>
                <button
                  type="button"
                  className="flex w-full px-2.5 py-1.5 text-left text-[11px] text-erp-text-muted hover:bg-[var(--erp-surface-muted)]"
                  onClick={() => pick(null)}
                >
                  {placeholder}
                </button>
              </li>
            )}
            {filtered.length === 0 && (
              <li className="px-2.5 py-2 text-[11px] text-erp-text-muted">{emptyText}</li>
            )}
            {filtered.map((opt, i) => {
              const on = opt.value === value;
              const hi = i === safeHighlight;
              return (
                <li key={opt.value}>
                  <button
                    ref={(el) => { itemRefs.current[i] = el; }}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11px] ${
                      hi ? 'bg-[var(--erp-accent-muted)]/40' : 'hover:bg-[var(--erp-surface-muted)]'
                    } ${on ? 'text-[var(--erp-accent)]' : 'text-erp-text-primary'}`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(opt)}
                  >
                    <span className="min-w-0 truncate">{opt.label}</span>
                    {on && <Check size={12} className="shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
