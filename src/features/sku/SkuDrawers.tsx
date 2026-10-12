import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { skuApi } from '../../services/manufacturing';
import {
  Badge, Button, Drawer, ErpDataTable, ErpInput, ErpSearchSelect, ErpSelect, Field, InfoBanner, Section, toast,
} from '../../components/erp';
import type { Sku, SkuEligibleSample } from '../../types/api';
import '../bom/bomTypes';

function invalidateSkus(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['skus'] });
  qc.invalidateQueries({ queryKey: ['sku-stats'] });
  qc.invalidateQueries({ queryKey: ['sku-eligible-samples'] });
  qc.invalidateQueries({ queryKey: ['sku-preview'] });
}

/** Bulk-generate SKUs (size × colour) from an approved sample, with a live preview. */
export function GenerateSkusDrawer({ open, onClose, initialSampleId = '' }: { open: boolean; onClose: () => void; initialSampleId?: string }) {
  const qc = useQueryClient();
  const [sampleId, setSampleId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [sampleError, setSampleError] = useState('');

  useEffect(() => {
    if (open) { setSampleId(initialSampleId); setBasePrice(''); setSampleError(''); }
  }, [open, initialSampleId]);

  const { data: eligible = [], isLoading } = useQuery({
    queryKey: ['sku-eligible-samples'],
    queryFn: skuApi.eligibleSamples,
    enabled: open,
  });

  const { data: preview, error: previewError, isFetching: previewLoading } = useQuery({
    queryKey: ['sku-preview', sampleId],
    queryFn: () => skuApi.preview(sampleId),
    enabled: !!sampleId,
    retry: false,
  });

  const selected = eligible.find((s: SkuEligibleSample) => s._id === sampleId);
  const conflicts = preview?.conflictCount ?? 0;
  const newCount = preview?.newCount ?? 0;

  const bulk = useMutation({
    mutationFn: () => skuApi.bulkCreate({
      sampleId,
      designId: typeof selected!.designId === 'string' ? selected!.designId : selected!.designId!._id,
      basePrice: basePrice ? Number(basePrice) : undefined,
    }),
    onSuccess: (result) => {
      invalidateSkus(qc);
      toast.success(
        `Created ${result.created.length} SKU${result.created.length === 1 ? '' : 's'}`,
        result.skipped.length ? { description: `${result.skipped.length} existing code${result.skipped.length === 1 ? ' was' : 's were'} skipped.` } : undefined,
      );
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!sampleId) { setSampleError('Choose an approved sample.'); return; }
    if (newCount > 0 && conflicts === 0) bulk.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title="Generate SKUs"
      description="Creates every size and colour combination from an approved sample. Codes that already exist are skipped."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="generate-skus-form"
            loading={bulk.isPending}
            disabled={!!sampleId && (newCount === 0 || conflicts > 0 || previewLoading)}
          >
            {sampleId && newCount > 0 ? `Generate ${newCount} SKU${newCount === 1 ? '' : 's'}` : 'Generate SKUs'}
          </Button>
        </>
      )}
    >
      <form id="generate-skus-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field label="Approved sample" required error={sampleError} htmlFor="sku-sample">
            <ErpSearchSelect
              id="sku-sample"
              className="w-full"
              value={sampleId}
              loading={isLoading}
              placeholder="Select sample…"
              searchPlaceholder="Search sample or design…"
              emptyText="No approved samples are waiting for SKUs"
              options={eligible.map((s: SkuEligibleSample) => ({
                value: s._id,
                label: `${s.sampleCode} — ${s.designCode} (${s.matrixRows || 0} variants, ${s.existingSkus} SKUs)`,
                keywords: `${s.sampleCode} ${s.designCode}`,
              }))}
              onChange={(id) => { setSampleId(id); setSampleError(''); }}
            />
          </Field>
          <Field label="Base price" hint="Blank = design target price">
            <ErpInput type="number" min={0} className="tabular-nums" placeholder="Auto" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
          </Field>
        </div>

        {!isLoading && eligible.length === 0 && (
          <InfoBanner inset={false} tone="muted">No approved samples yet. SKUs are generated once a sample is approved.</InfoBanner>
        )}
        {sampleId && previewError && (
          <InfoBanner inset={false} tone="danger">{(previewError as Error).message}</InfoBanner>
        )}
        {conflicts > 0 && (
          <InfoBanner inset={false} tone="danger">
            {conflicts} code{conflicts === 1 ? '' : 's'} already belong to another design or factory. Fix the style number or colour codes on the design first.
          </InfoBanner>
        )}

        {preview && (preview.previews?.length ?? 0) > 0 && (
          <Section
            title="Preview"
            description={`${newCount} new · ${preview.skipCount ?? 0} existing${preview.sizeSource ? ` · sizes from ${preview.sizeSource === 'pattern' ? 'the graded pattern chart' : "the designer's size range"}` : ''}`}
            flush
          >
            <div className="max-h-[50vh] overflow-y-auto">
              <ErpDataTable>
                <thead><tr><th>SKU code</th><th>Size</th><th>Colour</th><th>Result</th></tr></thead>
                <tbody>
                  {preview.previews!.map((p, i) => (
                    <tr key={i} className={p.exists && !p.conflict ? 'opacity-60' : ''}>
                      <td className="font-mono text-[13px]">{p.skuCode}</td>
                      <td>{p.size}</td>
                      <td>{p.color?.name ?? '—'}</td>
                      <td>
                        {p.conflict
                          ? <Badge tone="danger">Conflict: {p.conflict}</Badge>
                          : p.exists ? <Badge tone="neutral">Exists</Badge> : <Badge tone="success">New</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ErpDataTable>
            </div>
          </Section>
        )}
      </form>
    </Drawer>
  );
}

/** Edit an SKU's name, price and status. */
export function EditSkuDrawer({ sku, onClose }: { sku: Sku | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', basePrice: '', status: 'ACTIVE' });
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (sku) {
      setForm({ name: sku.name, basePrice: String(sku.basePrice ?? ''), status: sku.status });
      setNameError('');
    }
  }, [sku]);

  const update = useMutation({
    mutationFn: () => skuApi.update(sku!._id, {
      name: form.name || undefined,
      basePrice: form.basePrice ? Number(form.basePrice) : undefined,
      status: form.status,
    }),
    meta: { successMessage: 'SKU updated' },
    onSuccess: () => {
      invalidateSkus(qc);
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setNameError('Enter a name for this SKU.'); return; }
    update.mutate();
  };

  return (
    <Drawer
      open={!!sku}
      onClose={onClose}
      size="sm"
      title={sku ? `Edit ${sku.skuCode}` : 'Edit SKU'}
      description={sku ? `${sku.size} / ${sku.color?.name ?? '—'}` : undefined}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-sku-form" loading={update.isPending}>Save</Button>
        </>
      )}
    >
      <form id="edit-sku-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" required error={nameError}>
          <ErpInput value={form.name} invalid={!!nameError} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setNameError(''); }} />
        </Field>
        <Field label="Base price">
          <ErpInput type="number" min={0} className="tabular-nums" value={form.basePrice} onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))} />
        </Field>
        <Field label="Status" hint="Only active SKUs can get a BOM and production orders.">
          <ErpSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="DISCONTINUED">Discontinued</option>
          </ErpSelect>
        </Field>
      </form>
    </Drawer>
  );
}
