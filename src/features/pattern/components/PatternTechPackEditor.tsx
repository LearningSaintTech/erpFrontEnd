import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Plus, Save, Trash2 } from 'lucide-react';
import {
  Button, DescriptionList, ErpDataTable, ErpInput, ErpSearchSelect, ErpSelect, Field, IconButton, InfoBanner,
  Section, Tooltip,
} from '../../../components/erp';
import { InventoryCodeSelect } from '../../../components/InventoryCodeSelect';
import { StoreMaterialRequestPanel } from './StoreMaterialRequestPanel';
import { TechPackMeasurementChart } from './TechPackMeasurementChart';
import { StickyActionBar, SaveState } from '../../design/components/StickyActionBar';
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

/** Fill missing quoted rates from the store catalogue (applied to form and baseline alike). */
function fillRates(f: TechPackFormState, materials: MaterialOption[]): TechPackFormState {
  return {
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

/**
 * Fabric lives only in fabricConsumption (consumption + wastage). bomLines carry trims only —
 * older records that mirrored fabric into bomLines are de-duplicated server-side and the
 * mirror is dropped on the next save because the form rebuilds bomLines from trims.
 */
export function techPackFormToPayload(form: TechPackFormState): TechPackPayload {
  const fabrics = form.fabrics.filter((f) => f.materialId);
  const accessories = form.accessories.filter((a) => a.materialId || a.accessoryType);
  const sampleBom: DesignBomLine[] = accessories.map((a) => ({
    materialId: a.materialId,
    materialName: a.accessoryType,
    quantity: a.consumption || 0,
    unit: a.unit || 'PC',
    category: 'TRIM',
    color: a.variantColor || '',
  }));
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

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? 'text-erp-text-secondary' : 'font-medium text-[var(--erp-warning-text)]'}`}>
      {ok ? <CheckCircle2 size={14} className="text-[var(--erp-success-solid)]" /> : <Circle size={14} />}
      {label}
    </span>
  );
}

export function PatternTechPackEditor({
  techPack,
  materials,
  readOnly,
  saving,
  onSave,
  designId,
  canContinue,
  onContinue,
}: {
  techPack: PatternTechPack;
  materials: MaterialOption[];
  readOnly: boolean;
  saving: boolean;
  /** Persist the tech pack; resolves when saved. */
  onSave: (payload: TechPackPayload) => Promise<unknown>;
  designId: string;
  /** Server says the tech pack is complete (POM chart, consumption, trims). */
  canContinue: boolean;
  onContinue: () => void;
}) {
  const [form, setForm] = useState<TechPackFormState>(() => toFormState(techPack));
  const [baseline, setBaseline] = useState<TechPackFormState>(() => toFormState(techPack));
  const [extraMaterials, setExtraMaterials] = useState<MaterialOption[]>([]);
  const colourOptions = useMemo(
    () => (techPack.design.colorVariants ?? []).map((v) => v.name).filter(Boolean),
    [techPack.design.colorVariants],
  );

  const colourSelect = (value: string | undefined, onChange: (v: string) => void, label: string) => (
    <ErpSelect inputSize="sm" value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={readOnly} aria-label={label}>
      <option value="">All colours</option>
      {value && !colourOptions.includes(value) && <option value={value}>{value}</option>}
      {colourOptions.map((c) => <option key={c} value={c}>{c}</option>)}
    </ErpSelect>
  );

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
    setForm((f) => fillRates(f, materials));
    setBaseline((b) => fillRates(b, materials));
  }, [materials]);

  const dirty = !readOnly && JSON.stringify(form) !== JSON.stringify(baseline);

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

  const hasChart = form.rows.some((r) => Object.values(r.values).some((v) => v !== ''));
  // A line counts only once it is usable: a material and a quantity above zero.
  const hasFabric = form.fabrics.some((f) => f.materialId && Number(f.consumption) > 0);
  const hasTrims = form.accessories.some((a) => a.materialId && Number(a.consumption) > 0);

  const save = async () => {
    const snapshot = form;
    try {
      await onSave(techPackFormToPayload(snapshot));
      setBaseline(snapshot);
    } catch {
      // error toast comes from the mutation
    }
  };

  const continueButton = (
    <Button
      variant={dirty ? 'secondary' : 'primary'}
      iconRight={<ArrowRight size={16} />}
      disabled={dirty || !canContinue}
      onClick={onContinue}
    >
      Continue to marker
    </Button>
  );

  return (
    <div className="space-y-4">
      {techPack.techPack?.source === 'design_legacy' && (
        <InfoBanner inset={false} tone="info">
          Pre-filled from the designer&apos;s original brief. Check and adjust the production values, then save.
        </InfoBanner>
      )}

      <TechPackMeasurementChart
        unit={form.unit}
        sizeLabels={form.sizeLabels}
        rows={form.rows}
        readOnly={readOnly}
        onUnitChange={(unit) => set({ unit })}
        onSizeLabelsChange={setSizeLabels}
        onAddRow={addMeasurementNamed}
        onRemoveRow={removeRow}
        onCellChange={setCell}
      />

      <Section
        id="techpack-fabric"
        title="Fabric consumption"
        description="Store fabric and metres per garment before wastage. Pick a colour when a fabric is used by one colourway only."
        actions={!readOnly ? <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addFabric}>Add fabric</Button> : undefined}
        flush
      >
        {/* Fixed columns: picking a long fabric name must not shift the fields the user aims at next. */}
        <ErpDataTable className="min-w-[760px] table-fixed">
          <thead>
            <tr>
              <th className="w-[36%]">Fabric</th>
              <th className="erp-num w-[12%]">Per piece</th>
              <th className="w-[15%]">Unit</th>
              <th className="w-[17%]">For colour</th>
              <th className="erp-num w-[12%]">Quoted rate</th>
              {!readOnly && <th className="erp-cell-actions"><span className="sr-only">Remove</span></th>}
            </tr>
          </thead>
          <tbody>
            {form.fabrics.map((f, i) => (
              <tr key={i}>
                <td className="!py-1.5">
                  <ErpSearchSelect
                    value={f.materialId || ''}
                    options={materialOptions}
                    disabled={readOnly}
                    placeholder="Select fabric…"
                    searchPlaceholder="Search fabric…"
                    className="w-full"
                    onChange={(id) => {
                      const m = matLabel(id);
                      setFabric(i, { materialId: id, unit: m?.unit || f.unit || 'M', fabricCost: m?.unitCost ?? f.fabricCost ?? 0 });
                    }}
                  />
                </td>
                <td className="erp-num !py-1.5">
                  <ErpInput inputSize="sm" type="number" step="0.01" className="w-24 text-right tabular-nums" aria-label="Metres per piece" value={f.consumption ?? ''} onChange={(e) => setFabric(i, { consumption: Number(e.target.value) })} disabled={readOnly} />
                </td>
                <td className="w-32 !py-1.5">
                  <InventoryCodeSelect type="UNIT" value={f.unit || ''} onChange={(code) => setFabric(i, { unit: code })} disabled={readOnly} placeholder="Unit" />
                </td>
                <td className="w-40 !py-1.5">{colourSelect(f.color, (v) => setFabric(i, { color: v }), 'Fabric colour')}</td>
                <td className="erp-num">{money(f.fabricCost || 0)}</td>
                {!readOnly && (
                  <td className="erp-cell-actions !py-1.5">
                    <IconButton size="sm" aria-label="Remove fabric line" onClick={() => removeFabric(i)}><Trash2 size={14} /></IconButton>
                  </td>
                )}
              </tr>
            ))}
            {!form.fabrics.length && (
              <tr><td colSpan={6} className="py-6 text-center text-[13px] text-erp-text-muted">Add at least one fabric line.</td></tr>
            )}
          </tbody>
        </ErpDataTable>
        {designId && (
          <StoreMaterialRequestPanel
            designId={designId}
            defaultName={techPack.design.productSpecs?.material || ''}
            category="FABRIC"
            readOnly={readOnly}
            onApproved={attachApprovedFabrics}
          />
        )}
      </Section>

      <Section
        id="techpack-trims"
        title="Trims and findings"
        description="Buttons, zippers, labels, thread. With fabric this becomes the sample BOM."
        actions={!readOnly ? <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addTrim}>Add trim</Button> : undefined}
        flush
      >
        <ErpDataTable className="min-w-[860px] table-fixed">
          <thead>
            <tr>
              <th className="w-[17%]">Type</th>
              <th className="w-[29%]">Material</th>
              <th className="erp-num w-[10%]">Qty / piece</th>
              <th className="w-[13%]">Unit</th>
              <th className="w-[15%]">For colour</th>
              <th className="erp-num w-[10%]">Quoted rate</th>
              {!readOnly && <th className="erp-cell-actions"><span className="sr-only">Remove</span></th>}
            </tr>
          </thead>
          <tbody>
            {form.accessories.map((a, i) => (
              <tr key={i}>
                <td className="w-36 !py-1.5">
                  <InventoryCodeSelect type="ACCESSORY" value={a.accessoryType || ''} onChange={(code) => setTrim(i, { accessoryType: code })} disabled={readOnly} placeholder="Type" />
                </td>
                <td className="!py-1.5">
                  <ErpSearchSelect
                    value={a.materialId || ''}
                    options={materialOptions}
                    disabled={readOnly}
                    placeholder="Select material…"
                    searchPlaceholder="Search material…"
                    className="w-full"
                    onChange={(id) => {
                      const m = matLabel(id);
                      setTrim(i, { materialId: id, unit: m?.unit || a.unit, unitCost: m?.unitCost ?? a.unitCost ?? 0 });
                    }}
                  />
                </td>
                <td className="erp-num !py-1.5">
                  <ErpInput inputSize="sm" type="number" step="0.01" className="w-20 text-right tabular-nums" aria-label="Quantity per piece" value={a.consumption ?? ''} onChange={(e) => setTrim(i, { consumption: Number(e.target.value) })} disabled={readOnly} />
                </td>
                <td className="w-32 !py-1.5">
                  <InventoryCodeSelect type="UNIT" value={a.unit || ''} onChange={(code) => setTrim(i, { unit: code })} disabled={readOnly} placeholder="Unit" />
                </td>
                <td className="w-40 !py-1.5">{colourSelect(a.variantColor, (v) => setTrim(i, { variantColor: v }), 'Trim colour')}</td>
                <td className="erp-num !py-1.5">
                  <ErpInput inputSize="sm" type="number" step="0.01" className="w-24 text-right tabular-nums" aria-label="Quoted rate" value={a.unitCost ?? ''} onChange={(e) => setTrim(i, { unitCost: Number(e.target.value) })} disabled={readOnly} />
                </td>
                {!readOnly && (
                  <td className="erp-cell-actions !py-1.5">
                    <IconButton size="sm" aria-label="Remove trim" onClick={() => removeTrim(i)}><Trash2 size={14} /></IconButton>
                  </td>
                )}
              </tr>
            ))}
            {!form.accessories.length && (
              <tr><td colSpan={7} className="py-6 text-center text-[13px] text-erp-text-muted">No trims yet — add buttons, labels and thread.</td></tr>
            )}
          </tbody>
        </ErpDataTable>
      </Section>

      <Section id="techpack-construction" title="Fabric technicals and construction">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="GSM">
            <ErpInput type="number" className="tabular-nums" value={form.fabricSpecs.fabricGsm ?? ''} onChange={(e) => setSpecs({ fabricGsm: Number(e.target.value) })} disabled={readOnly} placeholder="180" />
          </Field>
          <Field label="Cuttable width">
            <ErpInput value={form.fabricSpecs.fabricWidth || ''} onChange={(e) => setSpecs({ fabricWidth: e.target.value })} disabled={readOnly} placeholder={'58"'} />
          </Field>
          <Field label="Finish">
            <InventoryCodeSelect type="FABRIC_FINISH" value={form.fabricSpecs.fabricFinish || ''} onChange={(code) => setSpecs({ fabricFinish: code })} disabled={readOnly} placeholder="Select finish…" />
          </Field>
          <Field label="Shrinkage %">
            <ErpInput type="number" step="0.1" className="tabular-nums" value={form.fabricSpecs.shrinkagePercent ?? ''} onChange={(e) => setSpecs({ shrinkagePercent: Number(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Measurement tolerance" hint="Allowed deviation on each point">
            <ErpInput value={form.qualityNotes.measurementTolerance || ''} onChange={(e) => setQuality({ measurementTolerance: e.target.value })} disabled={readOnly} placeholder="± 0.5 cm" />
          </Field>
          <Field label="Stitch">
            <InventoryCodeSelect type="STITCH" value={form.manufacturingNotes.specialStitch || ''} onChange={(code) => setMfg({ specialStitch: code })} disabled={readOnly} />
          </Field>
          <Field label="Needle">
            <InventoryCodeSelect type="NEEDLE" value={form.manufacturingNotes.needleType || ''} onChange={(code) => setMfg({ needleType: code })} disabled={readOnly} />
          </Field>
          <Field label="Machine">
            <InventoryCodeSelect type="MACHINE" value={form.manufacturingNotes.machineType || ''} onChange={(code) => setMfg({ machineType: code })} disabled={readOnly} />
          </Field>
          <Field label="Thread colour">
            <InventoryCodeSelect type="COLOR" value={form.manufacturingNotes.threadColor || ''} onChange={(code) => setMfg({ threadColor: code })} disabled={readOnly} />
          </Field>
        </div>
      </Section>

      <Section title="Material estimate per piece" description="Quoted store rate × quantity. Not the mill rate and not CM — costing freezes the standard after the sample.">
        <DescriptionList
          columns={3}
          items={[
            { label: 'Fabric', value: <span className="tabular-nums">{money(fabricCost)}</span> },
            { label: 'Trims', value: <span className="tabular-nums">{money(trimsCost)}</span> },
            { label: 'Total material', value: <span className="font-semibold tabular-nums">{money(totalCost)}</span> },
          ]}
        />
      </Section>

      {!readOnly && (
        <StickyActionBar
          status={(
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <SaveState dirty={dirty} saving={saving} />
              <span className="flex flex-wrap items-center gap-3 text-[13px]">
                <Check ok={hasChart} label="Measurements" />
                <Check ok={hasFabric} label="Fabric" />
                <Check ok={hasTrims} label="Trims" />
              </span>
            </span>
          )}
        >
          <Button
            variant={dirty ? 'primary' : 'secondary'}
            icon={<Save size={16} />}
            loading={saving}
            disabled={!dirty}
            onClick={save}
          >
            Save tech pack
          </Button>
          {dirty || !canContinue ? (
            <Tooltip content={dirty ? 'Save your changes first' : 'Measurements, fabric and trims must be saved first'}>
              <span>{continueButton}</span>
            </Tooltip>
          ) : continueButton}
        </StickyActionBar>
      )}
    </div>
  );
}
