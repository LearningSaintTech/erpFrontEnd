import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { inventoryCodeApi } from '../../../services/manufacturing';
import type { SkuFormulaSegment, SkuSegmentDefinition } from '../../../types/api';
import { ErpButton, ErpCard, ErpInput } from '../../../components/erp';
import { DEFAULT_SKU_FORMULA } from '../inventoryCodeUtils';

function moveSegment(order: SkuFormulaSegment[], index: number, dir: -1 | 1) {
  const next = [...order];
  const target = index + dir;
  if (target < 0 || target >= next.length) return order;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function SkuFormulaTab({
  onError,
  onSuccess,
  canConfigure,
}: {
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
  canConfigure: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [segments, setSegments] = useState<SkuFormulaSegment[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: formula, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sku-formula-config'],
    queryFn: inventoryCodeApi.getSkuFormula,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['sku-segment-catalog'],
    queryFn: inventoryCodeApi.getSegmentCatalog,
  });

  useEffect(() => {
    if (formula) {
      setName(formula.name || DEFAULT_SKU_FORMULA.name);
      setSegments(formula.skuSegmentOrder?.length ? formula.skuSegmentOrder : DEFAULT_SKU_FORMULA.skuSegmentOrder);
      setDirty(false);
    } else if (!isLoading) {
      setName(DEFAULT_SKU_FORMULA.name);
      setSegments(DEFAULT_SKU_FORMULA.skuSegmentOrder);
      setDirty(false);
    }
  }, [formula, isLoading]);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sku-formula-config'] });
      setDirty(false);
      onSuccess('SKU formula saved');
    },
    onError: (e: Error) => onError(e.message),
  });

  const resetTemplate = () => {
    setName(DEFAULT_SKU_FORMULA.name);
    setSegments(DEFAULT_SKU_FORMULA.skuSegmentOrder);
    setDirty(true);
  };

  const toggleOptional = (index: number) => {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, optional: !s.optional } : s)));
    setDirty(true);
  };

  const move = (index: number, dir: -1 | 1) => {
    setSegments((prev) => moveSegment(prev, index, dir));
    setDirty(true);
  };

  if (isLoading) {
    return <p className="text-[11px] text-erp-text-muted">Loading SKU formula…</p>;
  }

  return (
    <div className="space-y-3">
      <ErpCard className="!p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-semibold text-erp-text-primary">Active SKU formula</h3>
            <p className="mt-0.5 text-[10px] text-erp-text-muted">
              Segment order used when auto-generating SKUs on designs. Optional segments are skipped when empty.
            </p>
          </div>
          <div className="flex gap-1">
            <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            </ErpButton>
            {canConfigure && (
              <ErpButton variant="secondary" className="!px-2 !py-1.5 text-[11px]" onClick={resetTemplate}>
                Reset template
              </ErpButton>
            )}
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-[10px] font-medium text-erp-text-muted">Formula name</label>
          <ErpInput
            className="max-w-md !py-1.5 text-[11px]"
            value={name}
            disabled={!canConfigure}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
          />
        </div>

        <div className="mt-3 rounded-md border border-dashed border-[var(--erp-border)] bg-[var(--erp-surface-alt)] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Preview</p>
          <p className="mt-1 font-mono text-[12px] text-erp-text-primary">{preview || '—'}</p>
        </div>
      </ErpCard>

      <ErpCard className="!p-0 overflow-hidden">
        <div className="border-b border-[var(--erp-border)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Segment order</p>
        </div>
        <ul className="divide-y divide-[var(--erp-border)]">
          {segments.map((seg, index) => {
            const segKey = seg.key ?? seg.segmentKey ?? '';
        const def = catalogMap.get(segKey);
            return (
              <li key={`${seg.key}-${index}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="w-5 text-center text-[10px] text-erp-text-muted">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-erp-text-primary">{def?.label || seg.key}</p>
                  <p className="text-[10px] text-erp-text-muted">{def?.description || seg.key}</p>
                </div>
                <label className="flex items-center gap-1 text-[10px] text-erp-text-muted">
                  <input
                    type="checkbox"
                    checked={seg.optional}
                    disabled={!canConfigure}
                    onChange={() => toggleOptional(index)}
                    className="rounded"
                  />
                  Optional
                </label>
                {canConfigure && (
                  <div className="flex gap-0.5">
                    <ErpButton variant="secondary" className="!px-1.5 !py-1" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp size={12} />
                    </ErpButton>
                    <ErpButton variant="secondary" className="!px-1.5 !py-1" disabled={index === segments.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown size={12} />
                    </ErpButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </ErpCard>

      {canConfigure && (
        <div className="flex items-center gap-2">
          <ErpButton
            className="!px-3 !py-1.5 text-[11px]"
            disabled={!dirty || save.isPending || !name.trim()}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save formula'}
          </ErpButton>
          {dirty && <span className="text-[10px] text-amber-600">Unsaved changes</span>}
        </div>
      )}
    </div>
  );
}
