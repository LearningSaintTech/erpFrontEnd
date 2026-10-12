import { useDesignForm } from '../DesignFormContext';
import { designerName } from '../designFormUtils';
import { DescriptionList, ErpInput, Field, Section, Textarea } from '../../../components/erp';
import { InventoryCodeChips, InventoryCodeSelect } from '../../../components/InventoryCodeSelect';
import { DesignFormSection } from '../components/DesignFormSection';
import type { DesignFormState } from '../designFormUtils';

type CodeField = { key: keyof DesignFormState; label: string; type: string };

const CLASSIFICATION: CodeField[] = [
  { key: 'subCategory', label: 'Sub category', type: 'SUB_CATEGORY' },
  { key: 'section', label: 'Section', type: 'SECTION' },
  { key: 'gender', label: 'Gender', type: 'GENDER' },
  { key: 'ageGroup', label: 'Age group', type: 'AGE_GROUP' },
  { key: 'fit', label: 'Fit', type: 'FIT' },
  { key: 'sleeveType', label: 'Sleeve', type: 'SLEEVE' },
  { key: 'neckType', label: 'Neck', type: 'NECK' },
  { key: 'pattern', label: 'Print / pattern', type: 'PATTERN' },
  { key: 'occasion', label: 'Occasion', type: 'OCCASION' },
];

export function BasicDetailsTab() {
  const {
    form, setForm, editable, design, errors = {}, clearError,
  } = useDesignForm();

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (key === 'title' || key === 'styleNumber' || key === 'collectionCode') clearError?.(key);
  };

  return (
    <div className="space-y-4">
      {design && (
        <Section title="Record">
          <DescriptionList
            columns={3}
            items={[
              { label: 'Design code', value: <span className="font-mono">{design.designCode}</span> },
              { label: 'Designer', value: designerName(design.createdBy) },
              { label: 'Created', value: design.createdAt ? new Date(design.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
            ]}
          />
        </Section>
      )}

      <DesignFormSection title="Style identity" hint="What merchandising and the pattern room will call this style.">
        <Field label="Title" required error={errors.title} className="sm:col-span-2">
          <ErpInput
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            disabled={!editable}
            placeholder="e.g. Linen camp-collar shirt"
            invalid={!!errors.title}
          />
        </Field>
        <Field label="Style number" required error={errors.styleNumber} hint="Unique within the collection. Used in SKU codes.">
          <ErpInput
            className="font-mono"
            value={form.styleNumber}
            onChange={(e) => set('styleNumber', e.target.value)}
            disabled={!editable}
            placeholder="STY-001"
            invalid={!!errors.styleNumber}
          />
        </Field>
        <Field label="Collection" required error={errors.collectionCode} htmlFor="design-collection">
          <InventoryCodeSelect
            type="COLLECTION"
            value={form.collectionCode}
            disabled={!editable}
            onChange={(code) => set('collectionCode', code)}
            placeholder="Select collection…"
          />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            disabled={!editable}
            rows={3}
            placeholder="Design intent, references, key details…"
          />
        </Field>
      </DesignFormSection>

      <DesignFormSection title="Classification" hint="Catalogue attributes. Category becomes the product type in the SKU." columns={3}>
        <Field label="Category" required htmlFor="design-category" hint="Shirt, trouser, dress…">
          <InventoryCodeSelect
            type="CATEGORY"
            value={form.category}
            disabled={!editable}
            onChange={(code) => setForm((f) => ({ ...f, category: code, skuPrefix: code }))}
            placeholder="Select category…"
          />
        </Field>
        {CLASSIFICATION.map((c) => (
          <Field key={c.key} label={c.label}>
            <InventoryCodeSelect
              type={c.type}
              value={String(form[c.key] ?? '')}
              disabled={!editable}
              onChange={(code) => set(c.key, code as never)}
              placeholder={`Select ${c.label.toLowerCase()}…`}
            />
          </Field>
        ))}
      </DesignFormSection>

      <DesignFormSection title="Season & price" columns={2}>
        <Field label="Season">
          <InventoryCodeSelect
            type="SEASON"
            value={form.seasonCode}
            disabled={!editable}
            onChange={(code) => set('seasonCode', code)}
            placeholder="Select season…"
          />
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
          <Field label="Target price">
            <ErpInput
              type="number"
              min={0}
              inputMode="decimal"
              className="tabular-nums"
              value={form.targetPrice}
              onChange={(e) => set('targetPrice', e.target.value)}
              disabled={!editable}
              placeholder="0"
            />
          </Field>
          <Field label="Currency">
            <InventoryCodeSelect
              type="CURRENCY"
              value={form.currency}
              disabled={!editable}
              onChange={(code) => set('currency', code || 'INR')}
              placeholder="INR"
            />
          </Field>
        </div>
        <Field label="Tags" className="sm:col-span-2" htmlFor="design-tags">
          <InventoryCodeChips
            type="TAG"
            values={form.tags}
            disabled={!editable}
            onChange={(tags) => set('tags', tags)}
          />
        </Field>
      </DesignFormSection>
    </div>
  );
}
