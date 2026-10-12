import { Check } from 'lucide-react';
import type { DesignTabProgress, TabGroupId, TabId } from '../designFormUtils';

type NavTab = { id: string; label: string; hint?: string };
type NavGroup = { id: string; label: string; description: string; tabs: readonly NavTab[] };

type Props = {
  groups: readonly NavGroup[];
  activeTab: TabId;
  progress: Partial<Record<TabId, DesignTabProgress>>;
  /** Show done / needed markers (only while the designer is editing). */
  showProgress: boolean;
  onSelect: (groupId: TabGroupId, tabId: TabId) => void;
};

function Marker({ state }: { state: DesignTabProgress }) {
  if (state === 'done') {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--erp-success-solid)] text-white" aria-label="Complete">
        <Check size={10} strokeWidth={3} />
      </span>
    );
  }
  if (state === 'needed') {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-label="Still needed">
        <span className="h-2 w-2 rounded-full bg-[var(--erp-warning-solid)]" />
      </span>
    );
  }
  return <span className="h-4 w-4 shrink-0" aria-hidden />;
}

/**
 * Section navigation for the design tech pack: a vertical list on desktop
 * (grouped, with completion markers) and a scrollable pill row on phones.
 */
export function DesignFormNav({ groups, activeTab, progress, showProgress, onSelect }: Props) {
  const flat = groups.flatMap((g) => g.tabs.map((t) => ({ group: g, tab: t })));

  return (
    <>
      {/* Phones / tablets: horizontal pills */}
      <nav aria-label="Tech pack sections" className="erp-hide-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
        {flat.map(({ group, tab }) => {
          const active = tab.id === activeTab;
          const state = progress[tab.id as TabId] ?? 'optional';
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(group.id as TabGroupId, tab.id as TabId)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                active
                  ? 'border-[var(--erp-accent)] bg-[var(--erp-accent-muted)] text-[var(--erp-accent-text)]'
                  : 'border-[var(--erp-border)] bg-[var(--erp-surface)] text-erp-text-secondary'
              }`}
            >
              {showProgress && state !== 'optional' && <Marker state={state} />}
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Desktop: vertical list */}
      <nav aria-label="Tech pack sections" className="hidden lg:block">
        <div className="sticky top-4 space-y-4">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="mb-1 px-2 text-xs font-medium text-erp-text-muted">{group.label}</p>
              <ul className="space-y-0.5">
                {group.tabs.map((tab) => {
                  const active = tab.id === activeTab;
                  const state = progress[tab.id as TabId] ?? 'optional';
                  return (
                    <li key={tab.id}>
                      <button
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => onSelect(group.id as TabGroupId, tab.id as TabId)}
                        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition ${
                          active
                            ? 'bg-[var(--erp-accent-muted)] text-[var(--erp-accent-text)]'
                            : 'text-erp-text-secondary hover:bg-[var(--erp-surface-muted)] hover:text-erp-text-primary'
                        }`}
                      >
                        <span className="mt-0.5">{showProgress ? <Marker state={state} /> : <span className="block h-4 w-1" />}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-5">{tab.label}</span>
                          {tab.hint && <span className="block truncate text-xs text-erp-text-muted">{tab.hint}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
