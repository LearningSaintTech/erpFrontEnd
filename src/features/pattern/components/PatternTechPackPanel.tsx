import { Link } from 'react-router-dom';
import { ErpCard } from '../../../components/erp';
import type { PatternTechPack } from '../../../types/api';

const label = 'mb-1 block text-[10px] font-medium text-erp-text-muted';

export function PatternDesignBrief({ techPack, designId }: { techPack: PatternTechPack; designId: string }) {
  const { design } = techPack;
  return (
    <ErpCard className="!p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-semibold text-erp-text-primary">Designer brief</h3>
          <p className="mt-0.5 text-[10px] text-erp-text-muted">
            {design.designCode} · {design.title}
            {design.styleNumber && <span className="ml-1 font-mono">({design.styleNumber})</span>}
          </p>
        </div>
        <Link to={`/designs/${designId}/edit`} className="text-[10px] text-[var(--erp-accent)] hover:underline">
          Open designer brief →
        </Link>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Category', design.category],
          ['Fit', design.fit],
          ['Sleeve', design.sleeveType],
          ['Neck', design.neckType],
          ['Gender', design.gender],
          ['Print / pattern', design.pattern],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className={label}>{k}</dt>
            <dd className="text-[11px] text-erp-text-primary">{v || '—'}</dd>
          </div>
        ))}
      </dl>
      {design.productSpecs?.material && (
        <p className="mt-2 rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] px-2 py-1.5 text-[10px] text-erp-text-muted">
          Intended material: {design.productSpecs.material}
          {design.productSpecs.printingType && ` · ${design.productSpecs.printingType}`}
          {design.productSpecs.embroidery && ' · embroidery'}
        </p>
      )}
    </ErpCard>
  );
}

export function PatternTechPackPanel({ techPack, designId }: { techPack: PatternTechPack; designId: string }) {
  const { design, cadAssets, evidence } = techPack;
  const tp = techPack.techPack;
  const sizeSrc = tp?.sizeChartData ?? design.sizeChartData;
  const sizes = sizeSrc?.sizeLabels ?? [];
  const rows = sizeSrc?.rows ?? [];
  const fabricLines = tp?.fabricConsumption ?? design.fabricConsumption;
  const bomLines = tp?.bomLines ?? design.bomLines;
  const trims = tp?.accessories ?? [];
  const specs = tp?.fabricSpecs;
  const quality = tp?.qualityNotes;
  const mfg = tp?.manufacturingNotes;
  const costing = tp?.costing;

  const detailGroups: { title: string; items: [string, unknown][] }[] = [
    {
      title: 'Fabric technicals',
      items: [
        ['GSM', specs?.fabricGsm],
        ['Cuttable width', specs?.fabricWidth],
        ['Finish', specs?.fabricFinish],
        ['Shrinkage %', specs?.shrinkagePercent],
      ],
    },
    {
      title: 'Spec',
      items: [
        ['Measurement tolerance', quality?.measurementTolerance],
      ],
    },
    {
      title: 'Construction',
      items: [
        ['Stitch', mfg?.specialStitch],
        ['Needle', mfg?.needleType],
        ['Machine', mfg?.machineType],
        ['Thread', mfg?.threadColor],
      ],
    },
    {
      title: 'Material estimate',
      items: [
        ['Fabric (est.)', costing?.fabricCost],
        ['Trims (est.)', costing?.accessoriesCost],
        ['Material / piece', costing?.actualCost],
      ],
    },
  ].map((g) => ({ ...g, items: g.items.filter(([, v]) => v != null && v !== '') as [string, unknown][] }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-3">
      <PatternDesignBrief techPack={techPack} designId={designId} />

      <ErpCard className="!p-3">
        <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">
          Measurement chart
          {!evidence.hasSizeChart && (
            <span className="ml-2 font-normal text-amber-600">Missing — enter in the tech pack step</span>
          )}
        </h3>
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-[10px]">
              <thead>
                <tr className="border-b border-[var(--erp-border)]">
                  <th className="px-2 py-1.5 font-medium text-erp-text-muted">Measurement</th>
                  {sizes.map((s) => (
                    <th key={s} className="px-2 py-1.5 font-medium text-erp-text-muted">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.measurementName} className="border-b border-[var(--erp-border)]/60">
                    <td className="px-2 py-1.5 font-medium">{row.measurementName}</td>
                    {sizes.map((s) => (
                      <td key={s} className="px-2 py-1.5 font-mono">{row.values?.[s] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[10px] text-erp-text-muted">No measurement rows yet.</p>
        )}
      </ErpCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <ErpCard className="!p-3">
          <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">Fabric consumption</h3>
          {(fabricLines?.length ?? 0) > 0 ? (
            <ul className="space-y-2">
              {fabricLines!.map((line, i) => {
                const mat = (line as { material?: { name?: string; materialCode?: string } }).material;
                return (
                <li key={i} className="rounded border border-[var(--erp-border)] px-2 py-1.5 text-[10px]">
                  <span className="font-medium">
                    {mat?.name || mat?.materialCode || 'Fabric'}
                  </span>
                  <span className="ml-2 text-erp-text-muted">
                    {line.consumption ?? '—'} {line.unit || 'm'}
                    {line.wastagePercent != null && ` + ${line.wastagePercent}% wastage`}
                  </span>
                </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[10px] text-amber-600">No consumption lines yet.</p>
          )}
        </ErpCard>

        <ErpCard className="!p-3">
          <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">Sample BOM</h3>
          {(bomLines?.length ?? 0) > 0 ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {bomLines!.map((line, i) => {
                const mat = (line as { material?: { name?: string }; materialName?: string }).material;
                return (
                <li key={i} className="flex justify-between gap-2 text-[10px]">
                  <span>{mat?.name || line.materialName || 'Item'}</span>
                  <span className="shrink-0 font-mono text-erp-text-muted">
                    {line.quantity ?? '—'} {line.unit || ''}
                  </span>
                </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[10px] text-amber-600">No BOM lines yet.</p>
          )}
        </ErpCard>
      </div>

      {trims.length > 0 && (
        <ErpCard className="!p-3">
          <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">Trims &amp; accessories</h3>
          <ul className="space-y-1">
            {trims.map((t, i) => (
              <li key={i} className="flex justify-between gap-2 text-[10px]">
                <span>{t.material?.name || t.accessoryType || 'Trim'}</span>
                <span className="shrink-0 font-mono text-erp-text-muted">
                  {t.consumption ?? '—'} {t.unit || ''}
                  {t.unitCost ? ` @ ${t.unitCost}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </ErpCard>
      )}

      {detailGroups.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {detailGroups.map((g) => (
            <ErpCard key={g.title} className="!p-3">
              <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">{g.title}</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                {g.items.map(([k, v]) => (
                  <div key={k}>
                    <dt className={label}>{k}</dt>
                    <dd className="text-[11px] text-erp-text-primary">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </ErpCard>
          ))}
        </div>
      )}

      {cadAssets.length > 0 && (
        <ErpCard className="!p-3">
          <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">CAD & pattern files (on design)</h3>
          <ul className="flex flex-wrap gap-2">
            {cadAssets.map((a) => (
              <li key={a._id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded border border-[var(--erp-border)] px-2 py-1 text-[10px] text-[var(--erp-accent)] hover:underline"
                >
                  {a.assetType}: {a.fileName}
                </a>
              </li>
            ))}
          </ul>
        </ErpCard>
      )}
    </div>
  );
}
