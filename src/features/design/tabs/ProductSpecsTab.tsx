import { useDesignForm } from '../DesignFormContext';
import { Field } from '../../../components/erp';
import { InventoryCodeSelect } from '../../../components/InventoryCodeSelect';
import { DesignFormSection } from '../components/DesignFormSection';

export function ProductSpecsTab() {
  const { form, setForm, editable } = useDesignForm();
  const s = form.productSpecs;

  const setSpec = (key: keyof typeof s, val: string | number | boolean) =>
    setForm((f) => ({ ...f, productSpecs: { ...f.productSpecs, [key]: val } }));

  return (
    <DesignFormSection
      title="Fabric intent"
      hint="Name the fabric and finish you have in mind. The pattern master picks the store item and measures consumption."
    >
      <Field label="Material">
        <InventoryCodeSelect
          type="MATERIAL"
          value={s.material || ''}
          disabled={!editable}
          onChange={(code) => setSpec('material', code)}
          placeholder="Select material…"
        />
      </Field>
      <Field label="Printing type">
        <InventoryCodeSelect
          type="PRINTING_TYPE"
          value={s.printingType || ''}
          disabled={!editable}
          onChange={(code) => setSpec('printingType', code)}
          placeholder="Select printing type…"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-erp-text-primary sm:col-span-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-[var(--erp-border-strong)]"
          checked={!!s.embroidery}
          onChange={(e) => setSpec('embroidery', e.target.checked)}
          disabled={!editable}
        />
        Has embroidery
      </label>
    </DesignFormSection>
  );
}
