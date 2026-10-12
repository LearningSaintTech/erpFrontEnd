import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { designApi } from '../../../services/manufacturing';
import {
  Button, EmptyState, Modal, Section, Skeleton, StatusBadge,
} from '../../../components/erp';
import { useDesignForm } from '../DesignFormContext';
import { designerName } from '../designFormUtils';
import {
  formatTimelineWhen, timelineBadgeStatus, timelineHasComments, timelineKindLabel,
} from '../designTimelineUtils';
import type { DesignTimelineEntry } from '../../../types/api';

function commentTitle(kind: string) {
  if (kind === 'REJECTED') return 'Rejection reason';
  if (kind === 'REVISION_REQUESTED') return 'Revision feedback';
  return 'Comments';
}

function TimelineEntry({ entry }: { entry: DesignTimelineEntry }) {
  const [open, setOpen] = useState(false);
  const hasComments = timelineHasComments(entry);
  const long = (entry.comments?.length ?? 0) > 160;
  const tone = entry.kind === 'REJECTED'
    ? 'border-[var(--erp-danger-border)] bg-[var(--erp-danger-bg)] text-[var(--erp-danger-text)]'
    : 'border-[var(--erp-warning-border)] bg-[var(--erp-warning-bg)] text-[var(--erp-warning-text)]';

  return (
    <li className="relative pb-5 pl-6 last:pb-0">
      <span className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--erp-accent)] bg-[var(--erp-surface)]" aria-hidden />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-erp-text-primary">{timelineKindLabel(entry.kind)}</span>
        <StatusBadge status={timelineBadgeStatus(entry.kind)} />
        {entry.version != null && <span className="font-mono text-xs text-erp-text-muted">v{entry.version}</span>}
        <span className="ml-auto text-xs text-erp-text-muted">{formatTimelineWhen(entry.at)}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-erp-text-secondary">{entry.summary}</p>
      <p className="text-xs text-erp-text-muted">By {designerName(entry.actor)}</p>
      {hasComments && entry.comments && (
        <div className={`mt-2 rounded-md border px-3 py-2 text-[13px] ${tone}`}>
          <p className={long ? 'line-clamp-3' : 'whitespace-pre-wrap'}>{entry.comments}</p>
          {long && (
            <button type="button" className="mt-1 text-xs font-medium underline" onClick={() => setOpen(true)}>
              Read full {commentTitle(entry.kind).toLowerCase()}
            </button>
          )}
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            size="sm"
            title={commentTitle(entry.kind)}
            footer={<Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>}
          >
            <p className="whitespace-pre-wrap text-sm text-erp-text-primary">{entry.comments}</p>
          </Modal>
        </div>
      )}
    </li>
  );
}

export function VersionHistoryTab() {
  const { design, designId } = useDesignForm();

  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ['design-timeline', designId],
    queryFn: () => designApi.getTimeline(designId!),
    enabled: !!designId,
  });

  return (
    <Section
      title="History"
      description={`Saves, submissions and review decisions · current version v${design?.currentVersion ?? 1}`}
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton height={14} width="40%" />
          <Skeleton height={12} width="70%" />
          <Skeleton height={14} width="35%" />
        </div>
      ) : timeline.length === 0 ? (
        <EmptyState compact icon={History} title="No history yet" />
      ) : (
        <ul className="ml-1 border-l border-[var(--erp-border)]">
          {timeline.map((entry) => <TimelineEntry key={entry.id} entry={entry} />)}
        </ul>
      )}
    </Section>
  );
}
