import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import { inventoryCodeApi } from '../../../services/manufacturing';
import type { SkuFormulaSegment, SkuSegmentDefinition } from '../../../types/api';
import {
  Badge, Button, ErpInput, Field, IconButton, Section, useConfirm,
} from '../../../components/erp';
import { DEFAULT_SKU_FORMULA } from '../inventoryCodeUtils';
import { SaveBar } from '../SettingsSection';
import { SettingsSkeleton } from './GeneralSettingsTab';

function moveSegment(order: SkuFormulaSegment[], index: number, dir: -1 | 1) {
  const next = [...order];
  const target = index + dir;
  if (target < 0 || target >= next.length) return order;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function SkuFormulaTab({ canConfigure }: { canConfigure: boolean }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [segments, setSegments] = useState<SkuFormulaSegment[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: formula, isLoading } = useQuery({
    queryKey: ['sku-formula-config'],
    queryFn: inventoryCodeApi.getSkuFormula,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['sku-segment-catalog'],
    queryFn: inventoryCodeApi.getSegmentCatalog,
  });

  const loadFromServer = () => {
    if (formula) {
      setName(formula.name || DEFAULT_SKU_FORMULA.name);
      setSegments(formula.skuSegmentOrder?.length ? formula.skuSegmentOrder : DEFAULT_SKU_FORMULA.skuSegmentOrder);
    } else {
      setName(DEFAULT_SKU_FORMULA.name);
      setSegments(DEFAULT_SKU_FORMULA.skuSegmentOrder);
    }
    setDirty(false);
  };

  useEffect(() => {
    if (!isLoading) loadFromServer();
  }, [formula, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const catalogMap = useMemo(
    () => new Map(catalog.map((c: SkuSegmentDefinition) => [c.key, c])),
    [catalog],
  );

  const preview = useMemo(
    () => segments
      .filter((s) => (s.key ?? s.segmentKey) !== 'skuUid')
      .map((s) => {
        const segKey = s.key ?? s.segmentKey ?? '';
        const def = catalogMap.get(segKey);
        return s.optional ? `[${def?.label || segKey}?]` : (def?.label || segKey).replace(/\s+/g, '').toUpperCase().slice(0, 6);
      })
      .join('-'),
    [segments, catalogMap],
  );

  const save = useMutation({
    mutationFn: () => inventoryCodeApi.updateSkuFormula({ name: name.trim(), skuSegmentOrder: segments }),
    meta: { successMessage: 'SKU formula saved', successDescription: 'New SKUs use this order. Existing SKUs keep their codes.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sku-formula-config'] });
      setDirty(false);
    },
  });

  const resetTemplate = async () => {
    const ok = await confirm({
      title: 'Reset to the standard formula?',
      message: 'The segment order and name go back to the default template. Nothing is saved until you click Save.',
      confirmLabel: 'Reset',
      tone: 'primary',
    });
    if (!ok) return;
    setName(DEFAULT_SKU_FORMULA.name);
    setSegments(DEFAULT_SKU_FORMULA.skuSegmentOrder);
    setDirty(true);
  };

  if (isLoading) return <SettingsSkeleton />;

  return (
    <div className="space-y-4">
      <Section
        title="Active SKU formula"
        description="The order of segments used when SKUs are generated from a design. Optional segments are skipped when empty."
        actions={canConfigure ? (
          <Button variant="secondary" size="sm" icon={<RotateCcw size={16} />} onClick={resetTemplate}>Reset to standard</Button>
        ) : undefined}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Formula name" required error={canConfigure && !name.trim() ? 'Enter a name for this formula.' : undefined}>
            <ErpInput value={name} disabled={!canConfigure} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-medium text-erp-text-secondary">Preview</p>
            <p className="flex min-h-9 items-center rounded-md border border-dashed border-[var(--erp-border-strong)] bg-[var(--erp-surface-muted)] px-3 font-mono text-[13px] text-erp-text-primary">
              {preview || '—'}
            </p>
          </div>
        </div>
      </Section>

      <Section title="Segment order" flush>
        <ol className="divide-y divide-[var(--erp-border)]">
          {segments.map((seg, index) => {
            const segKey = seg.key ?? seg.segmentKey ?? '';
            const def = catalogMap.get(segKey);
            return (
              <li key={`${segKey}-${index}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="erp-tabular w-6 text-center text-xs text-erp-text-muted">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-erp-text-primary">{def?.label || segKey}</p>
                  <p className="text-xs text-erp-text-muted">{def?.description || segKey}</p>
                </div>
                {canConfigure ? (
                  <label className="flex items-center gap-2 text-[13px] text-erp-text-secondary">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-[var(--erp-accent)]"
                      checked={seg.optional}
                      onChange={() => { setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, optional: !s.optional } : s))); setDirty(true); }}
                    />
                    Optional
                  </label>
                ) : seg.optional ? <Badge tone="neutral" dot={false}>Optional</Badge> : null}
                {canConfigure && (
                  <span className="flex items-center gap-0.5">
                    <IconButton aria-label={`Move ${def?.label || segKey} up`} size="sm" disabled={index === 0} onClick={() => { setSegments((p) => moveSegment(p, index, -1)); setDirty(true); }}>
                      <ArrowUp size={16} />
                    </IconButton>
                    <IconButton aria-label={`Move ${def?.label || segKey} down`} size="sm" disabled={index === segments.length - 1} onClick={() => { setSegments((p) => moveSegment(p, index, 1)); setDirty(true); }}>
                      <ArrowDown size={16} />
                    </IconButton>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </Section>

      {canConfigure && (
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          disabled={!name.trim()}
          onSave={() => save.mutate()}
          onDiscard={loadFromServer}
          saveLabel="Save formula"
        />
      )}
    </div>
  );
}
