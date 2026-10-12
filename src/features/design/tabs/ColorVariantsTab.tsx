import { Plus, Trash2 } from 'lucide-react';
import { useDesignForm } from '../DesignFormContext';
import { emptyColor, swatchFromColourName } from '../designFormUtils';
import { Button, ErpInput, Field, IconButton } from '../../../components/erp';
import { InventoryCodeSelect } from '../../../components/InventoryCodeSelect';
import { DesignFormSection } from '../components/DesignFormSection';
import type { ColorVariant } from '../../../types/api';

export function ColorVariantsTab() {
  const { form, setForm, editable } = useDesignForm();

  const update = (i: number, patch: Partial<ColorVariant>) =>
    setForm((f) => ({ ...f, colors: f.colors.map((row, j) => (j === i ? { ...row, ...patch } : row)) }));

  return (
    <DesignFormSection
      title="Colourways"
      hint="The colour code goes on the SKU. Pantone is what the mill or print house dyes to; lab dips are approved in sampling."
      columns={1}
      actions={editable ? (
        <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setForm((f) => ({ ...f, colors: [...f.colors, emptyColor()] }))}>
          Add colour
        </Button>
      ) : undefined}
    >
      <ul className="divide-y divide-[var(--erp-border)] rounded-md border border-[var(--erp-border)]">
        {form.colors.map((c, i) => (
          <li key={i} className="grid items-end gap-3 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_88px_auto]">
            <Field label={`Colour ${i + 1}`} required={i === 0} htmlFor={`design-colour-${i}`}>
              <InventoryCodeSelect
                type="COLOR"
                value={c.code || c.name}
                disabled={!editable}
                placeholder="Select colour from catalogue…"
                onChange={(code, item) => {
                  const name = item?.name || c.name || code;
                  // A new catalogue colour brings its own swatch; keep the old one only if the name isn't a known colour.
                  update(i, { code: item?.code || code, name, hexCode: swatchFromColourName(name) || c.hexCode });
                }}
              />
            </Field>
            <Field label="Pantone / TCX">
              <ErpInput
                value={c.pantoneCode || ''}
                onChange={(e) => update(i, { pantoneCode: e.target.value })}
                disabled={!editable}
                placeholder="19-4052 TCX"
              />
            </Field>
            <Field label="Swatch" hint="Screen only">
              <input
                type="color"
                value={c.hexCode || '#CCCCCC'}
                onChange={(e) => update(i, { hexCode: e.target.value })}
                disabled={!editable}
                className="h-9 w-full cursor-pointer rounded-md border border-[var(--erp-border)] bg-[var(--erp-surface)] p-0.5 disabled:cursor-not-allowed"
              />
            </Field>
            <div className="pb-0.5">
              {editable && form.colors.length > 1 ? (
                <IconButton
                  aria-label={`Remove colour ${i + 1}`}
                  onClick={() => setForm((f) => ({ ...f, colors: f.colors.filter((_, j) => j !== i) }))}
                >
                  <Trash2 size={16} />
                </IconButton>
              ) : <span className="block w-9" />}
            </div>
          </li>
        ))}
      </ul>
    </DesignFormSection>
  );
}
