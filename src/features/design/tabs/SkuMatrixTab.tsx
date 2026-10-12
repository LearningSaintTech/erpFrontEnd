import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { designApi } from '../../../services/manufacturing';
import { useDesignForm } from '../DesignFormContext';
import { Button, ErpDataTable, Field, InfoBanner, Section } from '../../../components/erp';
import { InventoryCodeChips } from '../../../components/InventoryCodeSelect';
import { DesignFormSection } from '../components/DesignFormSection';

export function SkuMatrixTab() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { form, setForm, design, editable } = useDesignForm();
  const sizeLabels = form.sizeChartData?.sizeLabels || [];
  const colours = form.colors.filter((c) => c.name.trim());

  const setSizeLabels = (labels: string[]) =>
    setForm((f) => ({ ...f, sizeChartData: { ...f.sizeChartData, sizeLabels: labels } }));

  const regenerate = useMutation({
    mutationFn: () => designApi.regenerateSkus(id!),
    meta: { successMessage: 'SKU codes regenerated' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['design', id] });
    },
  });

  return (
    <div className="space-y-4">
      <DesignFormSection
        title="Size range"
        hint="The sizes this style is offered in. The pattern master fills in graded measurements after release."
        columns={1}
      >
        <Field
          label="Sizes"
          required
          htmlFor="design-sizes"
          hint={editable && !sizeLabels.length ? 'Add at least one size — it is required before you submit.' : undefined}
        >
          <InventoryCodeChips type="SIZE" values={sizeLabels} disabled={!editable} onChange={setSizeLabels} />
        </Field>
      </DesignFormSection>

      <Section
        title="SKU preview"
        description={(
          <>
            Code format: style gender – product type – fit – colour – size
            {design?.styleNumber && <> · Style <span className="font-mono">{design.styleNumber}</span></>}
          </>
        )}
        actions={design && editable && id ? (
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} loading={regenerate.isPending} onClick={() => regenerate.mutate()}>
            Regenerate codes
          </Button>
        ) : undefined}
        flush={!!design && !!colours.length && !!sizeLabels.length}
      >
        {!design ? (
          <p className="text-sm text-erp-text-muted">Save the draft to preview the SKU codes.</p>
        ) : !colours.length || !sizeLabels.length ? (
          <InfoBanner inset={false} tone="muted">Add colours and a size range to see the SKU matrix.</InfoBanner>
        ) : (
          <ErpDataTable>
            <thead>
              <tr>
                <th>Colour</th>
                {sizeLabels.map((s) => <th key={s} className="font-mono">{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {colours.map((color, i) => (
                <tr key={i}>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm border border-[var(--erp-border)]" style={{ background: color.hexCode || 'transparent' }} aria-hidden />
                      {color.name}
                    </span>
                  </td>
                  {sizeLabels.map((size) => {
                    const sku = color.sizes?.find((r) => r.size === size)?.sku;
                    return <td key={size} className="font-mono text-xs text-erp-text-secondary">{sku || '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        )}
      </Section>
    </div>
  );
}
