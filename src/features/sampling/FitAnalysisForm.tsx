import { useState } from 'react';
import { ErpButton, ErpCard, ErpSelect } from '../../components/erp';
import type { FitAnalysis } from '../../types/api';
import { FIT_AREAS, FIT_RESULTS, FIT_SEVERITIES } from '../pattern/patternWorkflowUtils';

const FIT_MODES = ['MANNEQUIN', 'LIVE_MODEL', 'FLAT_MEASURE', 'DRESS_FORM', 'CUSTOMER_REP'] as const;

const label = 'mb-1 block text-[10px] font-medium text-erp-text-muted';

export function FitAnalysisForm({
  value,
  onChange,
  requireRevisionOption,
}: {
  value: FitAnalysis;
  onChange: (v: FitAnalysis) => void;
  requireRevisionOption?: boolean;
}) {
  const [issueArea, setIssueArea] = useState('CHEST');
  const [issueSeverity, setIssueSeverity] = useState('MINOR');
  const [issueDesc, setIssueDesc] = useState('');

  const issues = value.issues ?? [];

  const addIssue = () => {
    if (!issueDesc.trim()) return;
    onChange({
      ...value,
      issues: [...issues, { area: issueArea, severity: issueSeverity, description: issueDesc.trim() }],
    });
    setIssueDesc('');
  };

  const removeIssue = (idx: number) => {
    onChange({ ...value, issues: issues.filter((_, i) => i !== idx) });
  };

  return (
    <ErpCard className="!p-3">
      <h3 className="mb-2 text-[11px] font-semibold text-erp-text-primary">Fit analysis</h3>
      <p className="mb-3 text-[10px] text-erp-text-muted">
        Record fit trial results on mannequin, live model, or flat measurement.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className={label}>Evaluated on</label>
          <ErpSelect
            className="w-full !py-1.5 text-[11px]"
            value={value.evaluatedOn || ''}
            onChange={(e) => onChange({ ...value, evaluatedOn: e.target.value })}
          >
            <option value="">Select…</option>
            {FIT_MODES.map((m) => (
              <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
            ))}
          </ErpSelect>
        </div>
        <div>
          <label className={label}>Overall result</label>
          <ErpSelect
            className="w-full !py-1.5 text-[11px]"
            value={value.overallResult || ''}
            onChange={(e) => onChange({ ...value, overallResult: e.target.value })}
          >
            <option value="">Select…</option>
            {FIT_RESULTS.map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </ErpSelect>
        </div>
      </div>

      <div className="mt-3 rounded border border-[var(--erp-border)] p-2">
        <p className="mb-2 text-[10px] font-medium text-erp-text-primary">Fit issues</p>
        <div className="flex flex-wrap gap-2">
          <ErpSelect className="!py-1 text-[10px]" value={issueArea} onChange={(e) => setIssueArea(e.target.value)}>
            {FIT_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </ErpSelect>
          <ErpSelect className="!py-1 text-[10px]" value={issueSeverity} onChange={(e) => setIssueSeverity(e.target.value)}>
            {FIT_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </ErpSelect>
          <input
            className="erp-input min-w-[140px] flex-1 !py-1 text-[10px]"
            placeholder="e.g. tight chest, sleeve twist…"
            value={issueDesc}
            onChange={(e) => setIssueDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIssue())}
          />
          <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" type="button" onClick={addIssue}>Add</ErpButton>
        </div>
        {issues.length > 0 && (
          <ul className="mt-2 space-y-1">
            {issues.map((iss, i) => (
              <li key={i} className="flex items-start justify-between gap-2 rounded bg-[var(--erp-surface)] px-2 py-1 text-[10px]">
                <span>
                  <strong>{iss.area}</strong> ({iss.severity}): {iss.description}
                </span>
                <button type="button" className="text-red-600 hover:underline" onClick={() => removeIssue(i)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {requireRevisionOption && (
        <label className="mt-3 flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={!!value.patternRevisionRequired}
            onChange={(e) => onChange({ ...value, patternRevisionRequired: e.target.checked })}
          />
          Pattern revision required — reopens pattern development for the pattern master
        </label>
      )}

      <div className="mt-3">
        <label className={label}>Fit notes</label>
        <textarea
          className="erp-input w-full resize-y !py-1.5 text-[11px]"
          rows={2}
          value={value.notes || ''}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="Overall fit comments for designer and pattern room…"
        />
      </div>
    </ErpCard>
  );
}

export const emptyFitAnalysis = (): FitAnalysis => ({
  evaluatedOn: 'MANNEQUIN',
  overallResult: 'PASS',
  issues: [],
  patternRevisionRequired: false,
  notes: '',
});
