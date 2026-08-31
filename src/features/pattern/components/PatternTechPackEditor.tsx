import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErpButton, ErpCard, ErpSearchSelect } from '../../../components/erp';
import { InventoryCodeChips, InventoryCodeSelect } from '../../../components/InventoryCodeSelect';
import { StoreMaterialRequestPanel } from './StoreMaterialRequestPanel';
import type {
  PatternTechPack, FabricConsumption, DesignBomLine, SizeChartData, DesignAccessory,
  PatternFabricSpecs, PatternCosting, QualityNotes, ManufacturingNotes, ProductionInfo,
} from '../../../types/api';

type MaterialOption = { _id: string; materialCode: string; name: string; unit: string; category?: string; unitCost?: number };

export type TechPackFormState = {
  unit: string;
  sizeLabels: string[];
  rows: { measurementName: string; values: Record<string, string> }[];
  fabrics: FabricConsumption[];
  bomLines: DesignBomLine[];
  accessories: DesignAccessory[];
  fabricSpecs: PatternFabricSpecs;
  qualityNotes: QualityNotes;
  manufacturingNotes: ManufacturingNotes;
  costing: PatternCosting;
  productionInfo: ProductionInfo;
};

const label = 'mb-1 block text-[10px] font-medium text-erp-text-muted';
const input = 'w-full rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] px-2 py-1 text-[11px] disabled:opacity-60';

const compactSelect = 'w-full !py-1 text-[11px]';

const STORE_TO_PATTERN_UNIT: Record<string, string> = {
  METERS: 'M',
  YARDS: 'YD',
  PIECES: 'PC',
  CONES: 'CONE',
  KG: 'KG',
};

function toFormState(techPack: PatternTechPack): TechPackFormState {
  const tp = techPack.techPack;
  const src: SizeChartData | undefined = tp?.sizeChartData ?? techPack.design.sizeChartData;
  const fabrics = (tp?.fabricConsumption ?? techPack.design.fabricConsumption ?? []) as FabricConsumption[];
  const bomLines = (tp?.bomLines ?? techPack.design.bomLines ?? []) as DesignBomLine[];
  const accessories = (tp?.accessories ?? techPack.design.accessories ?? []) as DesignAccessory[];
  const sizeLabels = src?.sizeLabels?.length ? src.sizeLabels : (techPack.design.sizeChartData?.sizeLabels ?? []);
  return {
    unit: src?.unit || 'CM',
    sizeLabels: [...sizeLabels],
    rows: (src?.rows ?? []).map((r) => ({
      measurementName: r.measurementName,
      values: Object.fromEntries(Object.entries(r.values ?? {}).map(([k, v]) => [k, String(v ?? '')])),
    })),
    fabrics: fabrics.map((f) => ({ ...f })),
    bomLines: bomLines.map((b) => ({ ...b })),
    accessories: accessories.map((a) => ({ ...a })),
    fabricSpecs: { ...(tp?.fabricSpecs ?? {}) },
    qualityNotes: { checklist: [], ...(tp?.qualityNotes ?? {}) },
    manufacturingNotes: { ...(tp?.manufacturingNotes ?? {}) },
    costing: { ...(tp?.costing ?? {}) },
    productionInfo: { productionPriority: 'NORMAL', ...(tp?.productionInfo ?? {}) },
  };
}

export type TechPackPayload = {
  sizeChartData: SizeChartData;
  fabricConsumption: FabricConsumption[];
  bomLines: DesignBomLine[];
  accessories: DesignAccessory[];
  fabricSpecs: PatternFabricSpecs;
  qualityNotes: QualityNotes;
  manufacturingNotes: ManufacturingNotes;
  costing: PatternCosting;
  productionInfo: ProductionInfo;
};

export function techPackFormToPayload(form: TechPackFormState): TechPackPayload {
  const fabrics = form.fabrics.filter((f) => f.materialId);
  const accessories = form.accessories.filter((a) => a.materialId || a.accessoryType);
  const sampleBom: DesignBomLine[] = [
    ...fabrics.map((f) => ({
      materialId: f.materialId,
      quantity: f.consumption || 0,
      unit: f.unit || 'M',
      category: 'FABRIC',
    })),
    ...accessories.map((a) => ({
      materialId: a.materialId,
      materialName: a.accessoryType,
      quantity: a.consumption || 0,
      unit: a.unit || 'PC',
      category: 'TRIM',
    })),
  ];
  return {
    sizeChartData: {
      unit: form.unit || 'CM',
      sizeLabels: form.sizeLabels,
      rows: form.rows
        .filter((r) => r.measurementName.trim())
        .map((r) => ({
          measurementName: r.measurementName.trim(),
          values: Object.fromEntries(
            form.sizeLabels
              .map((s) => [s, Number(r.values[s])] as const)
              .filter(([, v]) => !Number.isNaN(v)),
          ),
        })),
    },
    fabricConsumption: fabrics,
    bomLines: sampleBom,
    accessories,
    fabricSpecs: form.fabricSpecs,
    qualityNotes: {
      measurementTolerance: form.qualityNotes.measurementTolerance,
      checklist: [],
    },
    manufacturingNotes: {
      specialStitch: form.manufacturingNotes.specialStitch,
      needleType: form.manufacturingNotes.needleType,
      machineType: form.manufacturingNotes.machineType,
      threadColor: form.manufacturingNotes.threadColor,
    },
    costing: {
      fabricCost: form.costing.fabricCost,
      accessoriesCost: form.costing.accessoriesCost,
    },
    productionInfo: form.productionInfo,
  };
}

export function PatternTechPackEditor({
  techPack,
  materials,
  readOnly,
  saving,
  onSave,
  designId,
}: {
  techPack: PatternTechPack;
  materials: MaterialOption[];
  readOnly: boolean;
  saving: boolean;
  onSave: (payload: ReturnType<typeof techPackFormToPayload>) => void;
  designId: string;
}) {
  const [form, setForm] = useState<TechPackFormState>(() => toFormState(techPack));
  const [pendingMeas, setPendingMeas] = useState('');
  const [extraMaterials, setExtraMaterials] = useState<MaterialOption[]>([]);

  const allMaterials = useMemo(() => {
    const map = new Map(materials.map((m) => [m._id, m]));
    for (const m of extraMaterials) {
      if (m._id && !map.has(m._id)) map.set(m._id, m);
    }
    return [...map.values()];
  }, [materials, extraMaterials]);

  const matLabel = useMemo(() => {
    const map = new Map(allMaterials.map((m) => [m._id, m]));
    return (id?: string) => (id ? map.get(id) : undefined);
  }, [allMaterials]);

  const materialOptions = useMemo(
    () => allMaterials.map((m) => ({
      value: m._id,
      label: `${m.materialCode} — ${m.name}`,
      keywords: `${m.materialCode} ${m.name} ${m.category || ''} ${m.unit || ''}`,
    })),
    [allMaterials],
  );

  useEffect(() => {
    if (!materials.length) return;
    setForm((f) => ({
      ...f,
      fabrics: f.fabrics.map((fab) => {
        if (fab.fabricCost) return fab;
        const m = fab.materialId ? materials.find((x) => x._id === fab.materialId) : undefined;
        return m?.unitCost ? { ...fab, fabricCost: m.unitCost } : fab;
      }),
      accessories: f.accessories.map((a) => {
        if (a.unitCost) return a;
        const m = a.materialId ? materials.find((x) => x._id === a.materialId) : undefined;
        return m?.unitCost ? { ...a, unitCost: m.unitCost } : a;
      }),
    }));
  }, [materials]);

  const set = (patch: Partial<TechPackFormState>) => setForm((f) => ({ ...f, ...patch }));

  const setSizeLabels = (next: string[]) => {
    setForm((f) => ({
      ...f,
      sizeLabels: next,
      rows: f.rows.map((r) => {
        const values = { ...r.values };
        for (const k of Object.keys(values)) {
          if (!next.some((s) => s.toLowerCase() === k.toLowerCase())) delete values[k];
        }
        return { ...r, values };
      }),
    }));
  };

  const addMeasurementNamed = (name: string) => {
    const n = name.trim();
    if (!n) return;
    setForm((f) => {
      if (f.rows.some((r) => r.measurementName.toLowerCase() === n.toLowerCase())) return f;
      return { ...f, rows: [...f.rows, { measurementName: n, values: {} }] };
    });
  };
  const removeRow = (i: number) => set({ rows: form.rows.filter((_, j) => j !== i) });
  const setCell = (i: number, size: string, value: string) => set({
    rows: form.rows.map((r, j) => (j === i ? { ...r, values: { ...r.values, [size]: value } } : r)),
  });

  const addFabric = () => set({ fabrics: [...form.fabrics, { materialId: '', consumption: 0, unit: 'M', wastagePercent: 0 }] });
  const setFabric = (i: number, patch: Partial<FabricConsumption>) => set({
    fabrics: form.fabrics.map((f, j) => (j === i ? { ...f, ...patch } : f)),
  });
  const removeFabric = (i: number) => set({ fabrics: form.fabrics.filter((_, j) => j !== i) });

  const attachApprovedFabrics = useCallback((items: MaterialOption[]) => {
    setExtraMaterials((prev) => {
      const have = new Set(prev.map((p) => p._id));
      const add = items.filter((m) => m._id && !have.has(m._id));
      return add.length ? [...prev, ...add] : prev;
    });
    setForm((f) => {
      const have = new Set(f.fabrics.map((x) => x.materialId).filter(Boolean));
      const extras = items.filter((m) => m._id && !have.has(m._id));
      if (!extras.length) return f;
      const next = [...f.fabrics];
      for (const m of extras) {
        const line: FabricConsumption = {
          materialId: m._id,
          consumption: 0,
          unit: STORE_TO_PATTERN_UNIT[m.unit] || m.unit || 'M',
          fabricCost: m.unitCost || 0,
          wastagePercent: 0,
        };
        const emptyIdx = next.findIndex((l) => !l.materialId);
        if (emptyIdx >= 0) next[emptyIdx] = { ...next[emptyIdx], ...line };
        else next.push(line);
      }
      return { ...f, fabrics: next };
    });
  }, []);

  const addTrim = () => set({
    accessories: [...form.accessories, { accessoryType: 'BUTTON', consumption: 1, unit: 'PIECES', unitCost: 0 }],
  });
  const setTrim = (i: number, patch: Partial<DesignAccessory>) => set({
    accessories: form.accessories.map((a, j) => (j === i ? { ...a, ...patch } : a)),
  });
  const removeTrim = (i: number) => set({ accessories: form.accessories.filter((_, j) => j !== i) });

  const setSpecs = (patch: Partial<PatternFabricSpecs>) => set({ fabricSpecs: { ...form.fabricSpecs, ...patch } });
  const setQuality = (patch: Partial<QualityNotes>) => set({ qualityNotes: { ...form.qualityNotes, ...patch } });
  const setMfg = (patch: Partial<ManufacturingNotes>) => set({ manufacturingNotes: { ...form.manufacturingNotes, ...patch } });

  const fabricCost = form.fabrics.reduce(
    (s, f) => s + (f.consumption || 0) * (1 + (f.wastagePercent || 0) / 100) * (f.fabricCost || 0),
    0,
  );
  const trimsCost = form.accessories.reduce((s, a) => s + (a.consumption || 0) * (a.unitCost || 0), 0);
  const totalCost = fabricCost + trimsCost;

  return (
    <div className="space-y-3">
      {techPack.techPack?.source === 'design_legacy' && (
        <p className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-800">
          Pre-filled from the designer&apos;s original brief. Confirm and adjust the production values, then save.
        </p>
      )}

      <ErpCard className="!p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold text-erp-text-primary">Graded measurement chart</h3>
          <div className="w-28">
            <span className={label}>Unit</span>
            <select
              value={/^in/i.test(form.unit) ? 'IN' : 'CM'}
              onChange={(e) => set({ unit: e.target.value })}
              disabled={readOnly}
              className={input}
            >
              <option value="CM">cm</option>
              <option value="IN">in</option>
            </select>
          </div>
        </div>

        <div className="mb-2">
          <span className={label}>Size range</span>
          {readOnly ? (
            <div className="flex flex-wrap gap-1.5">
              {form.sizeLabels.map((s) => (
                <span key={s} className="rounded border border-[var(--erp-border)] px-2 py-0.5 font-mono text-[10px]">{s}</span>
              ))}
              {!form.sizeLabels.length && <span className="text-[10px] text-amber-700">No sizes on this chart.</span>}
            </div>
          ) : (
            <InventoryCodeChips type="SIZE" values={form.sizeLabels} onChange={setSizeLabels} />
          )}
          {!form.sizeLabels.length && !readOnly && (
            <p className="mt-1 text-[10px] text-amber-700">Pick the size range this style is graded to.</p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-[10px]">
            <thead>
              <tr className="border-b border-[var(--erp-border)] text-erp-text-muted">
                <th className="py-1 pr-2 font-medium">Measurement</th>
                {form.sizeLabels.map((s) => (
                  <th key={s} className="px-1 py-1 font-medium">{s}</th>
                ))}
                {!readOnly && <th className="w-6" />}
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, i) => (
                <tr key={row.measurementName} className="border-b border-[var(--erp-border)]/60">
                  <td className="py-1 pr-2 font-medium">{row.measurementName}</td>
                  {form.sizeLabels.map((s) => (
                    <td key={s} className="px-1 py-1">
                      <input
                        type="number"
                        step="0.1"
                        value={row.values[s] ?? ''}
                        onChange={(e) => setCell(i, s, e.target.value)}
                        disabled={readOnly}
                        className="w-14 rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] px-1 py-0.5 font-mono disabled:opacity-60"
                      />
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="px-1 py-1">
                      <button type="button" onClick={() => removeRow(i)} className="text-erp-text-muted hover:text-red-600" aria-label="Remove row">×</button>
                    </td>
                  )}
                </tr>
              ))}
              {!form.rows.length && (
                <tr><td colSpan={form.sizeLabels.length + 2} className="py-2 text-[10px] text-erp-text-muted">No measurement rows yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <div className="mt-2 max-w-xs">
            <span className={label}>Add measurement</span>
            <InventoryCodeSelect
              type="MEASUREMENT"
              value={pendingMeas}
              placeholder="e.g. Chest, Length…"
              className={compactSelect}
              onChange={(code, item) => {
                addMeasurementNamed(item?.name || code);
                setPendingMeas('');
              }}
            />
          </div>
        )}
      </ErpCard>

      <ErpCard className="!p-3">
        <h3 className="mb-1 text-[11px] font-semibold text-erp-text-primary">Fabric consumption</h3>
        <p className="mb-2 text-[10px] text-erp-text-muted">
          Store fabric and meters per garment. Marker save writes meters here. Cutting wastage lives on the marker, not this line.
        </p>
        <div className="space-y-2">
          {form.fabrics.map((f, i) => (
            <div key={i} className="grid grid-cols-12 items-start gap-2">
              <div className="col-span-5">
                <span className={label}>Material</span>
                <ErpSearchSelect
                  value={f.materialId || ''}
                  options={materialOptions}
                  disabled={readOnly}
                  placeholder="Select fabric…"
                  searchPlaceholder="Search fabric…"
                  className={compactSelect}
                  onChange={(id) => {
                    const m = matLabel(id);
                    setFabric(i, {
                      materialId: id,
                      unit: m?.unit || f.unit || 'M',
                      fabricCost: m?.unitCost ?? f.fabricCost ?? 0,
                    });
                  }}
                />
              </div>
              <div className="col-span-3">
                <span className={label}>Meters / pc</span>
                <input type="number" step="0.01" value={f.consumption ?? ''} onChange={(e) => setFabric(i, { consumption: Number(e.target.value) })} disabled={readOnly} className={input} />
              </div>
              <div className="col-span-2">
                <span className={label}>Unit</span>
                <InventoryCodeSelect
                  type="UNIT"
                  value={f.unit || ''}
                  onChange={(code) => setFabric(i, { unit: code })}
                  disabled={readOnly}
                  className={compactSelect}
                  placeholder="Unit"
                />
              </div>
              <div className="col-span-1">
                <span className={label}>Quoted rate</span>
                <p className="px-2 py-1 font-mono text-[11px] text-erp-text-muted">{(f.fabricCost || 0).toFixed(2)}</p>
              </div>
              {!readOnly && (
                <div className="col-span-1 pt-5">
                  <button type="button" onClick={() => removeFabric(i)} className="text-erp-text-muted hover:text-red-600" aria-label="Remove fabric">×</button>
                </div>
              )}
            </div>
          ))}
          {!form.fabrics.length && <p className="text-[10px] text-amber-700">Add at least one fabric line.</p>}
        </div>
        {!readOnly && <button type="button" onClick={addFabric} className="mt-2 text-[10px] text-[var(--erp-accent)]">+ Add fabric</button>}
        {designId && (
          <StoreMaterialRequestPanel
            designId={designId}
            defaultName={techPack.design.productSpecs?.material || ''}
            category="FABRIC"
            readOnly={readOnly}
            onApproved={attachApprovedFabrics}
          />
        )}
      </ErpCard>

      <ErpCard className="!p-3">
        <h3 className="mb-1 text-[11px] font-semibold text-erp-text-primary">Trims &amp; findings</h3>
        <p className="mb-2 text-[10px] text-erp-text-muted">
          Buttons, zippers, labels, thread. Together with fabric this is the sample BOM — costing freezes rates after proto.
        </p>
        <div className="space-y-2">
          {form.accessories.map((a, i) => (
            <div key={i} className="grid grid-cols-12 items-start gap-2">
              <div className="col-span-3">
                <span className={label}>Type</span>
                <InventoryCodeSelect
                  type="ACCESSORY"
                  value={a.accessoryType || ''}
                  onChange={(code) => setTrim(i, { accessoryType: code })}
                  disabled={readOnly}
                  className={compactSelect}
                  placeholder="Type"
                />
              </div>
              <div className="col-span-3">
                <span className={label}>Material</span>
                <ErpSearchSelect
                  value={a.materialId || ''}
                  options={materialOptions}
                  disabled={readOnly}
                  placeholder="Select material…"
                  searchPlaceholder="Search material…"
                  className={compactSelect}
                  onChange={(id) => {
                    const m = matLabel(id);
                    setTrim(i, {
                      materialId: id,
                      unit: m?.unit || a.unit,
                      unitCost: m?.unitCost ?? a.unitCost ?? 0,
                    });
                  }}
                />
              </div>
              <div className="col-span-2">
                <span className={label}>Qty / piece</span>
                <input type="number" step="0.01" value={a.consumption ?? ''} onChange={(e) => setTrim(i, { consumption: Number(e.target.value) })} disabled={readOnly} className={input} />
              </div>
              <div className="col-span-2">
                <span className={label}>Unit</span>
                <InventoryCodeSelect
                  type="UNIT"
                  value={a.unit || ''}
                  onChange={(code) => setTrim(i, { unit: code })}
                  disabled={readOnly}
                  className={compactSelect}
                  placeholder="Unit"
                />
              </div>
              <div className="col-span-1">
                <span className={label}>Quoted rate</span>
                <input type="number" step="0.01" value={a.unitCost ?? ''} onChange={(e) => setTrim(i, { unitCost: Number(e.target.value) })} disabled={readOnly} className={input} />
              </div>
              {!readOnly && (
                <div className="col-span-1 pt-5">
                  <button type="button" onClick={() => removeTrim(i)} className="text-erp-text-muted hover:text-red-600" aria-label="Remove trim">×</button>
                </div>
              )}
            </div>
          ))}
          {!form.accessories.length && <p className="text-[10px] text-erp-text-muted">No trims added.</p>}
        </div>
        {!readOnly && <button type="button" onClick={addTrim} className="mt-2 text-[10px] text-[var(--erp-accent)]">+ Add trim</button>}
      </ErpCard>

      <ErpCard className="!p-3">
        <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">Fabric technicals</h3>
        <div className="grid gap-2 sm:grid-cols-4">
          <label className="block">
            <span className={label}>GSM</span>
            <input type="number" value={form.fabricSpecs.fabricGsm ?? ''} onChange={(e) => setSpecs({ fabricGsm: Number(e.target.value) })} disabled={readOnly} className={input} placeholder="180" />
          </label>
          <label className="block">
            <span className={label}>Cuttable width</span>
            <input value={form.fabricSpecs.fabricWidth || ''} onChange={(e) => setSpecs({ fabricWidth: e.target.value })} disabled={readOnly} className={input} placeholder={'58"'} />
          </label>
          <label className="block">
            <span className={label}>Finish</span>
            <InventoryCodeSelect
              type="FABRIC_FINISH"
              value={form.fabricSpecs.fabricFinish || ''}
              onChange={(code) => setSpecs({ fabricFinish: code })}
              disabled={readOnly}
              className={compactSelect}
              placeholder="Finish"
            />
          </label>
          <label className="block">
            <span className={label}>Shrinkage %</span>
            <input type="number" step="0.1" value={form.fabricSpecs.shrinkagePercent ?? ''} onChange={(e) => setSpecs({ shrinkagePercent: Number(e.target.value) })} disabled={readOnly} className={input} />
          </label>
        </div>
      </ErpCard>

      <ErpCard className="!p-3">
        <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">Measurement tolerance</h3>
        <label className="block max-w-xs">
          <span className={label}>Allowed deviation on POM</span>
          <input value={form.qualityNotes.measurementTolerance || ''} onChange={(e) => setQuality({ measurementTolerance: e.target.value })} disabled={readOnly} className={input} placeholder="± 0.5 cm" />
        </label>
      </ErpCard>

      <ErpCard className="!p-3">
        <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">Construction</h3>
        <div className="grid gap-2 sm:grid-cols-4">
          <label className="block">
            <span className={label}>Stitch</span>
            <InventoryCodeSelect
              type="STITCH"
              value={form.manufacturingNotes.specialStitch || ''}
              onChange={(code) => setMfg({ specialStitch: code })}
              disabled={readOnly}
              className={compactSelect}
            />
          </label>
          <label className="block">
            <span className={label}>Needle</span>
            <InventoryCodeSelect
              type="NEEDLE"
              value={form.manufacturingNotes.needleType || ''}
              onChange={(code) => setMfg({ needleType: code })}
              disabled={readOnly}
              className={compactSelect}
            />
          </label>
          <label className="block">
            <span className={label}>Machine</span>
            <InventoryCodeSelect
              type="MACHINE"
              value={form.manufacturingNotes.machineType || ''}
              onChange={(code) => setMfg({ machineType: code })}
              disabled={readOnly}
              className={compactSelect}
            />
          </label>
          <label className="block">
            <span className={label}>Thread colour</span>
            <InventoryCodeSelect
              type="COLOR"
              value={form.manufacturingNotes.threadColor || ''}
              onChange={(code) => setMfg({ threadColor: code })}
              disabled={readOnly}
              className={compactSelect}
            />
          </label>
        </div>
      </ErpCard>

      <ErpCard className="!p-3">
        <h3 className="mb-1 text-[11px] font-semibold text-erp-text-primary">Fabric + trim estimate</h3>
        <p className="mb-2 text-[10px] text-erp-text-muted">
          Quoted store rate × meters. Not mill rate (PO) and not CM. Costing freezes the standard after sample.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <span className={label}>Fabric (estimate)</span>
            <p className="px-2 py-1 font-mono text-[11px]">{fabricCost.toFixed(2)}</p>
          </div>
          <div>
            <span className={label}>Trims (estimate)</span>
            <p className="px-2 py-1 font-mono text-[11px]">{trimsCost.toFixed(2)}</p>
          </div>
          <div>
            <span className={label}>Material / pc</span>
            <p className="px-2 py-1 font-mono text-[11px] font-semibold">{totalCost.toFixed(2)}</p>
          </div>
        </div>
      </ErpCard>

      {!readOnly && (
        <ErpButton
          className="!px-4 !py-1.5 text-[11px]"
          disabled={saving}
          onClick={() => onSave(techPackFormToPayload(form))}
        >
          {saving ? 'Saving…' : 'Save tech pack'}
        </ErpButton>
      )}
    </div>
  );
}
