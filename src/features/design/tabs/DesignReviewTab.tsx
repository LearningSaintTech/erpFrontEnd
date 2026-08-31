import { useDesignForm } from '../DesignFormContext';
import { FILE_SLOTS, getDesignSubmitGaps, hasImageAsset } from '../designFormUtils';
import type { TabGroupId, TabId } from '../designFormUtils';
import type { ReactNode } from 'react';

function val(v: unknown) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function Section({
  title,
  tabId,
  groupId,
  onEdit,
  children,
}: {
  title: string;
  tabId: TabId;
  groupId: TabGroupId;
  onEdit?: (groupId: TabGroupId, tabId: TabId) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">{title}</h3>
        {onEdit && (
          <button
            type="button"
            className="text-[10px] font-medium text-[var(--erp-accent)] hover:underline"
            onClick={() => onEdit(groupId, tabId)}
          >
            Edit
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Grid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[9px] uppercase tracking-wide text-erp-text-muted">{item.label}</dt>
          <dd className="break-words text-[11px] text-erp-text-primary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type Props = {
  onJumpTo?: (groupId: TabGroupId, tabId: TabId) => void;
};

export function DesignReviewTab({ onJumpTo }: Props) {
  const {
    form, assets, pendingUploads, editable,
  } = useDesignForm();

  const fileSummary = FILE_SLOTS.map((slot) => {
    const uploaded = assets.find((a) => a.assetType === slot.type);
    const pending = pendingUploads.find((p) => p.assetType === slot.type);
    return {
      label: slot.label,
      value: uploaded?.fileName || pending?.file.name || '—',
    };
  }).filter((f) => f.value !== '—');

  const imageOk = hasImageAsset(assets) || pendingUploads.some((p) =>
    ['FRONT_IMAGE', 'BACK_IMAGE', 'SIDE_IMAGE', 'ZOOM_IMAGE', 'TECHNICAL_SKETCH', 'IMAGE', 'SKETCH'].includes(p.assetType),
  );
  const submitGaps = getDesignSubmitGaps({ hasImage: imageOk, sizeChartData: form.sizeChartData });
  const submitBlocked = editable && (submitGaps.image || submitGaps.sizeRange);

  const jump = editable ? onJumpTo : undefined;
  const s = form.productSpecs;

  return (
    <div className="space-y-3">
      <div className="rounded border border-[var(--erp-accent)]/30 bg-[var(--erp-accent-muted)]/20 p-3">
        <p className="text-[11px] font-medium text-erp-text-primary">
          Check your tech pack before submit
        </p>
        <p className="mt-0.5 text-[10px] text-erp-text-muted">
          Confirm the details below, then submit for admin approval. Use Edit to jump back to any section.
        </p>
      </div>

      {submitBlocked && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-[11px] font-medium text-amber-800">Required before submit</p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[10px] text-amber-800">
            {submitGaps.image && (
              <li>
                At least one image in Files
                {jump && (
                  <button type="button" className="ml-1 font-medium underline" onClick={() => jump('overview', 'files')}>
                    Add files
                  </button>
                )}
              </li>
            )}
            {submitGaps.sizeRange && (
              <li>
                A size range in Sizes &amp; SKUs
                {jump && (
                  <button type="button" className="ml-1 font-medium underline" onClick={() => jump('variants', 'skus')}>
                    Edit
                  </button>
                )}
              </li>
            )}
          </ul>
          <p className="mt-1.5 text-[10px] text-amber-700">
          Graded measurements, fabric technicals, marker consumption, and trims are
          completed by the pattern master after release.
          </p>
        </div>
      )}

      <Section title="Basic details" groupId="overview" tabId="basic" onEdit={jump}>
        <Grid items={[
          { label: 'Title', value: val(form.title) },
          { label: 'Style number', value: val(form.styleNumber) },
          { label: 'Collection', value: val(form.collectionCode) },
          { label: 'Season', value: val(form.seasonCode) },
          { label: 'Category', value: [form.category, form.subCategory, form.section].filter(Boolean).join(' / ') || '—' },
          { label: 'Gender / Age', value: [form.gender, form.ageGroup].filter(Boolean).join(' · ') || '—' },
          { label: 'Fit / Sleeve / Neck', value: [form.fit, form.sleeveType, form.neckType].filter(Boolean).join(' · ') || '—' },
          { label: 'Pattern / Occasion', value: [form.pattern, form.occasion].filter(Boolean).join(' · ') || '—' },
          { label: 'Target price', value: form.targetPrice ? `${form.currency || 'INR'} ${form.targetPrice}` : '—' },
          { label: 'Tags', value: form.tags.length ? form.tags.join(', ') : '—' },
          { label: 'Description', value: val(form.description) },
        ]}
        />
      </Section>

      <Section title="Product specs" groupId="overview" tabId="specs" onEdit={jump}>
        <Grid items={[
          { label: 'Material', value: val(s.material) },
          { label: 'Printing type', value: val(s.printingType) },
          { label: 'Embroidery', value: val(s.embroidery) },
        ]}
        />
      </Section>

      <Section title="Files" groupId="overview" tabId="files" onEdit={jump}>
        {fileSummary.length === 0 ? (
          <p className="text-[11px] text-amber-600">No images/files attached — add at least one image before submit.</p>
        ) : (
          <ul className="space-y-1">
            {fileSummary.map((f) => (
              <li key={f.label} className="flex justify-between gap-2 text-[11px]">
                <span className="text-erp-text-muted">{f.label}</span>
                <span className="truncate font-mono text-erp-text-primary">{f.value}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Colors" groupId="variants" tabId="colors" onEdit={jump}>
        {form.colors.filter((c) => c.name || c.code).length === 0 ? (
          <p className="text-[11px] text-erp-text-muted">No colors added</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {form.colors.filter((c) => c.name || c.code).map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded border border-[var(--erp-border)] px-2 py-1">
                <span className="h-3 w-3 rounded-sm border border-[var(--erp-border)]" style={{ background: c.hexCode || '#ccc' }} />
                <span className="text-[11px]">{c.name || c.code || '—'}</span>
                {c.pantoneCode && <span className="text-[9px] text-erp-text-muted">{c.pantoneCode}</span>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Sizes" groupId="variants" tabId="skus" onEdit={jump}>
        <p className="text-[10px] text-erp-text-muted">
          Range: {(form.sizeChartData.sizeLabels || []).join(', ') || '—'}
        </p>
        <p className="mt-1 text-[10px] text-erp-text-muted">
          The graded measurement chart is filled by the pattern master after release.
        </p>
      </Section>

      <section className="rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] p-3">
        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">
          Handled after release
        </h3>
        <p className="text-[11px] text-erp-text-muted">
          You named the fabric and colours (with Pantone). Pattern grades measurements, nests the marker, and lists trims.
          Costing freezes the BOM after sample. Purchase books mill rate. Cutting records what was issued.
        </p>
      </section>
    </div>
  );
}
