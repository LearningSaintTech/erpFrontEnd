import { useMemo, useRef } from 'react';
import { Calculator, FileText, Upload } from 'lucide-react';
import {
  Button, ErpInput, Field, Section, Textarea,
} from '../../../components/erp';
import { calcMetersPerGarment } from '../patternWorkflowUtils';
import type { PatternDevelopment } from '../../../types/api';

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

/** Per-field messages for the marker form (shown after a save attempt). */
export function markerFieldErrors(form: MarkerFormState) {
  const errors: Partial<Record<keyof MarkerFormState, string>> = {};
  const length = Number(form.markerLength);
  const pieces = Number(form.piecesPerMarker);
  if (!form.markerLength || Number.isNaN(length) || length <= 0) errors.markerLength = 'Enter the marker length in metres (more than 0).';
  if (!form.piecesPerMarker || Number.isNaN(pieces) || pieces < 1) errors.piecesPerMarker = 'Enter how many garments the marker cuts (at least 1).';
  return errors;
}

export function PatternMarkerPanel({
  pd,
  form,
  onChange,
  onUpload,
  uploading,
  readOnly,
  showErrors,
}: {
  pd?: PatternDevelopment;
  form: MarkerFormState;
  onChange: (patch: Partial<MarkerFormState>) => void;
  onUpload: (file: File) => void;
  uploading?: boolean;
  readOnly?: boolean;
  showErrors?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const errors = showErrors ? markerFieldErrors(form) : {};

  const calculatedMeters = useMemo(() => {
    const len = Number(form.markerLength);
    const pieces = Number(form.piecesPerMarker);
    const wastage = Number(form.wastagePercent) || 0;
    return calcMetersPerGarment(len, pieces, wastage);
  }, [form.markerLength, form.piecesPerMarker, form.wastagePercent]);

  const savedConsumption = pd?.calculatedConsumption?.metersPerGarment;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Section
          title="Marker layout"
          description="Length and pieces from the CAD nest give metres per garment."
          actions={!readOnly ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.dxf,.dwg,.png,.jpg,.jpeg,.plt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) onUpload(f);
                }}
              />
              <Button size="sm" variant="secondary" icon={<Upload size={14} />} loading={uploading} onClick={() => fileRef.current?.click()}>
                {pd?.marker?.fileName ? 'Replace marker file' : 'Upload marker file'}
              </Button>
            </>
          ) : undefined}
        >
          {pd?.marker?.fileName && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] px-3 py-2">
              <FileText size={16} className="shrink-0 text-erp-text-muted" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{pd.marker.fileName}</span>
              {pd.marker.url && (
                <a href={pd.marker.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-[var(--erp-accent)] hover:underline">
                  View
                </a>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Marker length (m)" required error={errors.markerLength}>
              <ErpInput type="number" min={0} step="0.01" className="tabular-nums" value={form.markerLength} disabled={readOnly} invalid={!!errors.markerLength} onChange={(e) => onChange({ markerLength: e.target.value })} />
            </Field>
            <Field label="Pieces per marker" required error={errors.piecesPerMarker}>
              <ErpInput type="number" min={1} className="tabular-nums" value={form.piecesPerMarker} disabled={readOnly} invalid={!!errors.piecesPerMarker} onChange={(e) => onChange({ piecesPerMarker: e.target.value })} />
            </Field>
            <Field label="Wastage allowance %" hint="Cutting loss added once">
              <ErpInput type="number" min={0} max={100} className="tabular-nums" value={form.wastagePercent} disabled={readOnly} onChange={(e) => onChange({ wastagePercent: e.target.value })} />
            </Field>
            <Field label="Cuttable width" hint="in or cm">
              <ErpInput type="number" min={0} className="tabular-nums" value={form.fabricWidth} disabled={readOnly} onChange={(e) => onChange({ fabricWidth: e.target.value })} />
            </Field>
            <Field label="Nesting efficiency %">
              <ErpInput type="number" min={0} max={100} className="tabular-nums" value={form.efficiencyPercent} disabled={readOnly} onChange={(e) => onChange({ efficiencyPercent: e.target.value })} />
            </Field>
          </div>

          <Field label="Marker notes" className="mt-4">
            <Textarea
              value={form.markerNotes}
              disabled={readOnly}
              onChange={(e) => onChange({ markerNotes: e.target.value })}
              placeholder="Layout notes, piece arrangement, grain direction…"
              rows={2}
            />
          </Field>
        </Section>
      </div>

      <Section title="Fabric per garment">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--erp-accent-muted)] text-[var(--erp-accent)]">
            <Calculator size={18} />
          </span>
          <div>
            <p className="text-2xl font-semibold tabular-nums text-erp-text-primary">
              {calculatedMeters != null ? `${calculatedMeters} m` : '—'}
            </p>
            <p className="text-xs text-erp-text-muted">
              {calculatedMeters != null ? 'including wastage' : 'Enter length and pieces'}
            </p>
          </div>
        </div>
        {savedConsumption != null && (
          <p className="mt-3 text-[13px] text-erp-text-secondary">Saved on record: <span className="tabular-nums">{savedConsumption} m</span></p>
        )}
        <p className="mt-3 text-xs leading-5 text-erp-text-muted">
          (Length ÷ pieces) × (1 + wastage %). Saving writes metres and wastage onto the main fabric line and clears the consumption and BOM sign-offs.
        </p>
      </Section>
    </div>
  );
}
