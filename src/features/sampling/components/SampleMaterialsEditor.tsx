import { Download, Plus, Trash2 } from 'lucide-react';
import {
  Button, EmptyState, ErpDataTable, ErpInput, ErpSearchSelect, Field, IconButton, InfoBanner, Section,
} from '../../../components/erp';
import type { Material, Sample } from '../../../types/api';
import { formatCost, materialIdOf, materialLabel } from '../sampleUtils';

export type MatLine = NonNullable<Sample['materialRequirements']>[number];

/** Editable fabric & trims list plus labour for a sample (pattern master, status CREATED). */
export function SampleMaterialsEditor({
  lines,
  onLinesChange,
  materialOptions,
  materialsLoading,
  materialsError,
  laborHours,
  laborRate,
  onLaborHoursChange,
  onLaborRateChange,
  onLoadFromBom,
  loadingFromBom,
}: {
  lines: MatLine[];
  onLinesChange: (updater: (lines: MatLine[]) => MatLine[]) => void;
  materialOptions: Material[];
  materialsLoading?: boolean;
  materialsError?: boolean;
  laborHours: string;
  laborRate: string;
  onLaborHoursChange: (v: string) => void;
  onLaborRateChange: (v: string) => void;
  onLoadFromBom: () => void;
  loadingFromBom?: boolean;
}) {
  const options = materialOptions.map((mat) => ({
    value: String(mat._id),
    label: `${mat.materialCode} — ${mat.name}`,
    keywords: `${mat.materialCode} ${mat.name} ${mat.category || ''}`,
  }));

  const addLine = () => {
    const first = materialOptions[0];
    if (!first) return;
    onLinesChange((ls) => [...ls, { materialId: first._id, requiredQty: 1, unit: first.unit || 'PIECES' }]);
  };

  const labour = (Number(laborHours) || 0) * (Number(laborRate) || 0);

  return (
    <div className="space-y-4">
      <Section
        title="Fabric and trims"
        description="Everything the sample needs from the store — fabric, buttons, zips, labels, thread, interlining."
        actions={(
          <>
            {lines.length > 0 && (
              <Button size="sm" variant="ghost" icon={<Download size={14} />} loading={loadingFromBom} onClick={onLoadFromBom}>
                Reload from tech pack
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} disabled={!materialOptions.length} onClick={addLine}>
              Add line
            </Button>
          </>
        )}
        flush={lines.length > 0}
      >
        {materialsError && (
          <InfoBanner inset={false} tone="danger" className="m-4">Could not load the material list. Refresh the page or check your permissions.</InfoBanner>
        )}
        {lines.length === 0 ? (
          <EmptyState
            compact
            title="No materials yet"
            description="Start from the pattern tech pack, then adjust quantities for this sample."
            action={(
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" icon={<Download size={14} />} loading={loadingFromBom} onClick={onLoadFromBom}>Load from tech pack</Button>
                <Button size="sm" variant="secondary" icon={<Plus size={14} />} disabled={!materialOptions.length || materialsLoading} onClick={addLine}>Add manually</Button>
              </div>
            )}
          />
        ) : (
          <ErpDataTable className="min-w-[560px]">
            <thead>
              <tr>
                <th>Material</th>
                <th className="erp-num">Quantity</th>
                <th>Unit</th>
                <th className="erp-cell-actions"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((m, i) => {
                const selectedId = materialIdOf(m.materialId);
                const opts = selectedId && !options.some((o) => o.value === selectedId)
                  ? [{ value: selectedId, label: materialLabel(m.materialId) }, ...options]
                  : options;
                const unit = materialOptions.find((mat) => String(mat._id) === selectedId)?.unit || m.unit || 'PIECES';
                return (
                  <tr key={`${selectedId || 'line'}-${i}`}>
                    <td className="min-w-[260px] !py-1.5">
                      <ErpSearchSelect
                        className="w-full"
                        value={selectedId}
                        options={opts}
                        disabled={!materialOptions.length}
                        // Until the material list arrives the line only has an id — show "Loading…", not the id.
                        loading={!materialOptions.length && !!selectedId && typeof m.materialId === 'string'}
                        placeholder="Select material…"
                        searchPlaceholder="Search code or name…"
                        onChange={(id) => {
                          const mat = materialOptions.find((x) => String(x._id) === id);
                          onLinesChange((ls) => ls.map((l, j) => (j === i ? { ...l, materialId: id, unit: mat?.unit || l.unit } : l)));
                        }}
                      />
                    </td>
                    <td className="erp-num !py-1.5">
                      <ErpInput
                        inputSize="sm"
                        type="number"
                        min={0}
                        step="any"
                        aria-label="Required quantity"
                        className="w-24 text-right tabular-nums"
                        value={m.requiredQty}
                        onChange={(e) => onLinesChange((ls) => ls.map((l, j) => (j === i ? { ...l, requiredQty: Number(e.target.value) } : l)))}
                      />
                    </td>
                    <td className="text-erp-text-secondary" title="Follows the material's stock unit">{unit.toLowerCase()}</td>
                    <td className="erp-cell-actions !py-1.5">
                      <IconButton size="sm" aria-label="Remove line" onClick={() => onLinesChange((ls) => ls.filter((_, j) => j !== i))}>
                        <Trash2 size={14} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ErpDataTable>
        )}
      </Section>

      <Section title="Labour">
        <div className="grid max-w-lg grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Hours">
            <ErpInput type="number" min={0} className="tabular-nums" value={laborHours} onChange={(e) => onLaborHoursChange(e.target.value)} />
          </Field>
          <Field label="Rate per hour">
            <ErpInput type="number" min={0} className="tabular-nums" value={laborRate} onChange={(e) => onLaborRateChange(e.target.value)} />
          </Field>
          <div className="col-span-2 sm:col-span-1">
            <p className="mb-1.5 text-xs font-medium text-erp-text-muted">Labour cost</p>
            <p className="text-sm font-medium tabular-nums text-erp-text-primary">{formatCost(labour)}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
