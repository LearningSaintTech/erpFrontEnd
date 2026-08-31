import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { ErpButton, ErpInput, ErpSearchSelect } from './erp';
import { useAuth } from '../app/providers/AuthProvider';
import { hasAnyPermission } from '../utils/permissions';
import { useCreateInventoryCode, useInventoryCodes } from '../hooks/useInventoryCodes';
import { toErrorMessage } from '../utils/errors';
import { codeTypeNoun } from '../features/settings/inventoryCodeUtils';
import type { InventoryCode } from '../types/api';

function optionLabel(code: InventoryCode) {
  return `${code.code} — ${code.name}`;
}

function matchesValue(code: InventoryCode, value: string) {
  const v = value.trim().toLowerCase();
  return code.code.toLowerCase() === v || code.name.toLowerCase() === v;
}

function useCanFeedCodes() {
  const { user, permissions } = useAuth();
  return hasAnyPermission(
    permissions,
    ['inventory.configure', 'design.create', 'design.update', 'pattern.update', 'pattern.create'],
    !!user?.isSuperAdmin,
  );
}

function InventoryCodeAddForm({
  type,
  noun,
  allowCancel,
  onCreated,
  onCancel,
}: {
  type: string;
  noun: string;
  allowCancel: boolean;
  onCreated: (created: InventoryCode) => void;
  onCancel: () => void;
}) {
  const createMut = useCreateInventoryCode();
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    const code = newCode.trim();
    const name = newName.trim();
    if (!code || !name) {
      setError('Code and name are required');
      return;
    }
    setError('');
    try {
      const created = await createMut.mutateAsync({ type, code, name });
      onCreated(created);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  };

  return (
    <div className="rounded border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-medium text-erp-text-primary">New {noun} code</p>
        {allowCancel && (
          <button type="button" onClick={onCancel} className="text-erp-text-muted" aria-label="Close">
            <X size={12} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <ErpInput
          className="w-full !py-1 font-mono text-[11px]"
          placeholder="Code"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
        />
        <ErpInput
          className="w-full !py-1 text-[11px]"
          placeholder="Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </div>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
      <div className="mt-1.5 flex gap-1.5">
        <ErpButton
          className="!px-2 !py-1 text-[10px]"
          disabled={!newCode.trim() || !newName.trim() || createMut.isPending}
          onClick={() => void submit()}
        >
          {createMut.isPending ? 'Saving…' : 'Save & select'}
        </ErpButton>
        {allowCancel && (
          <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={onCancel}>
            Cancel
          </ErpButton>
        )}
      </div>
    </div>
  );
}

export function InventoryCodeSelect({
  type,
  value,
  onChange,
  disabled = false,
  allowAdd,
  placeholder = '— Select —',
  className = 'w-full !py-1.5 text-[11px]',
  autoOpenAdd = false,
}: {
  type: string;
  value: string;
  onChange: (code: string, item: InventoryCode | null) => void;
  disabled?: boolean;
  allowAdd?: boolean;
  placeholder?: string;
  className?: string;
  autoOpenAdd?: boolean;
}) {
  const canFeed = useCanFeedCodes();
  const showAdd = allowAdd ?? (!disabled && canFeed);
  const { data: codes = [], isLoading, isError } = useInventoryCodes(type);
  const [adding, setAdding] = useState(false);
  const noun = codeTypeNoun(type);
  const empty = !isLoading && codes.length === 0;

  useEffect(() => {
    if (showAdd && empty && !disabled && autoOpenAdd) setAdding(true);
  }, [showAdd, empty, disabled, autoOpenAdd]);

  const selected = useMemo(
    () => codes.find((c) => matchesValue(c, value)),
    [codes, value],
  );
  const orphan = Boolean(value && !selected);
  const selectValue = selected?.code || value || '';
  const options = useMemo(() => {
    const list = codes.map((c) => ({
      value: c.code,
      label: optionLabel(c),
      keywords: `${c.code} ${c.name}`,
    }));
    if (orphan && value) {
      list.unshift({ value, label: `${value} (not in catalog)`, keywords: value });
    }
    return list;
  }, [codes, orphan, value]);

  return (
    <div className="space-y-1.5">
      <ErpSearchSelect
        value={selectValue}
        options={options}
        disabled={disabled || isLoading}
        loading={isLoading}
        placeholder={placeholder}
        className={className}
        searchPlaceholder={`Search ${noun}…`}
        emptyText={`No ${noun} codes match`}
        onChange={(next) => {
          if (!next) {
            onChange('', null);
            return;
          }
          const item = codes.find((c) => matchesValue(c, next)) || null;
          onChange(item?.code || next, item);
        }}
      />

      {isError && <p className="text-[10px] text-red-600">Could not load {noun} codes</p>}
      {empty && !showAdd && (
        <p className="text-[10px] text-erp-text-muted">
          No {noun} codes yet. Add them in Settings → Inventory Codes.
        </p>
      )}
      {showAdd && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 text-[10px] text-[var(--erp-accent)] hover:underline"
        >
          <Plus size={11} />
          {empty ? `Add a ${noun} code` : `Add ${noun} code`}
        </button>
      )}
      {showAdd && adding && (
        <InventoryCodeAddForm
          type={type}
          noun={noun}
          allowCancel={!empty || Boolean(value)}
          onCreated={(created) => {
            onChange(created.code, created);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}

export function InventoryCodeChips({
  type,
  values,
  onChange,
  disabled = false,
  allowAdd,
}: {
  type: string;
  values: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
  allowAdd?: boolean;
}) {
  const canFeed = useCanFeedCodes();
  const showAdd = allowAdd ?? (!disabled && canFeed);
  const { data: codes = [], isLoading, isError } = useInventoryCodes(type);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('');
  const noun = codeTypeNoun(type);
  const empty = !isLoading && codes.length === 0;
  const selected = new Set(values.map((v) => v.toLowerCase()));

  const toggle = (code: string) => {
    const exists = values.some((v) => v.toLowerCase() === code.toLowerCase());
    onChange(exists ? values.filter((v) => v.toLowerCase() !== code.toLowerCase()) : [...values, code]);
  };

  const orphans = values.filter((v) => !codes.some((c) => matchesValue(c, v)));
  const q = filter.trim().toLowerCase();
  const visible = q
    ? codes.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    : codes;
  const visibleOrphans = q
    ? orphans.filter((v) => v.toLowerCase().includes(q))
    : orphans;

  return (
    <div className="space-y-1.5">
      {codes.length > 8 && (
        <div className="relative max-w-xs">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
          <ErpInput
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Search ${noun}…`}
            className="w-full !py-1 !pl-7 text-[11px]"
            disabled={disabled}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {isLoading && <p className="text-[10px] text-erp-text-muted">Loading {noun} codes…</p>}
        {visible.map((c) => {
          const on = selected.has(c.code.toLowerCase()) || selected.has(c.name.toLowerCase());
          return (
            <button
              key={c._id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(c.code)}
              className={`erp-tab rounded-full px-2.5 py-0.5 text-[10px]${on ? ' erp-tab-active' : ''}`}
            >
              {c.name}
            </button>
          );
        })}
        {visibleOrphans.map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => toggle(v)}
            className="erp-tab erp-tab-active rounded-full px-2.5 py-0.5 text-[10px]"
          >
            {v}
          </button>
        ))}
        {!isLoading && q && visible.length === 0 && visibleOrphans.length === 0 && (
          <p className="text-[10px] text-erp-text-muted">No {noun} codes match “{filter.trim()}”.</p>
        )}
      </div>
      {isError && <p className="text-[10px] text-red-600">Could not load {noun} codes</p>}
      {empty && !showAdd && (
        <p className="text-[10px] text-erp-text-muted">
          No {noun} codes yet. Add them in Settings → Inventory Codes.
        </p>
      )}
      {showAdd && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 text-[10px] text-[var(--erp-accent)] hover:underline"
        >
          <Plus size={11} />
          {empty ? `Add a ${noun} code` : `Add ${noun} code`}
        </button>
      )}
      {showAdd && adding && (
        <InventoryCodeAddForm
          type={type}
          noun={noun}
          allowCancel
          onCreated={(created) => {
            if (!values.some((v) => v.toLowerCase() === created.code.toLowerCase())) {
              onChange([...values, created.code]);
            }
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
