import { useDesignForm } from '../DesignFormContext';
import { designerName } from '../designFormUtils';
import { ErpInput, ErpStatusBadge } from '../../../components/erp';
import { InventoryCodeChips, InventoryCodeSelect } from '../../../components/InventoryCodeSelect';
import { DesignFormSection } from '../components/DesignFormSection';

const fieldLabel = 'mb-1 block text-[10px] font-medium text-erp-text-muted';

export function BasicDetailsTab() {
  const { form, setForm, editable, design } = useDesignForm();

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-3">
      {design && (
        <DesignFormSection title="Record">
          <div>
            <span className={fieldLabel}>Design code</span>
            <p className="mt-0.5 font-mono text-[11px]">{design.designCode}</p>
          </div>
          <div>
            <span className={fieldLabel}>Designer</span>
            <p className="mt-0.5 text-[11px]">{designerName(design.createdBy)}</p>
          </div>
          <div>
            <span className={fieldLabel}>Created</span>
            <p className="mt-0.5 text-[11px]">{design.createdAt ? new Date(design.createdAt).toLocaleDateString() : '—'}</p>
          </div>
          <div>
            <span className={fieldLabel}>Status</span>
            <p className="mt-1"><ErpStatusBadge status={design.status} /></p>
          </div>
        </DesignFormSection>
      )}

      <DesignFormSection title="Style identity" hint="What merchandising and pattern will call this style.">
        <label className="block sm:col-span-2">
          <span className={fieldLabel}>Title *</span>
          <ErpInput className="w-full !py-1.5 text-[11px]" value={form.title} onChange={(e) => set('title', e.target.value)} disabled={!editable} />
        </label>
        <label className="block sm:col-span-2">
          <span className={fieldLabel}>Description</span>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            disabled={!editable}
            rows={2}
            className="erp-input w-full resize-y !py-1.5 text-[11px]"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Style number *</span>
          <ErpInput
            className="w-full !py-1.5 font-mono text-[11px]"
            value={form.styleNumber}
            onChange={(e) => set('styleNumber', e.target.value)}
            disabled={!editable}
            placeholder="STY-001"
          />
          <p className="mt-0.5 text-[10px] text-erp-text-muted">Unique per collection; used in SKU generation</p>
        </label>
      </DesignFormSection>

      <DesignFormSection title="Classification" hint="Catalog attributes only — no consumption or mill rate here.">
        <label className="block">
          <span className={fieldLabel}>Category *</span>
          <InventoryCodeSelect
            type="CATEGORY"
            value={form.category}
            disabled={!editable}
            onChange={(code) => {
              setForm((f) => ({ ...f, category: code, skuPrefix: code }));
            }}
            placeholder="— Select category —"
          />
          <p className="mt-0.5 text-[10px] text-erp-text-muted">Product type in the SKU (shirt, trouser, …)</p>
        </label>
        <label className="block">
          <span className={fieldLabel}>Sub category</span>
          <InventoryCodeSelect
            type="SUB_CATEGORY"
            value={form.subCategory}
            disabled={!editable}
            onChange={(code) => set('subCategory', code)}
            placeholder="— Select sub category —"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Section</span>
          <InventoryCodeSelect
            type="SECTION"
            value={form.section}
            disabled={!editable}
            onChange={(code) => set('section', code)}
            placeholder="— Select section —"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Gender</span>
          <InventoryCodeSelect
            type="GENDER"
            value={form.gender}
            disabled={!editable}
            onChange={(code) => set('gender', code)}
            placeholder="— Select gender —"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Age group</span>
          <InventoryCodeSelect
            type="AGE_GROUP"
            value={form.ageGroup}
            disabled={!editable}
            onChange={(code) => set('ageGroup', code)}
            placeholder="— Select age group —"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Fit</span>
          <InventoryCodeSelect
            type="FIT"
            value={form.fit}
            disabled={!editable}
            onChange={(code) => set('fit', code)}
            placeholder="— Select fit —"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Sleeve type</span>
          <InventoryCodeSelect
            type="SLEEVE"
            value={form.sleeveType}
            disabled={!editable}
            onChange={(code) => set('sleeveType', code)}
            placeholder="— Select sleeve —"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Neck type</span>
          <InventoryCodeSelect
            type="NECK"
            value={form.neckType}
            disabled={!editable}
            onChange={(code) => set('neckType', code)}
            placeholder="— Select neck —"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Pattern</span>
          <InventoryCodeSelect
            type="PATTERN"
            value={form.pattern}
            disabled={!editable}
            onChange={(code) => set('pattern', code)}
            placeholder="— Select pattern —"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Occasion</span>
          <InventoryCodeSelect
            type="OCCASION"
            value={form.occasion}
            disabled={!editable}
            onChange={(code) => set('occasion', code)}
            placeholder="— Select occasion —"
          />
        </label>
      </DesignFormSection>

      <DesignFormSection title="Collection & commercial">
        <label className="block">
          <span className={fieldLabel}>Collection *</span>
          <InventoryCodeSelect
            type="COLLECTION"
            value={form.collectionCode}
            disabled={!editable}
            onChange={(code) => set('collectionCode', code)}
            placeholder="— Select collection —"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Season</span>
          <InventoryCodeSelect
            type="SEASON"
            value={form.seasonCode}
            disabled={!editable}
            onChange={(code) => set('seasonCode', code)}
            placeholder="— Select season —"
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Target price</span>
          <ErpInput type="number" min={0} className="w-full !py-1.5 text-[11px]" value={form.targetPrice} onChange={(e) => set('targetPrice', e.target.value)} disabled={!editable} />
        </label>
        <label className="block">
          <span className={fieldLabel}>Currency</span>
          <InventoryCodeSelect
            type="CURRENCY"
            value={form.currency}
            disabled={!editable}
            onChange={(code) => set('currency', code || 'INR')}
            placeholder="— Select currency —"
          />
        </label>
        <div className="sm:col-span-2">
          <span className={fieldLabel}>Tags</span>
          <div className="mt-1">
            <InventoryCodeChips
              type="TAG"
              values={form.tags}
              disabled={!editable}
              onChange={(tags) => set('tags', tags)}
            />
          </div>
        </div>
      </DesignFormSection>
    </div>
  );
}
