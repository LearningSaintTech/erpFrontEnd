import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { bomApi, inventoryApi, skuApi } from '../../services/manufacturing';
import {
  Badge, Button, DescriptionList, Drawer, ErpDataTable, ErpInput, ErpSearchSelect, Field, IconButton, InfoBanner,
  Modal, Section, StatusBadge, StepFlow, type Step,
} from '../../components/erp';
import type { Bom, BomLine, Material, MrpPreview, Sku } from '../../types/api';
import { formatCost, isOwnSubmission, materialIdOf, materialLabel, mrpShortageCount, skuLabel } from './bomUtils';
import type { useBomActions } from './useBomActions';
import { SaveState } from '../design/components/StickyActionBar';
import './bomTypes';
import { useAuth } from '../../app/providers/AuthProvider';

type EditLine = {
  materialId: string;
  quantityPerPiece: number;
  unit: string;
  wastagePercent: number;
  unitCost?: number;
  isOptional?: boolean;
  materialCategory?: string;
};

function toEditLines(b: Bom): EditLine[] {
  return (b.lines || []).map((l) => ({
    materialId: materialIdOf(l),
    quantityPerPiece: l.quantityPerPiece,
    unit: l.unit || 'PIECES',
    wastagePercent: l.wastagePercent ?? 0,
    unitCost: l.unitCost,
    isOptional: (l as BomLine).isOptional,
    materialCategory: (l as BomLine).materialCategory,
  }));
}

export function bomStepFlow(status: string): Step[] {
  const order = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE'];
  const idx = order.indexOf(status);
  const labels = ['Draft', 'Approval', 'Approved', 'Active'];
  return labels.map((label, i) => ({
    id: order[i],
    label,
    state: status === 'OBSOLETE' ? 'done' : i < idx ? 'done' : i === idx ? (status === 'ACTIVE' ? 'done' : 'current') : 'upcoming',
  }));
}

/* ───────────────────────────── New BOM ───────────────────────────── */

const SOURCE_LABEL: Record<string, string> = {
  pattern_bom: 'the pattern tech pack',
  pattern: 'the pattern tech pack',
  design: 'the design',
  design_bom: 'the design',
  sample: "the sample's materials",
  sample_materials: "the sample's materials",
};

export function NewBomDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (bom: Bom) => void }) {
  const qc = useQueryClient();
  const [skuId, setSkuId] = useState('');
  const [skuError, setSkuError] = useState('');

  useEffect(() => { if (open) { setSkuId(''); setSkuError(''); } }, [open]);

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['skus-active-bom'],
    queryFn: () => skuApi.list({ status: 'ACTIVE', limit: 200 }),
    enabled: open,
  });

  const { data: suggestion, isFetching } = useQuery({
    queryKey: ['bom-suggest', skuId],
    queryFn: () => bomApi.suggestLines(skuId),
    enabled: !!skuId,
  });

  const create = useMutation({
    mutationFn: () => bomApi.create({ skuId, fromDesign: true }),
    meta: { successMessage: 'BOM created', successDescription: 'Review the lines, then submit it for approval.' },
    onSuccess: (bom) => {
      qc.invalidateQueries({ queryKey: ['boms'] });
      qc.invalidateQueries({ queryKey: ['bom-stats'] });
      onCreated(bom);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!skuId) { setSkuError('Choose the SKU this BOM is for.'); return; }
    create.mutate();
  };

  const lines = suggestion?.lines ?? [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      title="New BOM"
      description="Lines are filled from the pattern tech pack (or the sample's materials). One draft per SKU."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="new-bom-form" loading={create.isPending}>Create BOM</Button>
        </>
      )}
    >
      <form id="new-bom-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="SKU" required error={skuError} htmlFor="bom-sku">
          <ErpSearchSelect
            id="bom-sku"
            className="w-full"
            value={skuId}
            loading={isLoading}
            placeholder="Select active SKU…"
            searchPlaceholder="Search SKU code or name…"
            emptyText="No active SKUs"
            options={skus.map((s: Sku) => ({ value: s._id, label: `${s.skuCode} — ${s.name}`, keywords: `${s.skuCode} ${s.name}` }))}
            onChange={(id) => { setSkuId(id); setSkuError(''); }}
          />
        </Field>
        {skuId && (
          <Section title="Lines that will be added" description={suggestion?.source ? `From ${SOURCE_LABEL[suggestion.source] ?? suggestion.source.replace(/_/g, ' ')}` : undefined} flush={lines.length > 0}>
            {isFetching ? (
              <p className="text-[13px] text-erp-text-muted">Loading suggestion…</p>
            ) : lines.length ? (
              <ErpDataTable>
                <thead><tr><th>Material</th><th className="erp-num">Per piece</th></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.materialCode && l.materialName ? `${l.materialCode} — ${l.materialName}` : (l.materialCode || l.materialName || materialLabel(l.materialId))}</td>
                      <td className="erp-num">
                        {l.quantityPerPiece ?? '—'} {(l.unit || '').toLowerCase()}
                        {/* The marker's metres include wastage; show it so 1.4 vs 1.47 isn't a surprise. */}
                        {Number(l.wastagePercent) > 0 && <span className="block text-xs text-erp-text-muted">+{l.wastagePercent}% wastage</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ErpDataTable>
            ) : (
              <p className="text-[13px] text-erp-text-muted">No lines found — you can add them after creating the BOM.</p>
            )}
          </Section>
        )}
      </form>
    </Drawer>
  );
}

/* ──────────────────────────── BOM detail ─────────────────────────── */

export function BomDetailDrawer({
  bom: initial,
  startEditing,
  onClose,
  actions,
  canUpdate,
  canApprove,
}: {
  bom: Bom | null;
  startEditing?: boolean;
  onClose: () => void;
  actions: ReturnType<typeof useBomActions>;
  canUpdate: boolean;
  canApprove: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [baseline, setBaseline] = useState('');
  const shownId = useRef<string | null>(null);

  // Always show the latest copy of the BOM (the list row may be stale or on another tab).
  const { data: fresh } = useQuery({
    queryKey: ['bom', initial?._id],
    queryFn: () => bomApi.get(initial!._id),
    enabled: !!initial,
    placeholderData: initial ?? undefined,
  });
  const bom = initial ? (fresh && fresh._id === initial._id ? fresh : initial) : null;

  useEffect(() => {
    if (!bom) { shownId.current = null; return; }
    const switched = shownId.current !== bom._id;
    if (!switched && editing) return; // keep in-progress edits when the record refreshes
    shownId.current = bom._id;
    const l = toEditLines(bom);
    setLines(l);
    setBaseline(JSON.stringify(l));
    if (switched) setEditing(!!startEditing && canUpdate && bom.status === 'DRAFT');
  }, [bom, startEditing, canUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: materials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => inventoryApi.listMaterials(),
    enabled: editing,
  });
  const materialOptions = useMemo(
    () => materials.map((m: Material) => ({ value: m._id, label: `${m.materialCode} — ${m.name}`, keywords: `${m.materialCode} ${m.name}` })),
    [materials],
  );

  const save = useMutation({
    mutationFn: () => bomApi.update(bom!._id, lines.map((l) => ({
      materialId: l.materialId,
      quantityPerPiece: l.quantityPerPiece,
      unit: l.unit,
      wastagePercent: l.wastagePercent,
      // Keep the frozen standard rate and flags - omitting them would reset to master rate / false.
      unitCost: l.unitCost,
      isOptional: l.isOptional,
      materialCategory: l.materialCategory,
    }))),
    meta: { successMessage: 'BOM lines saved' },
    onSuccess: () => {
      setBaseline(JSON.stringify(lines));
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['boms'] });
      qc.invalidateQueries({ queryKey: ['bom-stats'] });
      qc.invalidateQueries({ queryKey: ['bom', bom?._id] });
    },
  });

  if (!bom) return <Drawer open={false} onClose={onClose} />;

  const dirty = editing && JSON.stringify(lines) !== baseline;
  const update = (i: number, patch: Partial<EditLine>) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addLine = () => {
    const first = materials[0];
    if (!first) return;
    setLines((ls) => [...ls, {
      materialId: first._id, quantityPerPiece: 1, unit: first.unit || 'PIECES', wastagePercent: 0, unitCost: first.unitCost, materialCategory: first.category,
    }]);
  };

  const s = bom.status;
  const busy = actions.pending;
  const latest = bom.isLatestVersion !== false;

  let footer;
  if (editing) {
    footer = (
      <>
        <span className="mr-auto text-[13px]"><SaveState dirty={dirty} saving={save.isPending} /></span>
        <Button variant="secondary" onClick={() => { setLines(JSON.parse(baseline)); setEditing(false); }}>Cancel</Button>
        <Button loading={save.isPending} disabled={!lines.length || !dirty} onClick={() => save.mutate()}>Save lines</Button>
      </>
    );
  } else {
    footer = (
      <>
        {canApprove && s === 'PENDING_APPROVAL' && (
          <>
            <Button variant="danger" disabled={busy} onClick={() => actions.reject(bom)}>Reject</Button>
            <Button variant="secondary" disabled={busy} onClick={() => actions.requestChanges(bom)}>Request changes</Button>
          </>
        )}
        {canUpdate && s === 'DRAFT' && (
          <Button variant="secondary" onClick={() => setEditing(true)}>Edit lines</Button>
        )}
        {canApprove && s === 'DRAFT' && !canUpdate && (
          <Button disabled={busy} onClick={() => actions.approve(bom)}>Approve</Button>
        )}
        {canUpdate && s === 'DRAFT' && <Button disabled={busy} onClick={() => actions.submit(bom)}>Submit for approval</Button>}
        {canApprove && s === 'PENDING_APPROVAL' && !isOwnSubmission(bom, user) && <Button disabled={busy} onClick={() => actions.approve(bom)}>Approve</Button>}
        {canUpdate && s === 'APPROVED' && latest && <Button disabled={busy} onClick={() => actions.finalize(bom)}>Freeze and run MRP</Button>}
        {s === 'ACTIVE' && <Button variant="secondary" disabled={busy} onClick={() => actions.showMrp(bom)}>View MRP</Button>}
      </>
    );
  }

  const totalPerPiece = bom.totalCostPerPiece;

  return (
    <Drawer
      open={!!bom}
      onClose={onClose}
      size="lg"
      closeOnOverlayClick={!dirty}
      title={bom.bomCode}
      description={`${skuLabel(bom.skuId)} · version ${bom.version}`}
      headerExtra={<StatusBadge status={s} />}
      footer={footer}
    >
      <div className="space-y-4">
        {s !== 'OBSOLETE' && <StepFlow steps={bomStepFlow(s)} size="sm" />}

        {s === 'ACTIVE' && bom.needsReview && (
          <InfoBanner inset={false} tone="warn" icon={<AlertTriangle size={16} />} title="Needs review">
            {bom.reviewReason || 'The source pattern was reopened. Build and freeze a new version.'}
          </InfoBanner>
        )}
        {s === 'DRAFT' && (bom.revisionComments || bom.rejectionComments) && (
          <InfoBanner inset={false} tone="warn" title={bom.revisionComments ? 'Changes requested' : 'Rejected'}>
            <p className="whitespace-pre-wrap">{bom.revisionComments || bom.rejectionComments}</p>
          </InfoBanner>
        )}

        <DescriptionList
          columns={3}
          items={[
            { label: 'Lines', value: String(bom.lines?.length ?? 0) },
            { label: 'Standard cost / piece', value: <span className="tabular-nums">{formatCost(totalPerPiece)}</span> },
            { label: 'Version', value: `v${bom.version}${latest ? '' : ' (older)'}` },
          ]}
        />

        <Section
          title={editing ? 'Edit lines' : 'Lines'}
          actions={editing ? <Button size="sm" variant="secondary" icon={<Plus size={14} />} disabled={!materials.length} onClick={addLine}>Add line</Button> : undefined}
          flush
        >
          <ErpDataTable className="min-w-[640px]">
            <thead>
              <tr>
                <th>Material</th>
                <th className="erp-num">Qty / piece</th>
                <th className="erp-num">Wastage %</th>
                <th className="erp-num">Std rate</th>
                <th>Optional</th>
                {editing && <th className="erp-cell-actions"><span className="sr-only">Remove</span></th>}
              </tr>
            </thead>
            <tbody>
              {editing ? lines.map((l, i) => {
                const opts = l.materialId && !materialOptions.some((o) => o.value === l.materialId)
                  ? [{ value: l.materialId, label: materialLabel(bom.lines?.find((x) => materialIdOf(x) === l.materialId)?.materialId) }, ...materialOptions]
                  : materialOptions;
                return (
                  <tr key={i}>
                    <td className="min-w-[220px] !py-1.5">
                      <ErpSearchSelect
                        className="w-full"
                        value={l.materialId}
                        options={opts}
                        placeholder="Select material…"
                        onChange={(id) => {
                          const mat = materials.find((m: Material) => m._id === id);
                          update(i, { materialId: id, unit: mat?.unit || l.unit, unitCost: mat?.unitCost, materialCategory: mat?.category });
                        }}
                      />
                    </td>
                    <td className="erp-num !py-1.5">
                      <span className="inline-flex items-center gap-1">
                        <ErpInput inputSize="sm" type="number" min={0} step="0.01" aria-label="Quantity per piece" className="w-20 text-right tabular-nums" value={l.quantityPerPiece} onChange={(e) => update(i, { quantityPerPiece: Number(e.target.value) })} />
                        <span className="text-xs text-erp-text-muted">{l.unit.toLowerCase()}</span>
                      </span>
                    </td>
                    <td className="erp-num !py-1.5">
                      <ErpInput inputSize="sm" type="number" min={0} max={100} aria-label="Wastage percent" className="w-16 text-right tabular-nums" value={l.wastagePercent} onChange={(e) => update(i, { wastagePercent: Number(e.target.value) })} />
                    </td>
                    <td className="erp-num">{formatCost(l.unitCost ?? materials.find((m: Material) => m._id === l.materialId)?.unitCost)}</td>
                    <td>
                      <input type="checkbox" className="h-4 w-4" aria-label="Optional line" checked={!!l.isOptional} onChange={(e) => update(i, { isOptional: e.target.checked })} />
                    </td>
                    <td className="erp-cell-actions !py-1.5">
                      <IconButton size="sm" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 size={14} /></IconButton>
                    </td>
                  </tr>
                );
              }) : (bom.lines || []).map((l: BomLine, i) => (
                <tr key={i}>
                  <td className="erp-cell-primary">{materialLabel(l.materialId)}</td>
                  <td className="erp-num">{l.quantityPerPiece} <span className="text-erp-text-muted">{(l.unit || '').toLowerCase()}</span></td>
                  <td className="erp-num">{l.wastagePercent ?? 0}%</td>
                  <td className="erp-num">{formatCost(l.unitCost)}</td>
                  <td>{(l as BomLine).isOptional ? <Badge tone="neutral">Optional</Badge> : '—'}</td>
                </tr>
              ))}
              {!(editing ? lines.length : bom.lines?.length) && (
                <tr><td colSpan={6} className="py-6 text-center text-[13px] text-erp-text-muted">No lines yet.</td></tr>
              )}
            </tbody>
          </ErpDataTable>
        </Section>
      </div>
    </Drawer>
  );
}

/* ───────────────────────────── MRP modal ─────────────────────────── */

/** Up to 3 decimals, grouped: 1.6800000000000002 → "1.68", 6934 → "6,934". */
const fmtQty = (n?: number) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export function MrpModal({ view, onClose }: { view: { bom: Bom; mrp: MrpPreview } | null; onClose: () => void }) {
  const mrp = view?.mrp;
  const nameFor = (id?: string) => {
    const line = view?.bom.lines?.find((l) => materialIdOf(l) === String(id));
    return line ? materialLabel(line.materialId) : materialLabel(id);
  };
  const shortages = mrpShortageCount(mrp);
  return (
    <Modal
      open={!!view}
      onClose={onClose}
      size="lg"
      title={view ? `MRP preview — ${view.bom.bomCode}` : 'MRP preview'}
      description={mrp ? `For ${mrp.orderQuantity} ${mrp.orderQuantity === 1 ? 'piece' : 'pieces'} · standard cost ${formatCost(mrp.totalCost)}` : undefined}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
      flush
    >
      {mrp && (
        <>
          {mrp.hasShortage && (
            <InfoBanner tone="warn" icon={<AlertTriangle size={16} />}>
              {shortages} material{shortages === 1 ? ' is' : 's are'} short — check inventory before production.
            </InfoBanner>
          )}
          <div className="erp-table-wrap">
            <ErpDataTable>
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="erp-num">Required</th>
                  <th className="erp-num">Available</th>
                  <th className="erp-num">Short</th>
                  <th className="erp-num">Std cost</th>
                </tr>
              </thead>
              <tbody>
                {(mrp.lines || []).map((l, i) => (
                  <tr key={i}>
                    <td className="erp-cell-primary">{l.materialCode || nameFor(l.materialId)}</td>
                    <td className="erp-num">{fmtQty(l.requiredQty)} <span className="text-erp-text-muted">{(l.unit || '').toLowerCase()}</span></td>
                    <td className="erp-num">{fmtQty(l.availableQty)} <span className="text-erp-text-muted">{(l.unit || '').toLowerCase()}</span></td>
                    <td className={`erp-num ${(l.shortageQty ?? 0) > 0 ? 'font-medium text-[var(--erp-warning-text)]' : ''}`}>{fmtQty(l.shortageQty ?? 0)}</td>
                    <td className="erp-num">{formatCost(l.extendedCost)}</td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </div>
        </>
      )}
    </Modal>
  );
}
