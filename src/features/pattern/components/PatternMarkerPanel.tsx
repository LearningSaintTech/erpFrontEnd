import { useMemo, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { ErpButton, ErpCard, ErpInput } from '../../../components/erp';
import { calcMetersPerGarment, validateMarkerForm } from '../patternWorkflowUtils';
import type { PatternDevelopment } from '../../../types/api';

const label = 'mb-1 block text-[10px] font-medium text-erp-text-muted';

export interface MarkerFormState {
  markerLength: string;
  fabricWidth: string;
  piecesPerMarker: string;
  efficiencyPercent: string;
  wastagePercent: string;
  markerNotes: string;
}

function parseCuttable(raw?: string | number | null) {
  if (raw == null || raw === '') return '';
  const n = Number(String(raw).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? String(n) : '';
}

export function emptyMarkerForm(pd?: PatternDevelopment, cuttableWidth?: string): MarkerFormState {
  return {
    markerLength: pd?.marker?.length != null ? String(pd.marker.length) : '',
    fabricWidth: pd?.marker?.fabricWidth != null
      ? String(pd.marker.fabricWidth)
      : parseCuttable(cuttableWidth),
    piecesPerMarker: pd?.marker?.piecesPerMarker != null ? String(pd.marker.piecesPerMarker) : '',
    efficiencyPercent: pd?.marker?.efficiencyPercent != null ? String(pd.marker.efficiencyPercent) : '',
    wastagePercent: pd?.calculatedConsumption?.wastagePercent != null
      ? String(pd.calculatedConsumption.wastagePercent)
      : '',
    markerNotes: pd?.marker?.notes || '',
  };
}

export function PatternMarkerPanel({
  pd,
  form,
  onChange,
  onSave,
  onUpload,
  saving,
  uploading,
  readOnly,
  validationError,
}: {
  pd?: PatternDevelopment;
  form: MarkerFormState;
  onChange: (patch: Partial<MarkerFormState>) => void;
  onSave: () => void;
  onUpload: (file: File) => void;
  saving?: boolean;
  uploading?: boolean;
  readOnly?: boolean;
  validationError?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const calculatedMeters = useMemo(() => {
    const len = Number(form.markerLength);
    const pieces = Number(form.piecesPerMarker);
    const wastage = Number(form.wastagePercent) || 0;
    return calcMetersPerGarment(len, pieces, wastage);
  }, [form.markerLength, form.piecesPerMarker, form.wastagePercent]);

  const designConsumption = pd?.calculatedConsumption?.metersPerGarment;

  return (
    <div className="space-y-3">
      <ErpCard className="!p-3">
        <h3 className="mb-1 text-[11px] font-semibold text-erp-text-primary">Marker layout</h3>
        <p className="mb-3 text-[10px] text-erp-text-muted">
          CAD nest: length and pieces give meters per garment. Cuttable width and efficiency are the mill facts the marker is nested to.
        </p>

        {pd?.marker?.fileName && (
          <div className="mb-3 flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5">
            <FileText size={14} className="text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{pd.marker.fileName}</p>
              {pd.marker.url && (
                <a href={pd.marker.url} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--erp-accent)] hover:underline">
                  View marker file
                </a>
              )}
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="mb-3">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.dxf,.dwg,.png,.jpg,.jpeg,.plt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 10 * 1024 * 1024) {
                  e.target.value = '';
                  return;
                }
                onUpload(f);
                e.target.value = '';
              }}
            />
            <ErpButton
              variant="secondary"
              className="!px-3 !py-1.5 text-[11px]"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={12} className="mr-1 inline" />
              {uploading ? 'Uploading…' : 'Upload marker file'}
            </ErpButton>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={label}>Marker length (m)</label>
            <ErpInput
              type="number"
              min={0}
              step="0.01"
              className="w-full !py-1.5 text-[11px]"
              value={form.markerLength}
              disabled={readOnly}
              onChange={(e) => onChange({ markerLength: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Cuttable width (in / cm)</label>
            <ErpInput
              type="number"
              min={0}
              className="w-full !py-1.5 text-[11px]"
              value={form.fabricWidth}
              disabled={readOnly}
              onChange={(e) => onChange({ fabricWidth: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Pieces per marker</label>
            <ErpInput
              type="number"
              min={1}
              className="w-full !py-1.5 text-[11px]"
              value={form.piecesPerMarker}
              disabled={readOnly}
              onChange={(e) => onChange({ piecesPerMarker: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Nesting efficiency %</label>
            <ErpInput
              type="number"
              min={0}
              max={100}
              className="w-full !py-1.5 text-[11px]"
              value={form.efficiencyPercent}
              disabled={readOnly}
              onChange={(e) => onChange({ efficiencyPercent: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Wastage allowance %</label>
            <ErpInput
              type="number"
              min={0}
              max={100}
              className="w-full !py-1.5 text-[11px]"
              value={form.wastagePercent}
              disabled={readOnly}
              onChange={(e) => onChange({ wastagePercent: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-3">
          <label className={label}>Marker notes</label>
          <textarea
            value={form.markerNotes}
            disabled={readOnly}
            onChange={(e) => onChange({ markerNotes: e.target.value })}
            placeholder="Layout notes, piece arrangement, grain direction…"
            className="erp-input w-full resize-y !py-1.5 text-[11px]"
            rows={2}
          />
        </div>
      </ErpCard>

      <ErpCard className="!border-[var(--erp-accent)]/20 !bg-[var(--erp-accent-muted)]/10 !p-3">
        <h3 className="text-[11px] font-semibold text-erp-text-primary">Fabric consumption calculator</h3>
        <p className="mt-1 text-[10px] text-erp-text-muted">
          Formula: (marker length ÷ pieces per marker) × (1 + wastage%). Saving writes these meters onto the fabric consumption line used for the BOM.
        </p>
        <p className="mt-2 text-lg font-semibold text-[var(--erp-accent)]">
          {calculatedMeters != null ? `${calculatedMeters} m / garment` : 'Enter length & pieces to calculate'}
        </p>
        {designConsumption != null && calculatedMeters != null && (
          <p className="mt-1 text-[10px] text-erp-text-muted">
            Saved on record: {designConsumption} m / garment
          </p>
        )}
      </ErpCard>

      {!readOnly && (
        <>
          {validationError && (
            <p className="text-[11px] text-red-600">{validationError}</p>
          )}
          <ErpButton
            className="!px-4 !py-1.5 text-[11px]"
            disabled={saving || !!validateMarkerForm(form)}
            onClick={onSave}
          >
            Save marker & consumption
          </ErpButton>
        </>
      )}
    </div>
  );
}
