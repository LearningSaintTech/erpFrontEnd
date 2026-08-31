import { useDesignForm } from '../DesignFormContext';
import { labelClass } from '../designFormUtils';
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
      hint="Pattern will pick the store item and measure meters; purchase sets mill rate."
    >
      <label className="block">
        <span className={labelClass()}>Material</span>
        <InventoryCodeSelect
          type="MATERIAL"
          value={s.material || ''}
          disabled={!editable}
          onChange={(code) => setSpec('material', code)}
          placeholder="— Select material —"
        />
      </label>
      <label className="block">
        <span className={labelClass()}>Printing Type</span>
        <InventoryCodeSelect
          type="PRINTING_TYPE"
          value={s.printingType || ''}
          disabled={!editable}
          onChange={(code) => setSpec('printingType', code)}
          placeholder="— Select printing type —"
        />
      </label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" checked={!!s.embroidery} onChange={(e) => setSpec('embroidery', e.target.checked)} disabled={!editable} />
        <span className={labelClass()}>Embroidery</span>
      </label>
    </DesignFormSection>
  );
}
