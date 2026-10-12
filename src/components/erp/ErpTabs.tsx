import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface ErpTab {
  readonly id: string;
  readonly label: ReactNode;
  /** Optional count pill, e.g. pending items. Hidden when undefined/null. */
  readonly count?: number | null;
  readonly disabled?: boolean;
}

interface ErpTabsProps {
  tabs: readonly ErpTab[];
  active: string;
  onChange: (id: string) => void;
  /** Accessible name for the tab list. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Underline tabs. Scrolls horizontally on small screens. Arrow keys move between tabs.
 * Tabs switch content in place; they are buttons with role="tab".
 */
export function ErpTabs({ tabs, active, onChange, ariaLabel, className = '' }: ErpTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: KeyboardEvent, idx: number) => {
    const enabled = tabs.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(idx);
    let next = -1;
    if (e.key === 'ArrowRight') next = enabled[(pos + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next >= 0) {
      e.preventDefault();
      refs.current[next]?.focus();
      onChange(tabs[next].id);
    }
  };

  const hasActive = tabs.some((t) => t.id === active);

  return (
    <div className={`erp-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, idx) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => { refs.current[idx] = el; }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on || (!hasActive && idx === 0) ? 0 : -1}
            disabled={tab.disabled}
            className={`erp-tab${on ? ' erp-tab-active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKey(e, idx)}
          >
            {tab.label}
            {tab.count != null && <span className="erp-count-pill">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Alias for new code. */
export const Tabs = ErpTabs;
