import {
  useId, useLayoutEffect, useRef, type ReactNode, type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/* ───────────────────────── shared overlay plumbing ───────────────────────── */

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => !el.hasAttribute('inert') && el.getClientRects().length > 0);
}

/** Stack of open overlays so Esc / focus trap only act on the topmost one. */
const overlayStack: string[] = [];
let scrollLocks = 0;
let savedOverflow = '';
let savedPaddingRight = '';

function lockScroll() {
  if (scrollLocks === 0) {
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
  }
  scrollLocks += 1;
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

export function isTopOverlay(id: string) {
  return overlayStack[overlayStack.length - 1] === id;
}

/**
 * Focus trap + Esc + body scroll lock + focus restore for a dialog-like panel.
 * Exported so custom overlays (command palette, mobile nav) behave the same.
 */
export function useOverlayBehavior({
  open,
  panelRef,
  onClose,
  closeOnEsc = true,
  initialFocusRef,
}: {
  open: boolean;
  panelRef: RefObject<HTMLElement>;
  onClose: () => void;
  closeOnEsc?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
}) {
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Remember the opener during the render that opens the overlay — before commit. Children with
  // autoFocus grab focus in the layout phase *before* this hook's layout effect runs, so reading
  // document.activeElement in the effect would capture an element inside the panel and focus
  // could never be restored to the trigger on close.
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  if (open && !wasOpenRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement as HTMLElement | null;
  }
  wasOpenRef.current = open;

  useLayoutEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement as HTMLElement | null;
    const previouslyFocused = openerRef.current && openerRef.current !== document.body
      ? openerRef.current
      : (active && !panelRef.current?.contains(active) ? active : null);
    overlayStack.push(id);
    lockScroll();

    // Initial focus: explicit ref → [data-autofocus] → first focusable (skipping the close button) → panel.
    const focusInitial = () => {
      const panel = panelRef.current;
      if (!panel) return;
      if (panel.contains(document.activeElement)) return; // child used autoFocus
      // A dropdown inside the panel renders its search box in a portal: don't pull focus back.
      if ((document.activeElement as HTMLElement | null)?.closest('[data-overlay-popover]')) return;
      const explicit = initialFocusRef?.current
        || panel.querySelector<HTMLElement>('[data-autofocus]');
      const list = focusables(panel).filter((el) => !el.hasAttribute('data-overlay-close'));
      (explicit || list[0] || panel).focus({ preventScroll: true });
    };
    focusInitial();
    // Content rendered a frame later (lazy children) — try again.
    const raf = window.requestAnimationFrame(focusInitial);

    const onKey = (e: KeyboardEvent) => {
      if (!isTopOverlay(id)) return;
      const panel = panelRef.current;
      if (!panel) return;
      if (e.key === 'Escape' && closeOnEsc) {
        // Let open popovers (menus, search selects) inside handle Esc first.
        if (e.defaultPrevented) return;
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const list = focusables(panel);
        if (list.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !panel.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      const idx = overlayStack.lastIndexOf(id);
      if (idx >= 0) overlayStack.splice(idx, 1);
      unlockScroll();
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, id, panelRef, closeOnEsc, initialFocusRef]);
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="erp-icon-btn erp-btn-sm -mr-1.5 -mt-1 shrink-0"
      onClick={onClick}
      aria-label="Close"
      data-overlay-close=""
    >
      <X size={18} />
    </button>
  );
}

interface OverlayHeaderProps {
  title?: ReactNode;
  description?: ReactNode;
  titleId: string;
  descId: string;
  onClose: () => void;
  hideClose?: boolean;
  headerExtra?: ReactNode;
}

function OverlayHeader({ title, description, titleId, descId, onClose, hideClose, headerExtra }: OverlayHeaderProps) {
  if (!title && !description && hideClose) return null;
  return (
    <div className="erp-overlay-header">
      <div className="min-w-0 flex-1">
        {title && <h2 id={titleId} className="erp-overlay-title">{title}</h2>}
        {description && <p id={descId} className="erp-overlay-description">{description}</p>}
        {headerExtra}
      </div>
      {!hideClose && <CloseButton onClick={onClose} />}
    </div>
  );
}

/* ───────────────────────────────── Modal ───────────────────────────────── */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const MODAL_WIDTH: Record<ModalSize, string> = {
  sm: 'max-w-[400px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[760px]',
  xl: 'max-w-[1040px]',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  /** Footer actions (right-aligned). Typically Cancel + primary. */
  footer?: ReactNode;
  children?: ReactNode;
  /** Close when clicking the dimmed backdrop (default true). Set false for forms with unsaved input. */
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  hideCloseButton?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  /** Remove body padding (e.g. full-bleed tables/images). */
  flush?: boolean;
  className?: string;
  /** role="alertdialog" for confirmations. */
  role?: 'dialog' | 'alertdialog';
}

/**
 * Centered dialog. Portal, focus trap, Esc closes, restores focus, scroll lock.
 *
 *   <Modal open={open} onClose={close} title="Edit vendor" footer={<>…buttons…</>}>…</Modal>
 */
export function Modal({
  open, onClose, title, description, size = 'md', footer, children,
  closeOnOverlayClick = true, closeOnEsc = true, hideCloseButton, initialFocusRef, flush, className = '',
  role = 'dialog',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useOverlayBehavior({ open, panelRef, onClose, closeOnEsc, initialFocusRef });
  if (!open) return null;
  return createPortal(
    <>
      <div className="erp-overlay-backdrop" aria-hidden="true" />
      <div
        className="erp-overlay-layer flex items-end justify-center overflow-y-auto p-4 sm:items-center"
        onMouseDown={(e) => {
          if (closeOnOverlayClick && e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={panelRef}
          role={role}
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={`erp-modal ${MODAL_WIDTH[size]} focus:outline-none ${className}`.trim()}
        >
          <OverlayHeader
            title={title}
            description={description}
            titleId={titleId}
            descId={descId}
            onClose={onClose}
            hideClose={hideCloseButton}
          />
          {children != null && <div className={flush ? 'min-h-0 flex-1 overflow-y-auto' : 'erp-overlay-body'}>{children}</div>}
          {footer && <div className="erp-overlay-footer">{footer}</div>}
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ───────────────────────────────── Drawer ──────────────────────────────── */

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl';

const DRAWER_WIDTH: Record<DrawerSize, string> = {
  sm: 'sm:max-w-[400px]',
  md: 'sm:max-w-[560px]',
  lg: 'sm:max-w-[720px]',
  xl: 'sm:max-w-[960px]',
};

export interface DrawerProps extends Omit<ModalProps, 'size' | 'role'> {
  size?: DrawerSize;
  /** Extra content under the title (badges, meta line, tabs). */
  headerExtra?: ReactNode;
}

/**
 * Right-side panel for create/edit forms and record details.
 * Header (title/description/close) · scrollable body · sticky footer.
 *
 *   <Drawer open={open} onClose={close} title="New purchase requisition" size="lg"
 *     footer={<><Button variant="secondary" onClick={close}>Cancel</Button>
 *              <Button type="submit" form="pr-form" loading={save.isPending}>Save</Button></>}>
 *     <form id="pr-form" onSubmit={…}>…</form>
 *   </Drawer>
 */
export function Drawer({
  open, onClose, title, description, size = 'md', footer, children,
  closeOnOverlayClick = true, closeOnEsc = true, hideCloseButton, initialFocusRef, flush, className = '',
  headerExtra,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useOverlayBehavior({ open, panelRef, onClose, closeOnEsc, initialFocusRef });

  if (!open) return null;
  return createPortal(
    <>
      <div
        className="erp-overlay-backdrop"
        aria-hidden="true"
        onMouseDown={() => { if (closeOnOverlayClick) onClose(); }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`erp-drawer ${DRAWER_WIDTH[size]} focus:outline-none ${className}`.trim()}
      >
        <OverlayHeader
          title={title}
          description={description}
          titleId={titleId}
          descId={descId}
          onClose={onClose}
          hideClose={hideCloseButton}
          headerExtra={headerExtra}
        />
        <div className={flush ? 'min-h-0 flex-1 overflow-y-auto' : 'erp-overlay-body'}>{children}</div>
        {footer && <div className="erp-overlay-footer">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
