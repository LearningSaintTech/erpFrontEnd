import { ErpButton, ErpCard, ErpInput } from '../../components/erp';

export interface QcMeasurement {
  point: string;
  required: string;
  actual: string;
  tolerance: string;
  pass: boolean;
}

const label = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';

export function emptyQcMeasurements(points: string[]): QcMeasurement[] {
  return points.map((point) => ({
    point,
    required: '',
    actual: '',
    tolerance: '±0.25"',
    pass: true,
  }));
}

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
    <ErpCard className="!p-3">
      <h3 className="mb-1 text-[11px] font-semibold text-erp-text-primary">Measurement check</h3>
      <p className="mb-2 text-[10px] text-erp-text-muted">
        Record required vs actual — chest, sleeve, collar, etc.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[10px]">
          <thead>
            <tr className="border-b border-[var(--erp-border)] text-left text-erp-text-muted">
              <th className="px-1 py-1">Point</th>
              <th className="px-1 py-1">Required</th>
              <th className="px-1 py-1">Actual</th>
              <th className="px-1 py-1">Tolerance</th>
              <th className="px-1 py-1">Pass</th>
            </tr>
          </thead>
          <tbody>
            {value.map((row, i) => (
              <tr key={row.point} className="border-b border-[var(--erp-border)]/50">
                <td className="px-1 py-1 font-medium">{row.point}</td>
                <td className="px-1 py-1">
                  <ErpInput
                    className="!py-0.5 text-[10px]"
                    value={row.required}
                    onChange={(e) => update(i, { required: e.target.value })}
                    placeholder='40"'
                  />
                </td>
                <td className="px-1 py-1">
                  <ErpInput
                    className="!py-0.5 text-[10px]"
                    value={row.actual}
                    onChange={(e) => update(i, { actual: e.target.value })}
                    placeholder='40.2"'
                  />
                </td>
                <td className="px-1 py-1">
                  <ErpInput
                    className="!py-0.5 text-[10px]"
                    value={row.tolerance}
                    onChange={(e) => update(i, { tolerance: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="checkbox"
                    checked={row.pass}
                    onChange={(e) => update(i, { pass: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErpButton
        variant="secondary"
        className="mt-2 !px-2 !py-1 text-[10px]"
        onClick={() => onChange([...value, { point: 'Other', required: '', actual: '', tolerance: '', pass: true }])}
      >
        Add measurement point
      </ErpButton>
    </ErpCard>
  );
}
