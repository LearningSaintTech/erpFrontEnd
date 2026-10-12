import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { qualityApi } from '../../services/operations';
import type { QualityDefect, QualityInspection } from '../../types/api';
import {
  Badge, Button, DescriptionList, Drawer, EmptyState, Section, StatusBadge, humanizeStatus,
} from '../../components/erp';
import { dispositionLabel, formatDateTime, inspectionRefId, resultLabel, typeLabel } from './qualityUtils';

type InspectionFull = QualityInspection & {
  inspectedBy?: string | { firstName?: string; lastName?: string };
  storageBinId?: string | { binCode?: string; zoneCode?: string };
  notes?: string;
  createdAt?: string;
};

export function InspectionDetailDrawer({ inspection, onClose, canUpdate, onStart, onComplete, starting }: {
  inspection: QualityInspection | null;
  onClose: () => void;
  canUpdate: boolean;
  onStart: (i: QualityInspection) => void;
  onComplete: (i: QualityInspection) => void;
  starting?: boolean;
}) {
  const id = inspection?._id;
  const detailQ = useQuery({ queryKey: ['quality-inspection', id], queryFn: () => qualityApi.get(id!), enabled: !!id });
  const defectsQ = useQuery({ queryKey: ['inspection-defects', id], queryFn: () => qualityApi.listDefects(id!), enabled: !!id });
  if (!inspection) return null;
  const i: InspectionFull = { ...inspection, ...(detailQ.data ?? {}) };
  const open = ['PENDING', 'IN_PROGRESS'].includes(i.status);
  const isSample = i.inspectionType === 'SAMPLING' || i.referenceType === 'SAMPLE';
  const inspector = typeof i.inspectedBy === 'object' && i.inspectedBy ? [i.inspectedBy.firstName, i.inspectedBy.lastName].filter(Boolean).join(' ') : '';
  const bin = typeof i.storageBinId === 'object' && i.storageBinId ? `${i.storageBinId.zoneCode ?? ''}-${i.storageBinId.binCode ?? ''}` : '';
  const defects = defectsQ.data ?? [];

  return (
    <Drawer
      open
      onClose={onClose}
      size="md"
      title={i.inspectionNumber}
      description={`${typeLabel(i.inspectionType)} inspection`}
      headerExtra={(
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge status={i.status} />
          {i.result && <StatusBadge status={i.result} label={`Result: ${resultLabel(i.result)}`} />}
        </div>
      )}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {canUpdate && i.status === 'PENDING' && (
            <Button variant="secondary" loading={starting} onClick={() => onStart(i)}>Mark started</Button>
          )}
          {canUpdate && open && <Button onClick={() => onComplete(i)}>Complete inspection</Button>}
        </>
      )}
    >
      <div className="space-y-5">
        <DescriptionList
          columns={2}
          items={[
            { label: 'Type', value: typeLabel(i.inspectionType) },
            { label: 'Stage', value: i.stageAtInspection ? humanizeStatus(i.stageAtInspection) : '—', hidden: i.inspectionType !== 'IN_PROCESS' },
            { label: 'Passed', value: i.passedQuantity ?? '—' },
            { label: 'Failed', value: i.failedQuantity ?? '—' },
            { label: 'Disposition', value: dispositionLabel(i.disposition) },
            { label: 'Stored in', value: bin || '—', hidden: !bin },
            { label: 'Inspector', value: inspector || '—' },
            { label: 'Completed', value: formatDateTime(i.completedAt) },
            { label: 'Created', value: formatDateTime(i.createdAt), hidden: !i.createdAt },
            {
              label: 'Reference',
              value: isSample
                ? <Link className="font-medium text-[var(--erp-accent)] hover:underline" to={`/samples?sampleId=${inspectionRefId(i)}`}>Open sample</Link>
                : humanizeStatus(i.referenceType ?? '') || '—',
            },
            { label: 'Notes', value: i.notes, hidden: !i.notes, full: true },
          ]}
        />
        <Section title={`Defects (${defects.length})`} flush>
          {defects.length === 0 ? (
            <EmptyState compact title="No defects logged" />
          ) : (
            <ul className="divide-y divide-[var(--erp-border)]">
              {defects.map((d: QualityDefect) => (
                <li key={d._id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                  <span>{d.description || 'Defect'} <span className="text-erp-text-muted">× {d.quantity}</span></span>
                  <Badge tone={d.severity === 'CRITICAL' ? 'danger' : d.severity === 'MAJOR' ? 'warning' : 'neutral'}>{humanizeStatus(d.severity ?? 'MINOR')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Drawer>
  );
}
