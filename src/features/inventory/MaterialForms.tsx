import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, ImagePlus, X } from 'lucide-react';
import {
  Button, Drawer, ErpDataTable, ErpInput, ErpSearchSelect, ErpSelect, Field, InfoBanner, Modal, toast,
  type ErpSearchOption,
} from '../../components/erp';
import { PreviewableImage } from '../../components/ImagePreview';
import { inventoryApi } from '../../services/manufacturing';
import type { Material } from '../../types/api';
import { UnitInput } from '../purchase/purchaseShared';
import {
  MATERIAL_CATEGORIES, MATERIAL_UNITS, filesToImagePayloads, mediaUrl, unitLabel,
} from './inventoryUtils';
import { materialsImportTemplateCsv, parseMaterialsUploadFile, type ImportMaterialRow } from './materialImport';
import { useInvalidateInventory } from './inventoryLayout';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

/* ───────────────────────── Add / edit material ───────────────────────── */

export function MaterialFormDrawer({
  open, onClose, material, onSaved, onImport,
}: {
  open: boolean;
  onClose: () => void;
  /** Edit mode when given. */
  material?: Material | null;
  onSaved?: (m: Material) => void;
  /** Switch to bulk import. */
  onImport?: () => void;
}) {
  const invalidate = useInvalidateInventory();
  const editing = !!material;
  const [form, setForm] = useState({ materialCode: '', name: '', category: 'FABRIC', unit: 'METERS', unitCost: '', reorderLevel: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<{ url: string; fileName?: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFiles([]);
    if (material) {
      setForm({
        materialCode: material.materialCode,
        name: material.name,
        category: material.category || 'OTHER',
        unit: material.unit,
        unitCost: String(material.unitCost ?? 0),
        reorderLevel: String(material.reorderLevel ?? 0),
      });
      setExisting((material.images || []).flatMap((img) => (img.url ? [{ url: img.url, fileName: img.fileName }] : [])));
    } else {
      setForm({ materialCode: '', name: '', category: 'FABRIC', unit: 'METERS', unitCost: '', reorderLevel: '' });
      setExisting([]);
    }
  }, [open, material]);

  const save = useMutation({
    mutationFn: async () => {
      const uploaded = await filesToImagePayloads(files);
      const common = {
        name: form.name.trim(),
        category: form.category,
        unitCost: Number(form.unitCost) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
      };
      return material
        ? inventoryApi.updateMaterial(material._id, { ...common, images: [...existing, ...uploaded] })
        : inventoryApi.createMaterial({ ...common, materialCode: form.materialCode.trim(), unit: form.unit, images: uploaded });
    },
    meta: {
      successMessage: editing ? 'Material updated' : 'Material added',
      successDescription: editing ? undefined : 'It can now be used on requisitions and BOMs.',
    },
    onSuccess: (m) => {
      invalidate();
      onSaved?.(m);
      onClose();
    },
  });

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!editing && form.materialCode.trim().length < 2) next.materialCode = 'Enter a code of at least 2 characters, e.g. FAB-COT-001.';
    if (form.name.trim().length < 2) next.name = 'Enter the material name.';
    if (form.unitCost !== '' && (!Number.isFinite(Number(form.unitCost)) || Number(form.unitCost) < 0)) next.unitCost = 'Enter 0 or more.';
    if (form.reorderLevel !== '' && (!Number.isFinite(Number(form.reorderLevel)) || Number(form.reorderLevel) < 0)) next.reorderLevel = 'Enter 0 or more.';
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };

  const gallery = [
    ...existing.map((x) => ({ src: mediaUrl(x.url), alt: x.fileName || 'Material image' })),
    ...files.map((f) => ({ src: URL.createObjectURL(f), alt: f.name })),
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={false}
      title={editing ? `Edit ${material?.materialCode}` : 'Add material'}
      description={editing ? material?.name : 'Register a raw material so it can be bought, stocked and used on BOMs.'}
      footer={(
        <>
          {!editing && onImport && (
            <Button variant="ghost" className="mr-auto" icon={<FileSpreadsheet size={16} />} onClick={onImport}>Import from Excel</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="material-form" loading={save.isPending} disabled={!form.name.trim() || (!editing && !form.materialCode.trim())}>
            {editing ? 'Save changes' : 'Add material'}
          </Button>
        </>
      )}
    >
      <form id="material-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <Field label="Code" required={!editing} error={errors.materialCode} hint={editing ? 'Cannot be changed' : undefined}>
            <ErpInput className="font-mono" value={form.materialCode} disabled={editing} autoFocus={!editing} placeholder="FAB-COT-001" onChange={(e) => set('materialCode', e.target.value)} />
          </Field>
          <Field label="Name" required error={errors.name}>
            <ErpInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Cotton fabric white" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <ErpSelect value={form.category} onChange={(e) => set('category', e.target.value)}>
              {MATERIAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Unit of measure" hint={editing ? 'Cannot be changed once stock exists' : undefined}>
            <ErpSelect value={form.unit} disabled={editing} onChange={(e) => set('unit', e.target.value)}>
              {MATERIAL_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Unit cost" error={errors.unitCost} hint={`Per ${unitLabel(form.unit).toLowerCase().replace(/s$/, '')}`}>
            <UnitInput min={0} step="0.01" unit="₹" value={form.unitCost} placeholder="0" onChange={(e) => set('unitCost', e.target.value)} />
          </Field>
          <Field label="Reorder level" error={errors.reorderLevel} hint="You get a low-stock alert below this">
            <UnitInput min={0} step="any" unit={unitLabel(form.unit)} value={form.reorderLevel} placeholder="0" onChange={(e) => set('reorderLevel', e.target.value)} />
          </Field>
        </div>
        <Field label="Photos" hint="Optional. Up to 12 images.">
          <div className="flex flex-wrap items-center gap-2">
            {existing.map((img, i) => (
              <div key={img.url} className="relative">
                <PreviewableImage src={mediaUrl(img.url)} alt={img.fileName || 'Material image'} className="h-14 w-14 rounded-md object-cover" gallery={gallery} galleryIndex={i} />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--erp-surface)] p-0.5 text-erp-text-muted shadow-erp-xs ring-1 ring-[var(--erp-border)] hover:text-erp-text-primary"
                  onClick={() => setExisting((list) => list.filter((x) => x.url !== img.url))}
                  aria-label="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="relative">
                <PreviewableImage src={URL.createObjectURL(f)} alt={f.name} className="h-14 w-14 rounded-md object-cover" gallery={gallery} galleryIndex={existing.length + i} />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--erp-surface)] p-0.5 text-erp-text-muted shadow-erp-xs ring-1 ring-[var(--erp-border)] hover:text-erp-text-primary"
                  onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                  aria-label="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {existing.length + files.length < 12 && (
              <label className="inline-flex h-14 cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed border-[var(--erp-border)] px-3 text-[13px] text-erp-text-secondary hover:bg-[var(--erp-surface-muted)]">
                <ImagePlus size={16} aria-hidden="true" />
                Add photos
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const picked = [...(e.target.files || [])];
                    e.target.value = '';
                    setFiles((prev) => [...prev, ...picked].slice(0, 12 - existing.length));
                  }}
                />
              </label>
            )}
          </div>
        </Field>
      </form>
    </Drawer>
  );
}

/* ───────────────────────── Bulk import ───────────────────────── */

export function ImportMaterialsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateInventory();
  const [rows, setRows] = useState<ImportMaterialRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [postOpeningStock, setPostOpeningStock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    if (open) { setRows([]); setFileName(''); setFileError(''); }
  }, [open]);

  const pick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setFileError('');
    try {
      const parsed = await parseMaterialsUploadFile(file);
      if (!parsed.length) {
        setFileError('No material rows found in that file. Check it follows the template.');
        setRows([]);
        return;
      }
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'Could not read the file.');
      setRows([]);
    } finally {
      setBusy(false);
    }
  };

  const run = useMutation({
    mutationFn: () => inventoryApi.bulkImportMaterials({ items: rows, postOpeningStock }),
    onSuccess: (result) => {
      invalidate();
      const summary = `Imported ${result.created} material${result.created === 1 ? '' : 's'}`
        + (result.skipped ? `, skipped ${result.skipped}` : '')
        + (postOpeningStock ? ` · stock posted for ${result.stockPosted}` : '');
      if (result.errors?.length) {
        toast.warning(summary, {
          description: `${result.errors.length} row(s) had errors, e.g. row ${result.errors[0].row}: ${result.errors[0].message}`,
          duration: 10000,
        });
      } else {
        toast.success(summary);
      }
      onClose();
    },
  });

  const downloadTemplate = () => {
    const blob = new Blob([materialsImportTemplateCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raw-materials-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="xl"
      closeOnOverlayClick={false}
      title="Import materials"
      description="Add many materials at once from an Excel or CSV file."
      footer={(
        <>
          {rows.length > 0 && (
            <label className="mr-auto flex items-center gap-2 text-[13px] text-erp-text-secondary">
              <input type="checkbox" checked={postOpeningStock} onChange={(e) => setPostOpeningStock(e.target.checked)} />
              Post opening quantities as stock
            </label>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={run.isPending} disabled={!rows.length} onClick={() => run.mutate()}>
            {rows.length ? `Import ${rows.length} material${rows.length === 1 ? '' : 's'}` : 'Import'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon={<Download size={16} />} onClick={downloadTemplate}>Download template</Button>
          <label className={`erp-btn-primary cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            <FileSpreadsheet size={16} aria-hidden="true" />
            {busy ? 'Reading…' : rows.length ? 'Choose another file' : 'Choose file'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={busy || run.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = '';
                void pick(f);
              }}
            />
          </label>
          {fileName && <span className="text-[13px] text-erp-text-muted">{fileName} · {rows.length} rows</span>}
        </div>
        {fileError && <InfoBanner inset={false} tone="danger">{fileError}</InfoBanner>}
        {!rows.length && !fileError && (
          <InfoBanner inset={false} tone="muted">
            Fill in the template (code, name, category, unit, cost, opening quantity), then choose the file to preview it here before importing.
          </InfoBanner>
        )}
        {rows.length > 0 && (
          <div className="erp-table-wrap max-h-[60vh] rounded-lg border border-[var(--erp-border)]">
            <ErpDataTable className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th className="erp-num">Cost</th>
                  <th className="erp-num">Opening qty</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={`${r.materialCode}-${i}`}>
                    <td className="font-mono">{r.materialCode || <span className="text-erp-text-muted">Auto</span>}</td>
                    <td>{r.name}</td>
                    <td className="text-erp-text-muted">{r.vendorName || '—'}</td>
                    <td>{r.category}</td>
                    <td>{unitLabel(r.unit)}</td>
                    <td className="erp-num">{r.unitCost || 0}</td>
                    <td className="erp-num">{r.openingQty || 0}</td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </div>
        )}
        {rows.length > 100 && <p className="text-[13px] text-erp-text-muted">Showing the first 100 of {rows.length} rows. All rows will be imported.</p>}
      </div>
    </Drawer>
  );
}

/* ───────────────────────── Manual receipt ───────────────────────── */

/** Post stock without a purchase (opening balances, corrections). */
export function ManualReceiptModal({
  open, onClose, initialMaterialId,
}: {
  open: boolean;
  onClose: () => void;
  initialMaterialId?: string;
}) {
  const invalidate = useInvalidateInventory();
  const [materialId, setMaterialId] = useState('');
  const [qty, setQty] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setMaterialId(initialMaterialId || ''); setQty(''); setErrors({}); }
  }, [open, initialMaterialId]);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => inventoryApi.listMaterials(),
    enabled: open,
  });
  const options: ErpSearchOption[] = useMemo(
    () => materials.map((m: Material) => ({ value: m._id, label: `${m.materialCode} — ${m.name}` })),
    [materials],
  );
  const mat = materials.find((m: Material) => m._id === materialId);

  const receipt = useMutation({
    mutationFn: () => inventoryApi.receipt({ materialId, quantity: Number(qty), unit: mat?.unit || 'METERS' }),
    meta: { successMessage: 'Stock received', successDescription: 'Posted to the unallocated dock.' },
    onSuccess: () => { invalidate(); onClose(); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!materialId) next.material = 'Choose a material.';
    if (!(Number(qty) > 0)) next.qty = 'Enter a quantity above 0.';
    setErrors(next);
    if (Object.keys(next).length === 0) receipt.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Manual stock receipt"
      description="For opening balances and corrections. Normal intake is a purchase goods receipt checked by QC."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="manual-receipt-form" loading={receipt.isPending} disabled={!materialId || !(Number(qty) > 0)}>
            Post receipt
          </Button>
        </>
      )}
    >
      <form id="manual-receipt-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Material" required error={errors.material}>
          <ErpSearchSelect
            className="w-full"
            value={materialId}
            onChange={(v) => { setMaterialId(v); setErrors((e) => ({ ...e, material: '' })); }}
            options={options}
            loading={isLoading}
            placeholder="Search code or name…"
          />
        </Field>
        <Field label="Quantity received" required error={errors.qty} hint="Stock goes to the unallocated dock — put it away in Warehouse.">
          <UnitInput min={0} step="any" unit={mat ? unitLabel(mat.unit) : undefined} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
        </Field>
      </form>
    </Modal>
  );
}
