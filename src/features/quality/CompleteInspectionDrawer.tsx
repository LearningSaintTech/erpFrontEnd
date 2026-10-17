import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, ChevronRight, RotateCcw, XCircle } from 'lucide-react';
import { qualityApi } from '../../services/operations';
import { qualityAdminApi } from '../../services/admin';
import type { QualityDefect, QualityInspection, StorageBin } from '../../types/api';
import {
  Badge, Button, Drawer, ErpDataTable, ErpInput, ErpSelect, Field, InfoBanner, humanizeStatus, useConfirm,
} from '../../components/erp';
import { dispositionLabel, inspectionRefId, typeLabel } from './qualityUtils';
import { binLabel } from '../warehouse/warehouseUtils';

export type IncomingLineForm = {
  materialId: string;
  materialCode?: string;
  name?: string;
  unit?: string;
  receivedQty: number;
  accepted: string;
  rejected: string;
};

export interface CompleteInit {
  inspection: QualityInspection;
  /** Default passed qty (everything passes; the inspector moves pieces to failed). */
  qty: number;
  /** Lot size the counts must account for (final: passed + failed must equal it). */
  base?: number;
  lines: IncomingLineForm[];
  storageBinId: string;
  autoDispatchReady: boolean;
}

type Disposition = 'PASS' | 'REWORK' | 'REJECT';

const DISPOSITION_UI: Record<Disposition, { icon: typeof CheckCircle2; hint: string }> = {
  PASS: { icon: CheckCircle2, hint: 'Accept passed pieces' },
  REWORK: { icon: RotateCcw, hint: 'Send back on the line' },
  REJECT: { icon: XCircle, hint: 'Fail the lot' },
};

/** A sample is one garment, not a lot on the line. */
const SAMPLE_HINTS: Record<Disposition, string> = {
  PASS: 'Goes on to fit / approval',
  REWORK: '',
  REJECT: 'Design manager decides revision',
};

const num = (v: string) => Number(v) || 0;

export function CompleteInspectionDrawer({
  init, onClose, onCompleted, rmBins, fgBins, dispositions, severities, canUpdate, onRememberDefaults,
}: {
  /** Persist the bin / dispatch choices as the next defaults. */
  onRememberDefaults?: (d: { rmBin?: string; fgBin?: string; autoDispatch?: boolean }) => void;
  init: CompleteInit | null;
  onClose: () => void;
  onCompleted: (insp: QualityInspection, init: CompleteInit, lines: IncomingLineForm[]) => void;
  rmBins: StorageBin[];
  fgBins: StorageBin[];
  dispositions?: string[];
  severities?: string[];
  canUpdate: boolean;
}) {
  const confirm = useConfirm();
  const insp = init?.inspection;
  const isIncoming = insp?.inspectionType === 'INCOMING';
  const isFinal = insp?.inspectionType === 'FINAL';
  const isSample = insp?.inspectionType === 'SAMPLING' || insp?.referenceType === 'SAMPLE';

  const [passed, setPassed] = useState('0');
  const [failed, setFailed] = useState('0');
  const [disposition, setDisposition] = useState<Disposition>('PASS');
  const [storageBinId, setStorageBinId] = useState('');
  const [autoDispatch, setAutoDispatch] = useState(false);
  const [lines, setLines] = useState<IncomingLineForm[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [defectsOpen, setDefectsOpen] = useState(false);
  const [defectForm, setDefectForm] = useState({ categoryId: '', description: '', quantity: '1', severity: 'MINOR' });

  useEffect(() => {
    if (!init) return;
    setPassed(String(init.qty));
    setFailed('0');
    setDisposition('PASS');
    setStorageBinId(init.storageBinId);
    setAutoDispatch(init.autoDispatchReady);
    setLines(init.lines);
    setShowErrors(false);
    setDefectsOpen(false);
  }, [init]);

  const { data: categories = [] } = useQuery({
    queryKey: ['defect-categories'],
    queryFn: qualityAdminApi.listDefectCategories,
    enabled: !!init && canUpdate,
  });
  const { data: defects = [], refetch: refetchDefects } = useQuery({
    queryKey: ['inspection-defects', insp?._id],
    queryFn: () => qualityApi.listDefects(insp!._id),
    enabled: !!insp,
  });

  const base = init?.base;
  const p = num(passed);
  const f = num(failed);

  /* ── live validation (mirrors the API rules) ── */
  const lineErrors = useMemo(() => lines.map((l) => {
    const acc = num(l.accepted);
    const rej = num(l.rejected);
    if (acc < 0 || rej < 0) return 'Quantities cannot be negative.';
    // Mirrors the API: every received piece is either accepted or rejected.
    if (Math.abs(acc + rej - l.receivedQty) > 1e-9) return `Accepted + rejected (${acc + rej}) must equal received (${l.receivedQty}).`;
    return '';
  }), [lines]);

  const qtyError = (() => {
    if (isIncoming || disposition === 'REWORK') return '';
    if (p < 0 || f < 0) return 'Quantities cannot be negative.';
    if (base != null) {
      if (isFinal && p + f !== base) return `Every piece must be accounted for: passed + failed must equal ${base}.`;
      if (p + f > base) return `Passed + failed cannot be more than ${base}.`;
    }
    return '';
  })();
  const formError = isIncoming
    ? (!lines.length ? 'GRN lines are not loaded — close and refresh the page.' : lineErrors.find(Boolean) || '')
    : qtyError;

  const totals = lines.reduce((t, l) => ({ received: t.received + l.receivedQty, accepted: t.accepted + num(l.accepted), rejected: t.rejected + num(l.rejected) }), { received: 0, accepted: 0, rejected: 0 });
  const incomingResult = totals.accepted > 0 && totals.rejected > 0 ? 'PARTIAL' : totals.accepted === 0 && totals.rejected > 0 ? 'FAIL' : 'PASS';

  const complete = useMutation({
    mutationFn: () => {
      if (isIncoming) {
        const body = lines.map((l) => ({ materialId: l.materialId, acceptedQty: num(l.accepted), rejectedQty: num(l.rejected) }));
        return qualityApi.complete(insp!._id, {
          lines: body,
          result: incomingResult,
          disposition: incomingResult === 'FAIL' ? 'REJECT' : 'PASS',
          // The drawer's choice wins — an explicit "Unallocated dock" stays on the dock.
          storageBinId: storageBinId || undefined,
        });
      }
      let result: string = disposition;
      if (disposition === 'PASS' && f > 0 && p > 0) result = 'PARTIAL';
      else if (disposition === 'PASS' && f === 0) result = 'PASS';
      else if (disposition === 'REJECT') result = 'FAIL';
      const body: Parameters<typeof qualityApi.complete>[1] = disposition === 'REWORK'
        ? { disposition, result }
        : { passedQuantity: p, failedQuantity: f, disposition, result };
      if (isFinal) {
        body.storageBinId = storageBinId || undefined;
        body.autoDispatchReady = autoDispatch;
      }
      return qualityApi.complete(insp!._id, body);
    },
    onSuccess: (done) => {
      if (isIncoming) onRememberDefaults?.({ rmBin: storageBinId });
      if (isFinal) onRememberDefaults?.({ fgBin: storageBinId, autoDispatch });
      if (init) onCompleted(done, init, lines);
    },
  });

  const recordDefect = useMutation({
    mutationFn: () => qualityApi.recordDefect(insp!._id, {
      categoryId: defectForm.categoryId || undefined,
      description: defectForm.description || undefined,
      quantity: Number(defectForm.quantity) || 1,
      severity: defectForm.severity,
    }),
    meta: { successMessage: 'Defect recorded' },
    onSuccess: () => { setDefectForm({ categoryId: '', description: '', quantity: '1', severity: 'MINOR' }); refetchDefects(); },
  });

  const submit = async () => {
    setShowErrors(true);
    if (formError) return;
    const summary = isIncoming
      ? `${totals.accepted} accepted will post to ${storageBinId ? 'the chosen bin' : 'the unallocated dock'}${totals.rejected ? `; ${totals.rejected} rejected stay open on the payment for a replacement delivery` : ''}.`
      : disposition === 'REWORK'
        ? 'The batch goes back on the line for rework. No quantities are posted.'
        : `${p} passed and ${f} failed will be posted${isFinal && p > 0 ? ' to finished goods' : ''}.`;
    const ok = await confirm({
      title: `Complete ${insp?.inspectionNumber}?`,
      message: `${summary} This cannot be undone.`,
      confirmLabel: 'Complete inspection',
      tone: disposition === 'REJECT' || incomingResult === 'FAIL' ? 'danger' : 'primary',
    });
    if (ok) complete.mutate();
  };

  const setLine = (idx: number, patch: Partial<IncomingLineForm>) => setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  // Samples: Rework and Reject both just fail sample QC (the design manager then decides on a
  // revision) — offer one "Fail" choice instead of two that do the same thing.
  const dispositionOptions = ((dispositions?.length ? dispositions : ['PASS', 'REWORK', 'REJECT']) as Disposition[])
    .filter((d) => d in DISPOSITION_UI && !(isSample && d === 'REWORK'));
  const accounted = p + f;

  return (
    <Drawer
      open={!!init}
      onClose={onClose}
      size={isIncoming ? 'lg' : 'md'}
      closeOnOverlayClick={false}
      title={`Complete ${insp?.inspectionNumber ?? 'inspection'}`}
      description={insp ? `${typeLabel(insp.inspectionType)} inspection${base != null ? ` · lot of ${base}` : ''}` : undefined}
      headerExtra={isSample && insp ? (
        <Link to={`/samples?sampleId=${inspectionRefId(insp)}`} className="mt-1 inline-block text-[13px] font-medium text-[var(--erp-accent)] hover:underline">Open sample</Link>
      ) : undefined}
      footer={(
        <>
          {showErrors && formError && <p className="mr-auto text-[13px] text-[var(--erp-danger-text)]" role="alert">{formError}</p>}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {canUpdate && (
            <Button loading={complete.isPending} onClick={submit} className="!min-h-11" icon={<CheckCircle2 size={16} />}>Complete inspection</Button>
          )}
        </>
      )}
    >
      <div className="space-y-5">
        {isSample && (
          <InfoBanner inset={false} tone="info">One garment. Pass moves the sample to fit trial or buyer approval; reject marks sample QC as failed.</InfoBanner>
        )}

        {isIncoming ? (
          <div>
            <h4 className="mb-2 text-sm font-semibold">Received lines</h4>
            <div className="overflow-x-auto rounded-lg border border-[var(--erp-border)]">
              <ErpDataTable>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Unit</th>
                    <th className="erp-num">Received</th>
                    <th className="erp-num w-32">Accepted</th>
                    <th className="erp-num w-32">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => {
                    const err = showErrors ? lineErrors[idx] : lineErrors[idx] && num(l.accepted) + num(l.rejected) > l.receivedQty ? lineErrors[idx] : '';
                    return (
                      <tr key={`${l.materialId}-${idx}`}>
                        <td>
                          <span className="font-mono">{l.materialCode || l.materialId.slice(-6)}</span>
                          {l.name && <span className="ml-1 text-erp-text-muted">{l.name}</span>}
                          {err && <p className="mt-1 text-xs text-[var(--erp-danger-text)]">{err}</p>}
                        </td>
                        <td className="text-erp-text-muted">{l.unit || '—'}</td>
                        <td className="erp-num">{l.receivedQty}</td>
                        <td className="erp-num">
                          <ErpInput
                            type="number" inputMode="decimal" min={0} max={l.receivedQty} className="text-right" invalid={!!err}
                            aria-label={`Accepted ${l.materialCode ?? ''}`}
                            value={l.accepted}
                            onChange={(e) => setLine(idx, { accepted: e.target.value, rejected: String(Math.max(0, l.receivedQty - num(e.target.value))) })}
                          />
                        </td>
                        <td className="erp-num">
                          <ErpInput
                            type="number" inputMode="decimal" min={0} max={l.receivedQty} className="text-right" invalid={!!err}
                            aria-label={`Rejected ${l.materialCode ?? ''}`}
                            value={l.rejected}
                            onChange={(e) => setLine(idx, { rejected: e.target.value, accepted: String(Math.max(0, l.receivedQty - num(e.target.value))) })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr><td colSpan={5} className="text-erp-text-muted">GRN lines not loaded — close and refresh the page.</td></tr>
                  )}
                </tbody>
                {lines.length > 1 && (
                  <tfoot>
                    <tr className="font-medium">
                      <td colSpan={2}>Total</td>
                      <td className="erp-num">{totals.received}</td>
                      <td className="erp-num">{totals.accepted}</td>
                      <td className="erp-num">{totals.rejected}</td>
                    </tr>
                  </tfoot>
                )}
              </ErpDataTable>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-erp-text-muted">
              <span>Result:</span>
              <Badge tone={incomingResult === 'PASS' ? 'success' : incomingResult === 'FAIL' ? 'danger' : 'warning'}>
                {incomingResult === 'PASS' ? 'Pass' : incomingResult === 'FAIL' ? 'Fail' : 'Partial'}
              </Badge>
              <span>Accepted qty posts to stock; rejected qty stays open on the payment for a replacement delivery.</span>
            </div>
          </div>
        ) : (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Decision</legend>
              <div className={`grid gap-2 ${dispositionOptions.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`} role="radiogroup">
                {dispositionOptions.map((d) => {
                  const ui = DISPOSITION_UI[d];
                  const Icon = ui.icon;
                  const on = disposition === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setDisposition(d);
                        // One garment: the counts follow the decision instead of contradicting it.
                        if (isSample) {
                          const total = Math.max(1, (Number(passed) || 0) + (Number(failed) || 0));
                          setPassed(String(d === 'PASS' ? total : 0));
                          setFailed(String(d === 'PASS' ? 0 : total));
                        }
                      }}
                      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors ${on
                        ? d === 'REJECT' ? 'border-[var(--erp-danger-border)] bg-[var(--erp-danger-bg)] text-[var(--erp-danger-text)]' : 'border-[var(--erp-accent)] bg-[var(--erp-accent-subtle)] text-erp-text-primary'
                        : 'border-[var(--erp-border)] hover:bg-[var(--erp-surface-muted)]'}`}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span className="text-sm font-medium">{isSample && d === 'REJECT' ? 'Fail' : dispositionLabel(d)}</span>
                      <span className="text-xs text-erp-text-muted">{isSample ? SAMPLE_HINTS[d] : ui.hint}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {disposition === 'REWORK' ? (
              <InfoBanner inset={false} tone="warn">Rework sends the batch back on the line. No quantities are posted.</InfoBanner>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Passed" required>
                    <ErpInput
                      type="number" inputMode="numeric" min={0} invalid={showErrors && !!qtyError}
                      value={passed}
                      onChange={(e) => {
                        setPassed(e.target.value);
                        if (base != null) setFailed(String(Math.max(0, base - num(e.target.value))));
                      }}
                    />
                  </Field>
                  <Field label="Failed" required>
                    <ErpInput type="number" inputMode="numeric" min={0} invalid={showErrors && !!qtyError} value={failed} onChange={(e) => setFailed(e.target.value)} />
                  </Field>
                </div>
                {base != null && (
                  <div
                    className={`mt-2 flex items-center justify-between rounded-md px-3 py-2 text-[13px] ${qtyError ? 'bg-[var(--erp-warning-bg)] text-[var(--erp-warning-text)]' : 'bg-[var(--erp-success-bg)] text-[var(--erp-success-text)]'}`}
                    aria-live="polite"
                  >
                    <span>{isFinal ? 'Passed + failed must equal the batch quantity' : 'Good pieces in this batch'}</span>
                    <span className="erp-tabular font-semibold">{accounted} / {base}{isFinal && accounted !== base ? ` (${accounted < base ? `${base - accounted} missing` : `${accounted - base} too many`})` : ''}</span>
                  </div>
                )}
                {!isFinal && base != null && <p className="mt-1 text-xs text-erp-text-muted">Failed pieces are removed from the batch.</p>}
                {showErrors && qtyError && <p className="mt-1 text-[13px] text-[var(--erp-danger-text)]">{qtyError}</p>}
              </div>
            )}
          </>
        )}

        {isIncoming && (
          <Field label="Put accepted stock in" hint="Leave on the unallocated dock to put away later in Warehouse.">
            <ErpSelect value={storageBinId} onChange={(e) => setStorageBinId(e.target.value)}>
              <option value="">Unallocated dock (default)</option>
              {rmBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
            </ErpSelect>
          </Field>
        )}
        {isFinal && disposition !== 'REWORK' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Finished-goods bin">
              <ErpSelect value={storageBinId} onChange={(e) => setStorageBinId(e.target.value)}>
                <option value="">Default warehouse</option>
                {fgBins.map((b) => <option key={b._id} value={b._id}>{binLabel(b)}</option>)}
              </ErpSelect>
            </Field>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-md border border-[var(--erp-border)] px-3 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={autoDispatch} onChange={(e) => setAutoDispatch(e.target.checked)} />
              Mark ready to ship on pass
            </label>
          </div>
        )}

        {canUpdate && (
          <div className="rounded-lg border border-[var(--erp-border)]">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold"
              aria-expanded={defectsOpen}
              onClick={() => setDefectsOpen((v) => !v)}
            >
              {defectsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Defects
              <Badge tone={defects.length ? 'warning' : 'neutral'} dot={false}>{defects.length}</Badge>
              <span className="ml-auto text-xs font-normal text-erp-text-muted">Optional</span>
            </button>
            {defectsOpen && (
              <div className="space-y-3 border-t border-[var(--erp-border)] p-3">
                {defects.length > 0 && (
                  <ul className="space-y-1 text-[13px]">
                    {defects.map((d: QualityDefect) => (
                      <li key={d._id} className="flex justify-between gap-2">
                        <span>{d.description || 'Defect'} × {d.quantity}</span>
                        <Badge tone={d.severity === 'CRITICAL' ? 'danger' : d.severity === 'MAJOR' ? 'warning' : 'neutral'}>{humanizeStatus(d.severity ?? 'MINOR')}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Category">
                    <ErpSelect inputSize="sm" value={defectForm.categoryId} onChange={(e) => {
                      const cat = categories.find((c) => c._id === e.target.value);
                      setDefectForm((x) => ({ ...x, categoryId: e.target.value, severity: cat?.severity || x.severity }));
                    }}
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((c) => <option key={c._id} value={c._id}>{c.code} — {c.name}</option>)}
                    </ErpSelect>
                  </Field>
                  <Field label="Severity">
                    <ErpSelect inputSize="sm" value={defectForm.severity} onChange={(e) => setDefectForm((x) => ({ ...x, severity: e.target.value }))}>
                      {(severities ?? ['MINOR', 'MAJOR', 'CRITICAL']).map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                    </ErpSelect>
                  </Field>
                  <Field label="Description" className="sm:col-span-2">
                    <ErpInput inputSize="sm" value={defectForm.description} onChange={(e) => setDefectForm((x) => ({ ...x, description: e.target.value }))} placeholder="e.g. Open seam on left sleeve" />
                  </Field>
                  <Field label="Pieces">
                    <ErpInput inputSize="sm" type="number" min={1} value={defectForm.quantity} onChange={(e) => setDefectForm((x) => ({ ...x, quantity: e.target.value }))} />
                  </Field>
                  <div className="flex items-end">
                    <Button size="sm" variant="secondary" loading={recordDefect.isPending} onClick={() => recordDefect.mutate()}>Add defect</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
