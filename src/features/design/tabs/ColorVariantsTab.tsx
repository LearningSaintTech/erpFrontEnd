import { useDesignForm } from '../DesignFormContext';
import { emptyColor, inputClass } from '../designFormUtils';
import { InventoryCodeSelect } from '../../../components/InventoryCodeSelect';

export function ColorVariantsTab() {
  const { form, setForm, editable } = useDesignForm();

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-erp-text-muted">
        Colour code goes on the SKU. Pantone is what the mill / print house dyes to. Lab-dip approval happens in sampling.
      </p>
      {form.colors.map((c, i) => (
        <div key={i} className="grid gap-2 rounded border p-3 sm:grid-cols-3">
          <div>
            <InventoryCodeSelect
              type="COLOR"
              value={c.code || c.name}
              disabled={!editable}
              placeholder="Colour from catalog *"
              onChange={(code, item) => setForm((f) => ({
                ...f,
                colors: f.colors.map((row, j) => j === i
                  ? {
                    ...row,
                    code: item?.code || code,
                    name: item?.name || row.name || code,
                  }
                  : row),
              }))}
            />
          </div>
          <input
            value={c.pantoneCode || ''}
            onChange={(e) => setForm((f) => ({ ...f, colors: f.colors.map((row, j) => j === i ? { ...row, pantoneCode: e.target.value } : row) }))}
            disabled={!editable}
            placeholder="Pantone / TCX"
            className={inputClass(editable)}
          />
          <input
            type="color"
            value={c.hexCode || '#D30000'}
            onChange={(e) => setForm((f) => ({ ...f, colors: f.colors.map((row, j) => j === i ? { ...row, hexCode: e.target.value } : row) }))}
            disabled={!editable}
            className="h-10 w-full cursor-pointer rounded border"
            title="Screen swatch only"
          />
          {editable && form.colors.length > 1 && (
            <button type="button" onClick={() => setForm((f) => ({ ...f, colors: f.colors.filter((_, j) => j !== i) }))} className="text-xs text-red-600 sm:col-span-3">Remove</button>
          )}
        </div>
      ))}
      {editable && (
        <button type="button" onClick={() => setForm((f) => ({ ...f, colors: [...f.colors, emptyColor()] }))} className="text-sm text-[var(--erp-accent)]">+ Add color</button>
      )}
    </div>
  );
}
