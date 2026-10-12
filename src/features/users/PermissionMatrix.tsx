import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Badge, Button, EmptyState, SearchInput } from '../../components/erp';
import { groupPermissions, moduleLabel, permissionActionLabel } from './userUtils';

interface PermissionMatrixProps {
  catalog: string[];
  selected: string[];
  onChange: (permissions: string[]) => void;
  readOnly?: boolean;
  searchable?: boolean;
  /** Narrow layout (e.g. inside a drawer next to other fields). */
  compact?: boolean;
}

function TriCheckbox({
  checked, indeterminate, disabled, onChange, label,
}: { checked: boolean; indeterminate: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--erp-accent)] disabled:cursor-default"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
    />
  );
}

/**
 * Permission editor grouped by module. Each module row has a select-all checkbox and one
 * toggle per action. Read-only mode shows the same layout without controls.
 */
export function PermissionMatrix({
  catalog, selected, onChange, readOnly, searchable = true,
}: PermissionMatrixProps) {
  const [filter, setFilter] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = catalog;
    if (q) {
      list = list.filter((c) => {
        const mod = c.split('.')[0];
        return c.toLowerCase().includes(q) || moduleLabel(mod).toLowerCase().includes(q);
      });
    }
    if (onlySelected || readOnly) list = list.filter((c) => selectedSet.has(c));
    return groupPermissions(list);
  }, [catalog, filter, onlySelected, readOnly, selectedSet]);

  const moduleTotals = useMemo(
    () => Object.fromEntries(groupPermissions(catalog).map(([mod, actions]) => [mod, actions.length])),
    [catalog],
  );

  const toggle = (code: string) => {
    if (readOnly) return;
    onChange(selectedSet.has(code) ? selected.filter((p) => p !== code) : [...selected, code]);
  };

  const toggleModule = (mod: string, actions: string[]) => {
    if (readOnly) return;
    const codes = actions.map((a) => `${mod}.${a}`);
    const allOn = codes.every((c) => selectedSet.has(c));
    if (allOn) onChange(selected.filter((p) => !codes.includes(p)));
    else onChange([...new Set([...selected, ...codes])]);
  };

  const visibleCodes = groups.flatMap(([mod, actions]) => actions.map((a) => `${mod}.${a}`));

  return (
    <div className="space-y-3">
      {(searchable || !readOnly) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="w-full min-w-0 sm:w-64">
              <SearchInput value={filter} onChange={setFilter} placeholder="Find a module or action…" inputSize="sm" />
            </div>
          )}
          {!readOnly && (
            <>
              <label className="flex items-center gap-2 text-[13px] text-erp-text-secondary">
                <input type="checkbox" className="h-4 w-4 rounded accent-[var(--erp-accent)]" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
                Only granted
              </label>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={visibleCodes.length === 0}
                  onClick={() => onChange([...new Set([...selected, ...visibleCodes])])}
                >
                  Grant all shown
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={selected.length === 0}
                  onClick={() => onChange(selected.filter((p) => !visibleCodes.includes(p)))}
                >
                  Clear shown
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      <p className="text-xs text-erp-text-muted">
        {selected.length.toLocaleString()} of {catalog.length.toLocaleString()} permissions granted
      </p>

      {groups.length === 0 ? (
        <EmptyState
          compact
          title={readOnly ? 'No permissions granted' : 'No permissions match'}
          description={readOnly ? undefined : 'Try a different search.'}
        />
      ) : (
        <ul className="divide-y divide-[var(--erp-border)] rounded-lg border border-[var(--erp-border)]">
          {groups.map(([mod, actions]) => {
            const codes = actions.map((a) => `${mod}.${a}`);
            const onCount = codes.filter((c) => selectedSet.has(c)).length;
            const allOn = onCount === codes.length && codes.length > 0;
            return (
              <li key={mod} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start">
                <div className="flex w-full shrink-0 items-center gap-2 sm:w-48">
                  {!readOnly && (
                    <TriCheckbox
                      checked={allOn}
                      indeterminate={onCount > 0 && !allOn}
                      onChange={() => toggleModule(mod, actions)}
                      label={`Select all ${moduleLabel(mod)} permissions`}
                    />
                  )}
                  <span className="text-[13px] font-semibold text-erp-text-primary">{moduleLabel(mod)}</span>
                  <Badge dot={false} tone={onCount > 0 ? 'info' : 'neutral'} className="ml-auto sm:ml-1">{onCount}/{moduleTotals[mod] ?? codes.length}</Badge>
                </div>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {actions.map((action) => {
                    const code = `${mod}.${action}`;
                    const on = selectedSet.has(code);
                    const label = permissionActionLabel(mod, action);
                    if (readOnly) {
                      return (
                        <span key={code} title={code} className="inline-flex items-center gap-1 rounded-md bg-[var(--erp-surface-muted)] px-2 py-1 text-xs text-erp-text-secondary">
                          <Check size={12} className="text-[var(--erp-success-text)]" aria-hidden="true" />{label}
                        </span>
                      );
                    }
                    return (
                      <button
                        key={code}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        title={code}
                        onClick={() => toggle(code)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-accent)] ${
                          on
                            ? 'border-[var(--erp-accent)] bg-[var(--erp-accent-subtle)] font-medium text-[var(--erp-accent)]'
                            : 'border-[var(--erp-border)] bg-[var(--erp-surface)] text-erp-text-secondary hover:border-[var(--erp-border-strong)]'
                        }`}
                      >
                        {on && <Check size={12} aria-hidden="true" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
