import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Badge, Button, ErpInput, ErpSelect, Field, IconButton, Textarea, humanizeStatus,
} from '../../components/erp';
import type { FitAnalysis } from '../../types/api';
import { FIT_AREAS, FIT_RESULTS, FIT_SEVERITIES } from '../pattern/patternWorkflowUtils';

const FIT_MODES = ['MANNEQUIN', 'LIVE_MODEL', 'FLAT_MEASURE', 'DRESS_FORM', 'CUSTOMER_REP'] as const;

const SEVERITY_TONE: Record<string, 'neutral' | 'warning' | 'danger'> = { MINOR: 'neutral', MAJOR: 'warning', CRITICAL: 'danger' };

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
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Evaluated on">
          <ErpSelect value={value.evaluatedOn || ''} onChange={(e) => onChange({ ...value, evaluatedOn: e.target.value })}>
            <option value="">Select…</option>
            {FIT_MODES.map((m) => <option key={m} value={m}>{humanizeStatus(m)}</option>)}
          </ErpSelect>
        </Field>
        <Field label="Overall result">
          <ErpSelect value={value.overallResult || ''} onChange={(e) => onChange({ ...value, overallResult: e.target.value })}>
            <option value="">Select…</option>
            {FIT_RESULTS.map((r) => <option key={r} value={r}>{humanizeStatus(r)}</option>)}
          </ErpSelect>
        </Field>
      </div>

      <div className="rounded-md border border-[var(--erp-border)] p-3">
        <p className="mb-2 text-sm font-medium text-erp-text-primary">Fit issues</p>
        <div className="grid gap-2 sm:grid-cols-[130px_120px_minmax(0,1fr)_auto]">
          <ErpSelect inputSize="sm" aria-label="Area" value={issueArea} onChange={(e) => setIssueArea(e.target.value)}>
            {FIT_AREAS.map((a) => <option key={a} value={a}>{humanizeStatus(a)}</option>)}
          </ErpSelect>
          <ErpSelect inputSize="sm" aria-label="Severity" value={issueSeverity} onChange={(e) => setIssueSeverity(e.target.value)}>
            {FIT_SEVERITIES.map((s) => <option key={s} value={s}>{humanizeStatus(s)}</option>)}
          </ErpSelect>
          <ErpInput
            inputSize="sm"
            aria-label="Issue description"
            placeholder="e.g. tight across chest, sleeve twists…"
            value={issueDesc}
            onChange={(e) => setIssueDesc(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIssue(); } }}
          />
          <Button size="sm" variant="secondary" type="button" disabled={!issueDesc.trim()} onClick={addIssue}>Add issue</Button>
        </div>
        {issues.length > 0 ? (
          <ul className="mt-3 divide-y divide-[var(--erp-border)]">
            {issues.map((iss, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <Badge tone={SEVERITY_TONE[iss.severity ?? ''] ?? 'neutral'}>{humanizeStatus(iss.severity ?? '')}</Badge>
                  <span className="font-medium">{humanizeStatus(iss.area ?? '')}</span>
                  <span className="truncate text-erp-text-secondary">{iss.description}</span>
                </span>
                <IconButton size="sm" aria-label="Remove issue" onClick={() => removeIssue(i)}><Trash2 size={14} /></IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-erp-text-muted">No issues recorded.</p>
        )}
      </div>

      {requireRevisionOption && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={!!value.patternRevisionRequired}
            onChange={(e) => onChange({ ...value, patternRevisionRequired: e.target.checked })}
          />
          <span>
            <span className="font-medium">Pattern correction needed</span>
            <span className="block text-xs text-erp-text-muted">Sends the sample back for rework and reopens the pattern for the pattern master.</span>
          </span>
        </label>
      )}

      <Field label="Fit notes">
        <Textarea
          rows={2}
          value={value.notes || ''}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="Overall fit comments for the designer and pattern room…"
        />
      </Field>
    </div>
  );
}

export const emptyFitAnalysis = (): FitAnalysis => ({
  evaluatedOn: 'MANNEQUIN',
  overallResult: 'PASS',
  issues: [],
  patternRevisionRequired: false,
  notes: '',
});
