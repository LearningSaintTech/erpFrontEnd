import {
  cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Tooltip } from './Tooltip';

export interface DropdownActionItem {
  type?: 'item';
  label: ReactNode;
  icon?: LucideIcon;
  onSelect?: () => void;
  /** Red text — destructive actions. Pair with useConfirm(). */
  danger?: boolean;
  disabled?: boolean;
  /** Shown as a tooltip when disabled — say *why*, e.g. "Approve the BOM first". */
  disabledReason?: ReactNode;
  /** Right-aligned hint, e.g. keyboard shortcut. */
  shortcut?: string;
  /** Hide the item entirely (handy for permission checks inline). */
  hidden?: boolean;
}

export type DropdownMenuItem =
  | DropdownActionItem
  | { type: 'separator'; hidden?: boolean }
  | { type: 'label'; label: ReactNode; hidden?: boolean };

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  /** Trigger element (a button). Defaults to a "⋯" icon button. */
  trigger?: ReactElement;
  /** aria-label for the default trigger. */
  label?: string;
  align?: 'start' | 'end';
  /** Stop click propagation from trigger/menu (default true) so table row onClick doesn't fire. */
  stopPropagation?: boolean;
  className?: string;
  /** Size of the default trigger. */
  size?: 'sm' | 'md';
}

type ActionItem = DropdownActionItem;
const isAction = (i: DropdownMenuItem): i is ActionItem => !i.type || i.type === 'item';

/**
 * Accessible menu button for row "⋯" overflow actions and header menus.
 * Keyboard: Enter/Space/↓ opens, ↑/↓/Home/End move, Enter selects, Esc closes, Tab closes.
 *
 *   <DropdownMenu items={[
 *     { label: 'Edit', icon: Pencil, onSelect: edit },
 *     { label: 'Release', icon: Send, disabled: !canRelease, disabledReason: 'Approve the BOM first' },
 *     { type: 'separator' },
 *     { label: 'Delete', icon: Trash2, danger: true, onSelect: remove },
 *   ]} />
 */
export function DropdownMenu({
  items, trigger, label = 'More actions', align = 'end', stopPropagation = true, className = '', size = 'sm',
}: DropdownMenuProps) {
  const menuId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const visible = items.filter((i) => !i.hidden);
  const actionIdx = visible.map((i, idx) => (isAction(i) ? idx : -1)).filter((i) => i >= 0);

  const triggerEl = () => wrapRef.current?.querySelector<HTMLElement>('button,[role="button"],a') || wrapRef.current;

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setPos(null);
    setActive(-1);
    if (refocus) triggerEl()?.focus();
  }, []);

  const openMenu = (focusLast = false) => {
    setOpen(true);
    setActive(focusLast ? actionIdx[actionIdx.length - 1] ?? -1 : actionIdx[0] ?? -1);
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const t = wrapRef.current?.getBoundingClientRect();
      const m = menuRef.current?.getBoundingClientRect();
      if (!t || !m) return;
      let left = align === 'end' ? t.right - m.width : t.left;
      left = Math.max(8, Math.min(left, window.innerWidth - m.width - 8));
      let top = t.bottom + 4;
      if (top + m.height > window.innerHeight - 8 && t.top - m.height - 4 > 8) top = t.top - m.height - 4;
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  useEffect(() => {
    if (open && active >= 0) itemRefs.current[active]?.focus({ preventScroll: true });
  }, [open, active, pos]);

  const move = (dir: 1 | -1) => {
    if (!actionIdx.length) return;
    const cur = actionIdx.indexOf(active);
    const next = cur < 0 ? (dir === 1 ? 0 : actionIdx.length - 1) : (cur + dir + actionIdx.length) % actionIdx.length;
    setActive(actionIdx[next]);
  };

  const select = (item: ActionItem) => {
    if (item.disabled) return;
    close(true);
    item.onSelect?.();
  };

  const onMenuKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Home': e.preventDefault(); setActive(actionIdx[0] ?? -1); break;
      case 'End': e.preventDefault(); setActive(actionIdx[actionIdx.length - 1] ?? -1); break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(true); break;
      case 'Tab': close(false); break;
      default: {
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const k = e.key.toLowerCase();
          const start = actionIdx.indexOf(active);
          const order = [...actionIdx.slice(start + 1), ...actionIdx.slice(0, start + 1)];
          const hit = order.find((i) => {
            const it = visible[i];
            return isAction(it) && typeof it.label === 'string' && it.label.toLowerCase().startsWith(k);
          });
          if (hit != null) setActive(hit);
        }
      }
    }
  };

  const stop = (e: ReactMouseEvent | KeyboardEvent) => { if (stopPropagation) e.stopPropagation(); };

  const defaultTrigger = (
    <button
      type="button"
      className={`erp-icon-btn${size === 'sm' ? ' erp-btn-sm' : ''}`}
      aria-label={label}
      title={label}
    >
      <MoreHorizontal size={18} />
    </button>
  );
  const base = isValidElement(trigger) ? trigger : defaultTrigger;
  const triggerNode = cloneElement(base as ReactElement<Record<string, unknown>>, {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: (e: ReactMouseEvent) => {
      stop(e);
      (base.props as { onClick?: (ev: ReactMouseEvent) => void }).onClick?.(e);
      if (open) close(false); else openMenu();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        stop(e);
        openMenu(e.key === 'ArrowUp');
      }
    },
  });

  return (
    <span
      ref={wrapRef}
      className={`inline-flex ${className}`.trim()}
      onClick={stop}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') stop(e); }}
    >
      {triggerNode}
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className="erp-menu"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
          onKeyDown={onMenuKey}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {visible.map((item, idx) => {
            if (item.type === 'separator') return <div key={`s${idx}`} role="separator" className="erp-menu-separator" />;
            if (item.type === 'label') return <div key={`l${idx}`} className="erp-menu-label">{item.label}</div>;
            const Icon = item.icon;
            const reason = item.disabled && item.disabledReason ? item.disabledReason : null;
            const btn = (
              <button
                key={`i${idx}`}
                ref={(el) => { itemRefs.current[idx] = el; }}
                type="button"
                role="menuitem"
                tabIndex={active === idx ? 0 : -1}
                aria-disabled={item.disabled || undefined}
                data-highlighted={active === idx ? 'true' : undefined}
                className={`erp-menu-item${item.danger ? ' erp-menu-item-danger' : ''}${reason ? ' !items-start' : ''}`}
                onMouseEnter={() => setActive(idx)}
                onClick={() => select(item)}
              >
                {Icon && <Icon size={16} aria-hidden="true" className={reason ? 'mt-0.5' : undefined} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {/* Disabled reason is always visible (and read by screen readers) — never a dead end. */}
                  {reason && <span className="mt-0.5 block text-xs leading-4 text-erp-text-muted">{reason}</span>}
                </span>
                {item.shortcut && <span className="ml-3 text-xs text-erp-text-muted">{item.shortcut}</span>}
              </button>
            );
            if (reason) {
              return (
                <Tooltip key={`i${idx}`} content={reason} side="left" delay={400} className="flex w-full">
                  {btn}
                </Tooltip>
              );
            }
            return btn;
          })}
        </div>,
        document.body,
      )}
    </span>
  );
}

/** Convenience: "⋯" overflow menu for table rows (stops row click). */
export function RowActionsMenu({ items, label = 'More actions' }: { items: DropdownMenuItem[]; label?: string }) {
  if (!items.some((i) => !i.hidden && (!i.type || i.type === 'item'))) return null;
  return <DropdownMenu items={items} label={label} size="sm" />;
}
