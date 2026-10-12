import { useNavigate } from 'react-router-dom';
import { ExternalLink, Paperclip } from 'lucide-react';
import {
  Button, DescriptionList, EmptyState, ErpDataTable, Section,
} from '../../../components/erp';
import type { PatternTechPack } from '../../../types/api';
import { useInventoryCodes } from '../../../hooks/useInventoryCodes';

/** "SLIM" → "Slim", "HALF_SLEEVE" → "Half sleeve"; mixed-case text is left alone. */
function readable(v?: string) {
  if (!v) return '';
  if (v !== v.toUpperCase() || /\d/.test(v)) return v;
  const t = v.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Designer brief the pattern master works from (read-only). */
export function PatternDesignBrief({ techPack, designId }: { techPack: PatternTechPack; designId: string }) {
  const navigate = useNavigate();
  const { design } = techPack;
  // Category is stored as a catalogue code ("TW-SH") — show its name ("Shirt").
  const { data: categories = [] } = useInventoryCodes('CATEGORY', !!design.category);
  const categoryName = categories.find((c) => c.code === design.category)?.name;
  const spec = design.productSpecs;
  const intended = [spec?.material, spec?.printingType, spec?.embroidery ? 'embroidery' : ''].filter(Boolean).join(' · ');
  return (
    <Section
      title="Designer brief"
      description={`${design.designCode} · ${design.title}${design.styleNumber ? ` (${design.styleNumber})` : ''}`}
      actions={(
        <Button size="sm" variant="ghost" iconRight={<ExternalLink size={14} />} onClick={() => navigate(`/designs/${designId}/edit`)}>
          Open design
        </Button>
      )}
    >
      <DescriptionList
        columns={3}
        items={[
          { label: 'Category', value: categoryName || readable(design.category) || '—' },
          { label: 'Fit', value: readable(design.fit) || '—' },
          { label: 'Sleeve / neck', value: [design.sleeveType, design.neckType].filter(Boolean).map((v) => readable(v)).join(' · ') || '—' },
          { label: 'Gender', value: readable(design.gender) || '—' },
          { label: 'Print / pattern', value: readable(design.pattern) || '—' },
          { label: 'Intended fabric', value: intended || '—' },
        ]}
      />
    </Section>
  );
}

export function PatternTechPackPanel({ techPack, designId }: { techPack: PatternTechPack; designId: string }) {
  const { design, cadAssets, evidence } = techPack;
  const tp = techPack.techPack;
  const sizeSrc = tp?.sizeChartData ?? design.sizeChartData;
  const sizes = sizeSrc?.sizeLabels ?? [];
  const rows = sizeSrc?.rows ?? [];
  const fabricLines = tp?.fabricConsumption ?? design.fabricConsumption ?? [];
  const bomLines = tp?.bomLines ?? design.bomLines ?? [];
  const specs = tp?.fabricSpecs;
  const quality = tp?.qualityNotes;
  const mfg = tp?.manufacturingNotes;
  const costing = tp?.costing;

  const details = [
    { label: 'GSM', value: specs?.fabricGsm },
    { label: 'Cuttable width', value: specs?.fabricWidth },
    { label: 'Finish', value: specs?.fabricFinish },
    { label: 'Shrinkage %', value: specs?.shrinkagePercent },
    { label: 'Measurement tolerance', value: quality?.measurementTolerance },
    { label: 'Stitch', value: mfg?.specialStitch },
    { label: 'Needle', value: mfg?.needleType },
    { label: 'Machine', value: mfg?.machineType },
    { label: 'Thread colour', value: mfg?.threadColor },
    { label: 'Fabric estimate', value: costing?.fabricCost },
    { label: 'Trims estimate', value: costing?.accessoriesCost },
    { label: 'Material / piece', value: costing?.actualCost },
  ].filter((d) => d.value != null && d.value !== '').map((d) => ({ label: d.label, value: String(d.value) }));

  return (
    <div className="space-y-4">
      <PatternDesignBrief techPack={techPack} designId={designId} />

      <Section title="Graded measurement chart" description={!evidence.hasSizeChart ? 'Not filled in yet.' : `${sizeSrc?.unit || 'CM'} · ${rows.length} points`} flush={rows.length > 0}>
        {rows.length > 0 ? (
          <ErpDataTable>
            <thead>
              <tr>
                <th>Measurement</th>
                {sizes.map((s) => <th key={s} className="erp-num">{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.measurementName}>
                  <td className="erp-cell-primary">{row.measurementName}</td>
                  {sizes.map((s) => <td key={s} className="erp-num">{row.values?.[s] ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        ) : (
          <EmptyState compact title="No measurement rows yet" />
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Fabric consumption" flush={fabricLines.length > 0}>
          {fabricLines.length > 0 ? (
            <ErpDataTable>
              <thead><tr><th>Fabric</th><th className="erp-num">Per piece</th><th className="erp-num">Wastage</th></tr></thead>
              <tbody>
                {fabricLines.map((line, i) => {
                  const mat = (line as { material?: { name?: string; materialCode?: string } }).material;
                  return (
                    <tr key={i}>
                      <td>{mat?.name || mat?.materialCode || 'Fabric'}</td>
                      <td className="erp-num">{line.consumption ?? '—'} {line.unit || 'm'}</td>
                      <td className="erp-num">{line.wastagePercent != null ? `${line.wastagePercent}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </ErpDataTable>
          ) : <EmptyState compact title="No fabric lines yet" />}
        </Section>

        <Section title="Sample BOM (trims)" flush={bomLines.length > 0}>
          {bomLines.length > 0 ? (
            <ErpDataTable>
              <thead><tr><th>Item</th><th className="erp-num">Qty / piece</th></tr></thead>
              <tbody>
                {bomLines.map((line, i) => {
                  const mat = (line as { material?: { name?: string } }).material;
                  return (
                    <tr key={i}>
                      <td>{mat?.name || line.materialName || 'Item'}</td>
                      <td className="erp-num">{line.quantity ?? '—'} {line.unit || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </ErpDataTable>
          ) : <EmptyState compact title="No trims yet" />}
        </Section>
      </div>

      {details.length > 0 && (
        <Section title="Fabric, construction and estimate">
          <DescriptionList columns={3} items={details} />
        </Section>
      )}

      {cadAssets.length > 0 && (
        <Section title="CAD and pattern files">
          <ul className="flex flex-wrap gap-2">
            {cadAssets.map((a) => (
              <li key={a._id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--erp-border)] px-2.5 py-1 text-[13px] text-[var(--erp-accent)] hover:underline"
                >
                  <Paperclip size={13} />
                  {a.fileName}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
