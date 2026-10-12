import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  ErpDataTable, ErpSelect, Field, IconButton, Section,
} from '../../../components/erp';
import { InventoryCodeChips, InventoryCodeSelect } from '../../../components/InventoryCodeSelect';

export type MeasurementRow = { measurementName: string; values: Record<string, string> };

/** Graded POM chart: size range chips + measurement × size grid. */
export function TechPackMeasurementChart({
  unit,
  sizeLabels,
  rows,
  readOnly,
  onUnitChange,
  onSizeLabelsChange,
  onAddRow,
  onRemoveRow,
  onCellChange,
}: {
  unit: string;
  sizeLabels: string[];
  rows: MeasurementRow[];
  readOnly: boolean;
  onUnitChange: (unit: string) => void;
  onSizeLabelsChange: (next: string[]) => void;
  onAddRow: (name: string) => void;
  onRemoveRow: (index: number) => void;
  onCellChange: (index: number, size: string, value: string) => void;
}) {
  const [pendingMeas, setPendingMeas] = useState('');
  const filled = rows.filter((r) => Object.values(r.values).some((v) => v !== '' && v != null)).length;

  return (
    <Section
      id="techpack-measurements"
      title="Graded measurement chart"
      description={rows.length ? `${filled} of ${rows.length} points filled` : 'Points of measure for every size in the range.'}
      actions={(
        <ErpSelect
          inputSize="sm"
          aria-label="Measurement unit"
          value={/^in/i.test(unit) ? 'IN' : 'CM'}
          onChange={(e) => onUnitChange(e.target.value)}
          disabled={readOnly}
        >
          <option value="CM">Centimetres</option>
          <option value="IN">Inches</option>
        </ErpSelect>
      )}
      flush
    >
      <div className="space-y-4 p-4 pb-3">
        <Field label="Size range" required htmlFor="techpack-sizes" hint={!sizeLabels.length && !readOnly ? 'Pick the sizes this style is graded to.' : undefined}>
          {readOnly ? (
            <div className="flex flex-wrap gap-1.5">
              {sizeLabels.map((s) => (
                <span key={s} className="rounded-md border border-[var(--erp-border)] px-2 py-0.5 font-mono text-xs">{s}</span>
              ))}
              {!sizeLabels.length && <span className="text-xs text-erp-text-muted">No sizes on this chart.</span>}
            </div>
          ) : (
            <InventoryCodeChips type="SIZE" values={sizeLabels} onChange={onSizeLabelsChange} />
          )}
        </Field>
      </div>

      <ErpDataTable className="min-w-[420px]">
        <thead>
          <tr>
            <th>Point of measure</th>
            {sizeLabels.map((s) => <th key={s} className="erp-num font-mono">{s}</th>)}
            {!readOnly && <th className="erp-cell-actions"><span className="sr-only">Remove</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.measurementName}>
              <td className="erp-cell-primary whitespace-nowrap">{row.measurementName}</td>
              {sizeLabels.map((s) => (
                <td key={s} className="erp-num !py-1">
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    aria-label={`${row.measurementName} ${s}`}
                    value={row.values[s] ?? ''}
                    onChange={(e) => onCellChange(i, s, e.target.value)}
                    disabled={readOnly}
                    className="erp-input h-8 w-20 px-2 text-right tabular-nums"
                  />
                </td>
              ))}
              {!readOnly && (
                <td className="erp-cell-actions !py-1">
                  <IconButton size="sm" aria-label={`Remove ${row.measurementName}`} onClick={() => onRemoveRow(i)}>
                    <Trash2 size={14} />
                  </IconButton>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={sizeLabels.length + 2} className="py-6 text-center text-[13px] text-erp-text-muted">
                No points of measure yet{readOnly ? '.' : ' — add the first one below.'}
              </td>
            </tr>
          )}
        </tbody>
      </ErpDataTable>

      {!readOnly && (
        <div className="border-t border-[var(--erp-border)] px-4 py-3">
          <div className="max-w-xs">
            <Field label="Add point of measure" htmlFor="techpack-add-pom">
              <InventoryCodeSelect
                type="MEASUREMENT"
                value={pendingMeas}
                placeholder="Chest, length, sleeve…"
                onChange={(code, item) => {
                  onAddRow(item?.name || code);
                  setPendingMeas('');
                }}
              />
            </Field>
          </div>
        </div>
      )}
    </Section>
  );
}
