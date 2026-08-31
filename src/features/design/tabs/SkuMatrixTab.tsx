import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { designApi } from '../../../services/manufacturing';
import { useDesignForm } from '../DesignFormContext';
import { labelClass } from '../designFormUtils';
import { InventoryCodeChips } from '../../../components/InventoryCodeSelect';

export function SkuMatrixTab() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { form, setForm, design, editable } = useDesignForm();
  const sizeLabels = form.sizeChartData?.sizeLabels || [];

  const setSizeLabels = (labels: string[]) =>
    setForm((f) => ({ ...f, sizeChartData: { ...f.sizeChartData, sizeLabels: labels } }));

  const regenerate = useMutation({
    mutationFn: () => designApi.regenerateSkus(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['design', id] });
    },
  });

  const sizeRangeEditor = (
    <div className="space-y-2 rounded border border-[var(--erp-border)] p-3">
      <span className={labelClass()}>Size range</span>
      <InventoryCodeChips
        type="SIZE"
        values={sizeLabels}
        disabled={!editable}
        onChange={setSizeLabels}
      />
      <p className="text-xs text-erp-text-muted">
        Sizes this style will be offered in. Graded measurements are filled by the pattern master.
      </p>
    </div>
  );

  if (!design) {
    return (
      <div className="space-y-4">
        {sizeRangeEditor}
        <p className="text-sm text-erp-text-muted">Save the design first to preview generated SKUs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sizeRangeEditor}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-erp-text-secondary">
          Style <span className="font-mono">{design.styleNumber || '—'}</span>
          {design.skuCodeInputs?.styleGender && (
            <span className="ml-2 text-erp-text-muted">({design.skuCodeInputs.styleGender})</span>
          )}
        </p>
        {editable && id && (
          <button
            type="button"
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
            className="rounded border px-3 py-1.5 text-sm hover:bg-transparent disabled:opacity-50"
          >
            {regenerate.isPending ? 'Regenerating…' : 'Regenerate SKUs'}
          </button>
        )}
      </div>

      {!form.colors.filter((c) => c.name.trim()).length || !sizeLabels.length ? (
        <p className="text-sm text-amber-700">Add colors and a size range to generate SKUs.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="erp-data-table min-w-full">
            <thead>
              <tr className="border-b text-left text-erp-text-secondary">
                <th className="px-2 py-2">Color</th>
                {sizeLabels.map((s) => (
                  <th key={s} className="px-2 py-2 font-mono">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.colors.filter((c) => c.name.trim()).map((color, i) => (
                <tr key={i} className="border-b">
                  <td className="px-2 py-2">{color.name}</td>
                  {sizeLabels.map((size) => {
                    const sku = color.sizes?.find((r) => r.size === size)?.sku;
                    return (
                      <td key={size} className="px-2 py-2 font-mono text-xs text-erp-text-secondary">
                        {sku || '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={labelClass()}>Format: styleGender-productType-fitType-colour-size (hyphenated)</p>
    </div>
  );
}
