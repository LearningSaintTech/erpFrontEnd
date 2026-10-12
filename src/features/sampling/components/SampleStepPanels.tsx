import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import {
  Badge, Button, DescriptionList, ErpDataTable, InfoBanner, Section, StatusBadge, humanizeStatus,
} from '../../../components/erp';
import type { Sample } from '../../../types/api';
import {
  formatCost, sampleTypeLabel, SEWING_SEQUENCE_HINT,
} from '../sampleUtils';
import { SAMPLE_TYPE_GUIDE, sampleNeedsFitTrial } from '../sampleWorkflowUtils';
import { SampleMaterialSummary } from './SampleMaterialSummary';
import { formatDateTime } from '../../../utils/format';

export function BriefPanel({ sample, designId }: { sample: Sample; designId: string }) {
  const navigate = useNavigate();
  const labour = (sample.laborHours ?? 0) * (sample.laborRate ?? 0);
  return (
    <div className="space-y-4">
      {sample.status === 'REJECTED' && sample.rejectionComments && (
        <InfoBanner inset={false} tone="danger" title="Rejected or cancelled">
          <p className="whitespace-pre-wrap">{sample.rejectionComments}</p>
        </InfoBanner>
      )}
      {sample.revisionComments && sample.status !== 'APPROVED' && (
        <InfoBanner inset={false} tone="warn" title="Revision requested">
          <p className="whitespace-pre-wrap">{sample.revisionComments}</p>
        </InfoBanner>
      )}
      <Section
        title="Sample brief"
        description={SAMPLE_TYPE_GUIDE[sample.sampleType || 'PROTOTYPE']}
        actions={(
          <Button size="sm" variant="ghost" iconRight={<ExternalLink size={14} />} onClick={() => navigate(`/designs/${designId}/edit`)}>
            Open tech pack
          </Button>
        )}
      >
        <DescriptionList
          columns={3}
          items={[
            { label: 'Sample type', value: sampleTypeLabel(sample.sampleType) },
            { label: 'Round', value: sample.iteration && sample.iteration > 1 ? `Revision ${sample.iteration}` : 'First' },
            { label: 'Labour', value: `${sample.laborHours ?? 0} h × ${formatCost(sample.laborRate)} = ${formatCost(labour)}` },
            { label: 'Sample cost', value: formatCost(sample.totalCost) },
            { label: 'Comments', value: sample.comments || '—', full: true },
          ]}
        />
      </Section>
    </div>
  );
}

export function FloorPanel({
  sample,
  kind,
}: {
  sample: Sample;
  kind: 'cutting' | 'stitching';
}) {
  return (
    <div className="space-y-4">
      <Section
        title={kind === 'cutting' ? 'Cutting' : 'Stitching'}
        description={kind === 'cutting'
          ? 'Lay the marker and cut front, back, sleeves, collar and cuffs, then bundle the pieces for the sample tailor.'
          : `Typical sequence: ${SEWING_SEQUENCE_HINT.join(', ').toLowerCase()}.`}
        flush
      >
        <SampleMaterialSummary lines={sample.materialRequirements} showStock={false} />
      </Section>
    </div>
  );
}

export function QcPanel({ sample }: { sample: Sample }) {
  const navigate = useNavigate();
  const needsFit = sampleNeedsFitTrial(sample.sampleType);
  const insp = sample.qcInspectionId && typeof sample.qcInspectionId !== 'string' ? sample.qcInspectionId : null;
  return (
    <Section
      title="Quality inspection"
      description={`Measurements, stitch quality, symmetry, labels and fabric defects. Passing sends the sample ${needsFit ? 'to the fit trial' : 'to buyer review'}.`}
      actions={(
        <Button size="sm" variant="ghost" iconRight={<ExternalLink size={14} />} onClick={() => navigate('/quality/inspections')}>
          Quality inspections
        </Button>
      )}
      flush={!!sample.qcMeasurements?.length}
    >
      {insp && (
        <p className="px-4 pt-3 text-[13px] text-erp-text-secondary">
          Inspection <span className="font-mono">{insp.inspectionNumber}</span>
          {insp.status && <> · {humanizeStatus(insp.status)}</>}
        </p>
      )}
      {sample.qcMeasurements && sample.qcMeasurements.length > 0 ? (
        <ErpDataTable className="min-w-[420px]">
          <thead>
            <tr><th>Point</th><th className="erp-num">Required</th><th className="erp-num">Actual</th><th>Result</th></tr>
          </thead>
          <tbody>
            {sample.qcMeasurements.map((m, i) => (
              <tr key={i}>
                <td className="erp-cell-primary">{m.point}</td>
                <td className="erp-num">{m.required || '—'}</td>
                <td className="erp-num">{m.actual || '—'}</td>
                <td>{m.pass === false ? <Badge tone="danger">Fail</Badge> : <Badge tone="success">Pass</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </ErpDataTable>
      ) : (
        !insp && <p className="text-[13px] text-erp-text-muted">No measurements recorded yet.</p>
      )}
    </Section>
  );
}

export function FitPanel({ sample, designId }: { sample: Sample; designId: string }) {
  const navigate = useNavigate();
  const needsFit = sampleNeedsFitTrial(sample.sampleType);
  const fit = sample.fitAnalysis;
  return (
    <Section
      title="Fit trial"
      description={needsFit
        ? 'Check comfort, appearance and ease of movement on a model or dress form.'
        : `${sampleTypeLabel(sample.sampleType)} samples skip the fit trial and go to buyer approval after QC.`}
    >
      {fit?.overallResult ? (
        <div className="space-y-3">
          <DescriptionList
            columns={3}
            items={[
              { label: 'Result', value: <StatusBadge status={fit.overallResult} label={humanizeStatus(fit.overallResult)} tone={fit.overallResult === 'PASS' ? 'success' : fit.overallResult === 'FAIL' ? 'danger' : 'warning'} /> },
              { label: 'Evaluated on', value: fit.evaluatedOn ? humanizeStatus(fit.evaluatedOn) : '—' },
              { label: 'Issues', value: String(fit.issues?.length ?? 0) },
              { label: 'Notes', value: fit.notes || '—', full: true },
            ]}
          />
          {fit.patternRevisionRequired && (
            <InfoBanner
              inset={false}
              tone="warn"
              action={<Button size="sm" variant="secondary" onClick={() => navigate(`/pattern?designId=${designId}`)}>Open pattern</Button>}
            >
              Pattern correction requested — the pattern was reopened for the pattern master.
            </InfoBanner>
          )}
        </div>
      ) : (
        needsFit && <p className="text-[13px] text-erp-text-muted">No fit session recorded yet.</p>
      )}
    </Section>
  );
}

export function ApprovalPanel({ sample }: { sample: Sample }) {
  const navigate = useNavigate();
  return (
    <Section title="Buyer approval" description="The buyer or design manager approves the sample, asks for a revision, or rejects it.">
      {sample.status === 'APPROVED' ? (
        <InfoBanner
          inset={false}
          tone="success"
          action={<Button size="sm" onClick={() => navigate(`/products/skus?generate=${sample._id}`)}>Generate SKUs</Button>}
        >
          Sample approved for bulk production. Generate SKUs from it next.
        </InfoBanner>
      ) : sample.status === 'REJECTED' ? (
        <p className="text-[13px] text-erp-text-secondary">This sample was rejected.</p>
      ) : (
        <p className="text-[13px] text-erp-text-muted">
          {sample.status === 'PENDING_APPROVAL'
            ? 'QC and fit are done — waiting for the design manager or buyer to approve, ask for a revision or reject.'
            : 'Waiting for QC and fit before sign-off.'}
        </p>
      )}
    </Section>
  );
}

export function SampleActivity({ timeline }: { timeline?: Sample['timeline'] }) {
  if (!timeline?.length) return null;
  return (
    <Section title="Activity" className="mt-4">
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {[...timeline].reverse().map((t, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
            <span className="w-40 shrink-0 text-xs text-erp-text-muted">{formatDateTime(t.at)}</span>
            <span className="font-medium text-erp-text-primary">{humanizeStatus(t.action || '')}</span>
            {t.note && <span className="text-erp-text-secondary">“{t.note}”</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
