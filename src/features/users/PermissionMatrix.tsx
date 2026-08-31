import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ErpInput } from '../../components/erp';
import { groupPermissions } from './userUtils';

interface PermissionMatrixProps {
  catalog: string[];
  selected: string[];
  onChange: (permissions: string[]) => void;
  readOnly?: boolean;
  searchable?: boolean;
  compact?: boolean;
}

export function PermissionMatrix({
  catalog, selected, onChange, readOnly, searchable = true, compact,
}: PermissionMatrixProps) {
  const [filter, setFilter] = useState('');

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? catalog.filter((c) => c.toLowerCase().includes(q))
      : catalog;
    return groupPermissions(filtered);
  }, [catalog, filter]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (code: string) => {
    if (readOnly) return;
    if (selectedSet.has(code)) {
      onChange(selected.filter((p) => p !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const toggleModule = (mod: string, actions: string[]) => {
    if (readOnly) return;
    const codes = actions.map((a) => `${mod}.${a}`);
    const allOn = codes.every((c) => selectedSet.has(c));
    if (allOn) {
      onChange(selected.filter((p) => !codes.includes(p)));
    } else {
      const merged = new Set([...selected, ...codes]);
      onChange([...merged]);
    }
  };

  return (
    <div className="space-y-2">
      {searchable && !readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
            <ErpInput
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter modules or actions…"
              className="!py-1 !pl-7 !text-[11px] w-full"
            />
          </div>
          <span className="text-[10px] text-erp-text-muted">{selected.length} selected</span>
        </div>
      )}
      {readOnly && (
        <p className="text-[10px] text-erp-text-muted">{selected.length} permissions enabled</p>
      )}
      <div className={`grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {groups.length === 0 ? (
          <p className="col-span-full text-[11px] text-erp-text-muted">No permissions match your filter.</p>
        ) : groups.map(([mod, actions]) => {
          const codes = actions.map((a) => `${mod}.${a}`);
          const onCount = codes.filter((c) => selectedSet.has(c)).length;
          const allOn = onCount === codes.length && codes.length > 0;
          return (
            <div
              key={mod}
              className={`rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] p-2 transition-colors ${
                allOn && !readOnly ? 'border-[var(--erp-accent)]/40' : ''
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleModule(mod, actions)}
                  className="font-mono text-[10px] font-semibold uppercase text-erp-text-secondary disabled:cursor-default hover:text-erp-text-primary"
                  title={readOnly ? undefined : 'Toggle all in module'}
                >
                  {mod}
                </button>
                <span className={`text-[10px] ${onCount > 0 ? 'text-[var(--erp-accent)]' : 'text-erp-text-muted'}`}>
                  {onCount}/{codes.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {actions.map((action) => {
                  const code = `${mod}.${action}`;
                  const on = selectedSet.has(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggle(code)}
                      title={code}
                      className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                        on
                          ? 'bg-[var(--erp-accent)]/20 font-medium text-[var(--erp-accent)]'
                          : 'bg-[var(--erp-surface-muted)] text-erp-text-muted hover:text-erp-text-secondary'
                      } disabled:cursor-default`}
                    >
                      {action}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
