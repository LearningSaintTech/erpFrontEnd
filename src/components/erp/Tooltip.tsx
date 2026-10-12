import {
  cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  /** ms before showing on hover (focus shows immediately). */
  delay?: number;
  disabled?: boolean;
  /** Extra classes for the inline wrapper span. */
  className?: string;
}

/**
 * Lightweight accessible tooltip. Shows on hover (with delay) and keyboard focus,
 * hides on Esc / blur / leave. Rendered in a portal so it is never clipped.
 * The trigger gets `aria-describedby` while the tooltip is open.
 */
export function Tooltip({ content, children, side = 'top', delay = 350, disabled, className = '' }: TooltipProps) {
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback((immediate = false) => {
    if (disabled || content == null || content === '') return;
    window.clearTimeout(timer.current);
    if (immediate) setOpen(true);
    else timer.current = window.setTimeout(() => setOpen(true), delay);
  }, [content, delay, disabled]);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setPos(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    const onScroll = () => hide();
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, hide]);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = wrapRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const r = trigger.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 6;
    let top = 0;
    let left = 0;
    let s = side;
    if (s === 'top' && r.top - t.height - gap < 4) s = 'bottom';
    if (s === 'bottom' && r.bottom + t.height + gap > window.innerHeight - 4) s = 'top';
    if (s === 'right' && r.right + t.width + gap > window.innerWidth - 4) s = 'left';
    if (s === 'left' && r.left - t.width - gap < 4) s = 'right';
    if (s === 'top' || s === 'bottom') {
      top = s === 'top' ? r.top - t.height - gap : r.bottom + gap;
      left = r.left + r.width / 2 - t.width / 2;
    } else {
      top = r.top + r.height / 2 - t.height / 2;
      left = s === 'left' ? r.left - t.width - gap : r.right + gap;
    }
    left = Math.max(4, Math.min(left, window.innerWidth - t.width - 4));
    top = Math.max(4, Math.min(top, window.innerHeight - t.height - 4));
    setPos({ top, left });
  }, [open, side, content]);

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
      'aria-describedby': open ? id : (children as ReactElement<{ 'aria-describedby'?: string }>).props['aria-describedby'],
    })
    : children;

  return (
    <>
      <span
        ref={wrapRef}
        className={`inline-flex max-w-full ${className}`.trim()}
        onMouseEnter={() => show()}
        onMouseLeave={hide}
        onFocus={(e) => {
          // Only keyboard focus (focus-visible) shows instantly.
          const target = e.target as HTMLElement;
          if (target.matches?.(':focus-visible')) show(true);
        }}
        onBlur={hide}
        onPointerDown={hide}
      >
        {child}
      </span>
      {open && createPortal(
        <div
          ref={tipRef}
          id={id}
          role="tooltip"
          className="erp-tooltip"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
