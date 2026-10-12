import type { ReactNode } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { useDesignForm } from '../DesignFormContext';
import { FILE_SLOTS, getDesignSubmitGaps, hasImageAsset } from '../designFormUtils';
import type { TabGroupId, TabId } from '../designFormUtils';
import { Button, DescriptionList, InfoBanner, Section } from '../../../components/erp';

function val(v: unknown) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

type Props = {
  onJumpTo?: (groupId: TabGroupId, tabId: TabId) => void;
};

function ReviewSection({
  title, groupId, tabId, onEdit, children,
}: {
  title: string;
  groupId: TabGroupId;
  tabId: TabId;
  onEdit?: (groupId: TabGroupId, tabId: TabId) => void;
  children: ReactNode;
}) {
  return (
    <Section
      title={title}
      actions={onEdit ? <Button size="sm" variant="ghost" onClick={() => onEdit(groupId, tabId)}>Edit</Button> : undefined}
    >
      {children}
    </Section>
  );
}

export function DesignReviewTab({ onJumpTo }: Props) {
  const {
    form, assets, pendingUploads, editable, design,
  } = useDesignForm();

  const fileSummary = FILE_SLOTS.map((slot) => {
    const uploaded = assets.find((a) => a.assetType === slot.type);
    const pending = pendingUploads.find((p) => p.assetType === slot.type);
    return { label: slot.label, value: uploaded?.fileName || pending?.file.name || '' };
  }).filter((f) => f.value);

  const imageOk = hasImageAsset(assets) || pendingUploads.some((p) =>
    ['FRONT_IMAGE', 'BACK_IMAGE', 'SIDE_IMAGE', 'ZOOM_IMAGE', 'TECHNICAL_SKETCH', 'IMAGE', 'SKETCH'].includes(p.assetType),
  );
  const gaps = getDesignSubmitGaps({ hasImage: imageOk, sizeChartData: form.sizeChartData });
  const jump = editable ? onJumpTo : undefined;
  const s = form.productSpecs;
  const colours = form.colors.filter((c) => c.name || c.code);

  const checklist = [
    { ok: !!(form.title.trim() && form.styleNumber.trim() && form.collectionCode), label: 'Title, style number and collection', go: ['overview', 'basic'] as const },
    { ok: !gaps.image, label: 'Front image or technical sketch', go: ['overview', 'files'] as const },
    { ok: !gaps.sizeRange, label: 'Size range', go: ['variants', 'skus'] as const },
  ];
  const ready = checklist.every((c) => c.ok);

  return (
    <div className="space-y-4">
      {editable && (
        <Section title="Ready to submit?" description="Your design manager reviews the tech pack and approves, sends it back, or rejects it.">
          <ul className="space-y-2">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  {c.ok
                    ? <CheckCircle2 size={16} className="text-[var(--erp-success-solid)]" aria-label="Done" />
                    : <CircleAlert size={16} className="text-[var(--erp-warning-solid)]" aria-label="Missing" />}
                  <span className={c.ok ? 'text-erp-text-primary' : 'font-medium text-erp-text-primary'}>{c.label}</span>
                </span>
                {!c.ok && jump && (
                  <Button size="sm" variant="link" onClick={() => jump(c.go[0], c.go[1])}>Add</Button>
                )}
              </li>
            ))}
          </ul>
          {ready && (
            <InfoBanner inset={false} tone="success" className="mt-3">
              Everything required is in place. Use <strong>{design?.status === 'REVISION_REQUESTED' ? 'Resubmit for review' : 'Submit for review'}</strong> below.
            </InfoBanner>
          )}
        </Section>
      )}

      <ReviewSection title="Basic details" groupId="overview" tabId="basic" onEdit={jump}>
        <DescriptionList
          columns={2}
          items={[
            { label: 'Title', value: val(form.title) },
            { label: 'Style number', value: val(form.styleNumber) },
            { label: 'Collection', value: val(form.collectionCode) },
            { label: 'Season', value: val(form.seasonCode) },
            { label: 'Category', value: [form.category, form.subCategory, form.section].filter(Boolean).join(' / ') || '—' },
            { label: 'Gender / age', value: [form.gender, form.ageGroup].filter(Boolean).join(' · ') || '—' },
            { label: 'Fit / sleeve / neck', value: [form.fit, form.sleeveType, form.neckType].filter(Boolean).join(' · ') || '—' },
            { label: 'Print / occasion', value: [form.pattern, form.occasion].filter(Boolean).join(' · ') || '—' },
            { label: 'Target price', value: form.targetPrice ? `${form.currency || 'INR'} ${form.targetPrice}` : '—' },
            { label: 'Tags', value: form.tags.length ? form.tags.join(', ') : '—' },
            { label: 'Description', value: val(form.description), full: true },
          ]}
        />
      </ReviewSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewSection title="Fabric intent" groupId="overview" tabId="specs" onEdit={jump}>
          <DescriptionList
            columns={2}
            items={[
              { label: 'Material', value: val(s.material) },
              { label: 'Printing type', value: val(s.printingType) },
              { label: 'Embroidery', value: val(s.embroidery) },
            ]}
          />
        </ReviewSection>

        <ReviewSection title="Images" groupId="overview" tabId="files" onEdit={jump}>
          {fileSummary.length === 0 ? (
            <p className="text-sm text-[var(--erp-warning-text)]">No images attached yet.</p>
          ) : (
            <DescriptionList columns={1} items={fileSummary.map((f) => ({ label: f.label, value: <span className="font-mono text-[13px]">{f.value}</span> }))} />
          )}
        </ReviewSection>

        <ReviewSection title="Colourways" groupId="variants" tabId="colors" onEdit={jump}>
          {colours.length === 0 ? (
            <p className="text-sm text-erp-text-muted">No colours added.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {colours.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--erp-border)] px-2 py-1 text-[13px]">
                  <span className="h-3 w-3 rounded-sm border border-[var(--erp-border)]" style={{ background: c.hexCode || 'transparent' }} aria-hidden />
                  {c.name || c.code}
                  {c.pantoneCode && <span className="text-xs text-erp-text-muted">{c.pantoneCode}</span>}
                </span>
              ))}
            </div>
          )}
        </ReviewSection>

        <ReviewSection title="Sizes" groupId="variants" tabId="skus" onEdit={jump}>
          <p className="text-sm text-erp-text-primary">{(form.sizeChartData.sizeLabels || []).join(', ') || '—'}</p>
          <p className="mt-1 text-xs text-erp-text-muted">Graded measurements are added by the pattern master after release.</p>
        </ReviewSection>
      </div>
    </div>
  );
}
