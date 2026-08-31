import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { designApi } from '../../../services/manufacturing';
import { ErpStatusBadge } from '../../../components/erp';
import { useDesignForm } from '../DesignFormContext';
import { designerName } from '../designFormUtils';
import {
  formatTimelineWhen, timelineBadgeStatus, timelineHasComments, timelineKindLabel,
} from '../designTimelineUtils';
import type { DesignTimelineEntry } from '../../../types/api';

function CommentsDialog({ comments, title, open, onClose }: {
  comments: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-erp-text-primary">{title}</h3>
        <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-[11px] text-erp-text-primary">{comments}</p>
        <button type="button" className="erp-btn-secondary mt-4 px-3 py-1.5 text-[11px]" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function TimelineEntry({ entry }: { entry: DesignTimelineEntry }) {
  const [showComments, setShowComments] = useState(false);
  const hasComments = timelineHasComments(entry);
  const longComments = (entry.comments?.length ?? 0) > 120;

  return (
    <li className="relative pl-6">
      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--erp-accent)] bg-[var(--erp-surface)]" />
      <div className="rounded border border-[var(--erp-border)] px-3 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ErpStatusBadge status={timelineBadgeStatus(entry.kind)} />
            <span className="text-[11px] font-semibold text-erp-text-primary">{timelineKindLabel(entry.kind)}</span>
            {entry.version != null && (
              <span className="font-mono text-[10px] text-erp-text-muted">v{entry.version}</span>
            )}
          </div>
          <span className="text-[10px] text-erp-text-muted">{formatTimelineWhen(entry.at)}</span>
        </div>
        <p className="mt-1 text-[11px] text-erp-text-secondary">{entry.summary}</p>
        <p className="mt-1 text-[10px] text-erp-text-muted">By {designerName(entry.actor)}</p>
        {hasComments && (
          <div className="mt-2 flex items-start gap-1 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
            <p className={`flex-1 text-[10px] ${entry.kind === 'REJECTED' ? 'text-red-700' : 'text-amber-800'} ${longComments ? 'line-clamp-2' : 'whitespace-pre-wrap'}`}>
              {entry.kind === 'REJECTED' ? 'Reason: ' : entry.kind === 'REVISION_REQUESTED' ? 'Feedback: ' : 'Note: '}
              {entry.comments}
            </p>
            {longComments && (
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-amber-700 hover:bg-amber-500/10"
                aria-label="View full comments"
                onClick={() => setShowComments(true)}
              >
                <Info size={12} />
              </button>
            )}
          </div>
        )}
      </div>
      {hasComments && entry.comments && (
        <CommentsDialog
          open={showComments}
          comments={entry.comments}
          title={entry.kind === 'REJECTED' ? 'Rejection reason' : entry.kind === 'REVISION_REQUESTED' ? 'Revision feedback' : 'Comments'}
          onClose={() => setShowComments(false)}
        />
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

  if (isLoading) {
    return <p className="text-[11px] text-erp-text-muted">Loading history…</p>;
  }

  if (timeline.length === 0) {
    return <p className="text-[11px] text-erp-text-muted">No history yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-erp-text-muted">
        <span>Current status <ErpStatusBadge status={design?.status || 'DRAFT'} /></span>
        <span>Version v{design?.currentVersion ?? 1}</span>
      </div>
      <p className="text-[10px] text-erp-text-muted">
        Full audit trail — saves, submissions, approvals, rejections, and revisions.
      </p>
      <ul className="space-y-3 border-l border-[var(--erp-border)] ml-1">
        {timeline.map((entry) => (
          <TimelineEntry key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
