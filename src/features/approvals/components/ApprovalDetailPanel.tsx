import { Link } from 'react-router-dom';
import { Clock, ExternalLink, User } from 'lucide-react';
import type { ApprovalInstance } from '../../../types/api';
import { ErpCard, ErpStatusBadge } from '../../../components/erp';
import {
  documentTypeLabel, formatAge, rejectionFeedback, revisionFeedback, submitterName, workflowLevelLabel,
  requiredApproverLabel,
} from '../approvalUtils';
import { RevisionFeedbackPreview, RejectionFeedbackPreview } from '../../design/RevisionFeedbackBanner';

export function ApprovalDetailPanel({ item }: { item: ApprovalInstance }) {
  const summary = item.documentSummary;
  const feedback = revisionFeedback(item);
  const rejected = rejectionFeedback(item);

  return (
    <ErpCard className="!p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">
            {documentTypeLabel(item.documentType)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-erp-text-primary">
            {summary?.code || `…${String(item.documentId).slice(-8)}`}
          </p>
          {summary?.title && (
            <p className="text-[11px] text-erp-text-muted">{summary.title}</p>
          )}
        </div>
        <ErpStatusBadge status={item.status} />
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-1.5 text-[11px]">
          <User size={12} className="text-erp-text-muted" />
          <span className="text-erp-text-muted">Submitted by</span>
          <span className="font-medium">{submitterName(item.submittedBy)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <Clock size={12} className="text-erp-text-muted" />
          <span className="text-erp-text-muted">Age</span>
          <span className="font-medium">{formatAge(item.submittedAt)}</span>
        </div>
        <div className="text-[11px] sm:col-span-2">
          <span className="text-erp-text-muted">Workflow step </span>
          <span className="font-medium">{workflowLevelLabel(item)}</span>
        </div>
        {item.status === 'PENDING' && (
          <div className="text-[11px] sm:col-span-2">
            <span className="text-erp-text-muted">Approver role </span>
            <span className="font-medium">{requiredApproverLabel(item)}</span>
          </div>
        )}
        {summary?.status && (
          <div className="text-[11px] sm:col-span-2">
            <span className="text-erp-text-muted">Document status </span>
            <span className="font-medium">{summary.status.replace(/_/g, ' ')}</span>
          </div>
        )}
      </dl>

      {feedback && (
        <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Revision feedback</p>
          <RevisionFeedbackPreview comments={feedback} />
        </div>
      )}

      {rejected && (
        <div className="mt-3 rounded border border-red-500/30 bg-red-500/5 px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Rejection reason</p>
          <RejectionFeedbackPreview comments={rejected} />
        </div>
      )}

      {summary?.route && (
        <Link
          to={summary.route}
          className="mt-3 inline-flex items-center gap-1 text-[11px] text-[var(--erp-accent)]"
        >
          Open document <ExternalLink size={11} />
        </Link>
      )}

      {item.steps && item.steps.length > 0 && (
        <div className="mt-4 border-t border-[var(--erp-border)] pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Timeline</p>
          <ul className="space-y-2">
            {item.steps.map((step, i) => {
              const actor = typeof step.approverId === 'object' ? step.approverId : null;
              const actorName = actor
                ? [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.email
                : 'Approver';
              return (
                <li key={i} className="rounded border border-[var(--erp-border)] px-2 py-1.5 text-[10px]">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{step.action?.replace(/_/g, ' ')}</span>
                    <span className="text-erp-text-muted">
                      {step.actionAt ? new Date(step.actionAt).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className="text-erp-text-muted">{actorName} · L{step.level}</p>
                  {step.comments && <p className="mt-0.5 text-erp-text-primary">{step.comments}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ErpCard>
  );
}
