import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, GripVertical, ChevronRight } from 'lucide-react';
import { useChat } from '../../app/providers/ChatProvider';

const STORAGE_KEY_Y = 'erp_chat_fab_pos_y';
const STORAGE_KEY_MINIMIZED = 'erp_chat_fab_minimized';

export function ChatFab() {
  const { canChat, openChat, panelOpen, unreadTotal } = useChat();

  // Position from bottom in px (default 108px to sit well clear of bottom pagination bars)
  const [bottomY, setBottomY] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_Y);
      if (saved) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed) && parsed >= 40 && parsed <= window.innerHeight - 120) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return 108; // default 108px from bottom (clears 48-60px table pagination completely)
  });

  const [minimized, setMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_MINIMIZED) === 'true';
    } catch {
      return false;
    }
  });

  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const initialBottomRef = useRef(0);
  const hasMovedRef = useRef(false);
  const fabRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startYRef.current = e.clientY;
    initialBottomRef.current = bottomY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [bottomY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY; // moving mouse up increases bottom distance
    if (Math.abs(deltaY) > 4) {
      hasMovedRef.current = true;
    }
    const maxBottom = window.innerHeight - 120;
    const minBottom = 80; // keep it at least 80px above screen bottom so it never covers pagination
    const newBottom = Math.max(minBottom, Math.min(maxBottom, initialBottomRef.current + deltaY));
    setBottomY(newBottom);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

    if (hasMovedRef.current) {
      try {
        localStorage.setItem(STORAGE_KEY_Y, String(Math.round(bottomY)));
      } catch {
        // ignore
      }
    }
  }, [bottomY]);

  const handleClick = useCallback(() => {
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    openChat();
  }, [openChat]);

  const toggleMinimized = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_MINIMIZED, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    // Keep clamped on window resize
    const handleResize = () => {
      setBottomY((curr) => {
        const maxBottom = window.innerHeight - 120;
        const minBottom = 80;
        return Math.max(minBottom, Math.min(maxBottom, curr));
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!canChat || panelOpen) return null;

  return createPortal(
    <div className="chat-fab-root pointer-events-none fixed inset-0 z-[9990] select-none">
      <div
        ref={fabRef}
        className="pointer-events-auto absolute right-4 md:right-6 transition-[right] duration-200"
        style={{ bottom: `${bottomY}px` }}
      >
        {minimized ? (
          /* Minimized edge tab */
          <div
            className="group flex cursor-pointer items-center rounded-l-full border border-r-0 border-[var(--erp-border,#cbd5e1)] bg-[var(--erp-surface,#fff)] py-1.5 pl-2.5 pr-1.5 shadow-lg transition-all duration-200 hover:scale-105 hover:bg-slate-50"
            onClick={handleClick}
            title="Open messages (Click to expand)"
            role="button"
            tabIndex={0}
          >
            <div className="relative flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-[var(--erp-accent,#3b82f6)]" />
              {unreadTotal > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                  {unreadTotal > 9 ? '9+' : unreadTotal}
                </span>
              )}
            </div>
            <button
              type="button"
              className="ml-1 text-slate-400 hover:text-slate-600"
              onClick={toggleMinimized}
              title="Expand chat button"
              aria-label="Expand chat button"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            </button>
          </div>
        ) : (
          /* Full floating button with drag affordance & elevated clearance */
          <div className="relative flex items-center">
            {/* Drag handle */}
            <div
              className="mr-1 hidden cursor-grab rounded bg-slate-800/60 p-1 text-slate-300 opacity-0 shadow backdrop-blur transition-opacity active:cursor-grabbing group-hover:opacity-100 sm:block"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              title="Drag up or down to reposition"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>

            <button
              type="button"
              className="chat-fab-btn group relative flex h-12 w-12 md:h-13 md:w-13 cursor-grab items-center justify-center rounded-full text-white shadow-xl transition-all duration-200 active:cursor-grabbing hover:scale-105 hover:shadow-2xl active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--erp-accent,#3b82f6)]"
              style={{
                backgroundColor: 'var(--erp-accent, #3b82f6)',
                boxShadow: '0 8px 24px color-mix(in srgb, var(--erp-accent, #3b82f6) 40%, transparent)',
              }}
              title={unreadTotal > 0 ? `${unreadTotal} unread messages · Drag to move` : 'Messages · Drag up/down to move'}
              aria-label={`Open messages${unreadTotal ? `, ${unreadTotal} unread` : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={handleClick}
            >
              <MessageSquare className="h-5 w-5" strokeWidth={2.2} />

              {unreadTotal > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
                  {unreadTotal > 9 ? '9+' : unreadTotal}
                </span>
              )}

              {/* Hover tooltip */}
              <span
                className="pointer-events-none absolute right-full mr-3 hidden origin-right scale-95 whitespace-nowrap rounded-lg border border-[var(--erp-border,#e2e8f0)] bg-[var(--erp-surface,#fff)] px-2.5 py-1 text-[11px] font-medium text-[var(--erp-text-primary,#0f172a)] opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 sm:block"
                aria-hidden
              >
                {unreadTotal > 0 ? `${unreadTotal} unread · Click to chat (drag to move)` : 'Messages (drag to move)'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
