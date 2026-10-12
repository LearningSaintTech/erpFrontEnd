import { Plus } from 'lucide-react';
import { Button, ErpDataTable, ErpInput } from '../../components/erp';

export interface QcMeasurement {
  point: string;
  required: string;
  actual: string;
  tolerance: string;
  pass: boolean;
}

export function emptyQcMeasurements(points: string[]): QcMeasurement[] {
  return points.map((point) => ({
    point,
    required: '',
    actual: '',
    tolerance: '±0.25"',
    pass: true,
  }));
}

/** Required vs actual measurement sheet used when passing or failing sample QC. */
export function QcMeasurementForm({
  value,
  onChange,
}: {
  value: QcMeasurement[];
  onChange: (v: QcMeasurement[]) => void;
}) {
  const update = (idx: number, patch: Partial<QcMeasurement>) => {
    onChange(value.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-erp-text-primary">Measurement check</p>
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus size={14} />}
          onClick={() => onChange([...value, { point: 'Other', required: '', actual: '', tolerance: '', pass: true }])}
        >
          Add point
        </Button>
      </div>
      <div className="erp-table-wrap rounded-md border border-[var(--erp-border)]">
        <ErpDataTable className="min-w-[520px]">
          <thead>
            <tr>
              <th>Point</th>
              <th>Required</th>
              <th>Actual</th>
              <th>Tolerance</th>
              <th className="text-center">Pass</th>
            </tr>
          </thead>
          <tbody>
            {value.map((row, i) => (
              <tr key={`${row.point}-${i}`}>
                <td className="erp-cell-primary">{row.point}</td>
                <td className="!py-1"><ErpInput inputSize="sm" aria-label={`${row.point} required`} value={row.required} onChange={(e) => update(i, { required: e.target.value })} placeholder='40"' /></td>
                <td className="!py-1"><ErpInput inputSize="sm" aria-label={`${row.point} actual`} value={row.actual} onChange={(e) => update(i, { actual: e.target.value })} placeholder='40.2"' /></td>
                <td className="!py-1"><ErpInput inputSize="sm" aria-label={`${row.point} tolerance`} value={row.tolerance} onChange={(e) => update(i, { tolerance: e.target.value })} /></td>
                <td className="text-center">
                  <input type="checkbox" className="h-4 w-4" aria-label={`${row.point} passes`} checked={row.pass} onChange={(e) => update(i, { pass: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </ErpDataTable>
      </div>
    </div>
  );
}
