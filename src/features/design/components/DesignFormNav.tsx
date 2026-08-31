import { Check } from 'lucide-react';
import type { DesignTabProgress, TabGroupId, TabId } from '../designFormUtils';

type NavTab = { id: string; label: string; hint?: string };
type NavGroup = { id: string; label: string; description: string; tabs: readonly NavTab[] };

type Props = {
  groups: readonly NavGroup[];
  activeGroup: TabGroupId;
  activeTab: TabId;
  progress: Partial<Record<TabId, DesignTabProgress>>;
  onGroupChange: (groupId: TabGroupId) => void;
  onTabChange: (tabId: TabId) => void;
};

export function DesignFormNav({
  groups,
  activeGroup,
  activeTab,
  progress,
  onGroupChange,
  onTabChange,
}: Props) {
  const current = groups.find((g) => g.id === activeGroup) ?? groups[0];
  const showSubnav = (current?.tabs.length ?? 0) > 1;
  const activeTabMeta = current?.tabs.find((t) => t.id === activeTab);

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-[var(--erp-border)] bg-[var(--erp-surface)]">
      <div className="flex flex-wrap gap-1 border-b border-[var(--erp-border)] p-2 sm:p-2.5">
        {groups.map((group, i) => {
          const isActive = group.id === activeGroup;
          const groupDone = group.tabs.every((t) => progress[t.id as TabId] !== 'needed');
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onGroupChange(group.id as TabGroupId)}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left transition sm:px-3 ${
                isActive
                  ? 'bg-[var(--erp-accent-muted)] text-[var(--erp-accent)]'
                  : 'text-erp-text-muted hover:bg-[var(--erp-surface-muted)] hover:text-erp-text-primary'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  isActive
                    ? 'bg-[var(--erp-accent)] text-white'
                    : groupDone
                      ? 'bg-emerald-500/15 text-emerald-700'
                      : 'bg-[var(--erp-surface-muted)] text-erp-text-muted'
                }`}
              >
                {groupDone && !isActive ? <Check size={12} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold leading-tight">{group.label}</span>
                <span className="mt-0.5 hidden truncate text-[10px] opacity-80 sm:block">{group.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {showSubnav && (
        <div className="flex flex-wrap items-stretch gap-1 bg-[var(--erp-surface-muted)]/50 px-2 py-2 sm:px-3">
          {current.tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const state = progress[tab.id as TabId] ?? 'optional';
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id as TabId)}
                className={`rounded-lg px-3 py-1.5 text-left transition ${
                  isActive
                    ? 'bg-[var(--erp-surface)] text-erp-text-primary shadow-sm ring-1 ring-[var(--erp-accent)]'
                    : 'text-erp-text-muted hover:bg-[var(--erp-surface)]/80 hover:text-erp-text-primary'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium">
                  {tab.label}
                  {state === 'done' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Complete" />
                  )}
                  {state === 'needed' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Still needed" />
                  )}
                </span>
                {'hint' in tab && tab.hint && (
                  <span className={`mt-0.5 block text-[10px] ${isActive ? 'text-erp-text-muted' : 'opacity-70'}`}>
                    {tab.hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeTabMeta && (
        <div className="border-t border-[var(--erp-border)] px-3 py-2">
          <p className="text-[11px] font-semibold text-erp-text-primary">
            {current.label}
            <span className="mx-1.5 text-erp-text-muted">/</span>
            {activeTabMeta.label}
          </p>
          {'hint' in activeTabMeta && activeTabMeta.hint && (
            <p className="text-[10px] text-erp-text-muted">{activeTabMeta.hint}</p>
          )}
        </div>
      )}
    </div>
  );
}
