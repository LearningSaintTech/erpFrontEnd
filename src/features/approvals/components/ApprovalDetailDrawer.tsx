import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Check, ExternalLink, Undo2, X } from 'lucide-react';
import { approvalApi } from '../../../services/approvals';
import type { ApprovalInstance } from '../../../types/api';
import {
  Badge, Button, DescriptionList, Drawer, InfoBanner, StatusBadge,
} from '../../../components/erp';
import {
  blockedReason, documentCode, documentTypeLabel, formatAge, isOverSla, levelSlaHours, personName,
  rejectionFeedback, requiredApproverLabel, revisionFeedback, stepActionLabel, stepTone, submitterName,
  workflowLevelLabel,
} from '../approvalUtils';
import { RevisionFeedbackPreview, RejectionFeedbackPreview } from '../../design/RevisionFeedbackBanner';
import type { ApprovalActionType } from '../useApprovalActions';
import { formatDateTime } from '../../../utils/format';

const TONE_DOT: Record<string, string> = {
  success: 'bg-[var(--erp-success-solid)]',
  danger: 'bg-[var(--erp-danger-solid)]',
  warning: 'bg-[var(--erp-warning-solid)]',
  neutral: 'bg-[var(--erp-neutral-solid)]',
};

export function ApprovalDetailDrawer({
  item, onClose, canAct, userId, onAction, actionPending,
}: {
  item: ApprovalInstance | null;
  onClose: () => void;
  /** Whether the current user may decide on this item. */
  canAct?: boolean;
  userId?: string;
  onAction?: (item: ApprovalInstance, type: ApprovalActionType) => void;
  actionPending?: boolean;
}) {
  const navigate = useNavigate();
  // Refresh the full record (steps, summary) while the drawer is open; the list row is shown meanwhile.
  const { data } = useQuery({
    queryKey: ['approval', item?._id],
    queryFn: () => approvalApi.get(item!._id),
    enabled: !!item,
    placeholderData: item ?? undefined,
  });
  const a = (item && data && data._id === item._id ? data : item);

  const summary = a?.documentSummary;
  const feedback = a ? revisionFeedback(a) : undefined;
  const rejected = a ? rejectionFeedback(a) : undefined;
  const pending = a?.status === 'PENDING';
  const overSla = a ? isOverSla(a) : false;
  const steps = a?.steps ?? [];

  const footer = a ? (
    <>
      {pending && canAct && onAction ? (
        <>
          <Button variant="secondary" icon={<X size={16} />} disabled={actionPending} onClick={() => onAction(a, 'reject')}>
            Reject
          </Button>
          <Button variant="secondary" icon={<Undo2 size={16} />} disabled={actionPending} onClick={() => onAction(a, 'changes')}>
            Request changes
          </Button>
          <Button icon={<Check size={16} />} loading={actionPending} onClick={() => onAction(a, 'approve')}>
            Approve
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={onClose}>Close</Button>
      )}
    </>
  ) : undefined;

  return (
    <Drawer
      open={!!item}
      onClose={onClose}
      size="md"
      title={a ? documentCode(a) : ''}
      description={a ? `${documentTypeLabel(a.documentType)}${summary?.title ? ` · ${summary.title}` : ''}` : undefined}
      headerExtra={a ? <StatusBadge status={a.status} /> : undefined}
      footer={footer}
    >
      {a && (
        <div className="space-y-5">
          {pending && !canAct && (
            <InfoBanner inset={false} tone="muted">{blockedReason(a, userId)}</InfoBanner>
          )}
          {overSla && (
            <InfoBanner inset={false} tone="warn">
              Waiting {formatAge(a.submittedAt).replace(' ago', '')} — longer than the {levelSlaHours(a)}h target for this level.
            </InfoBanner>
          )}

          {summary?.preview && (
            <div className="flex gap-4 rounded-lg border border-[var(--erp-border)] p-3">
              {summary.preview.imageUrl ? (
                <img src={summary.preview.imageUrl} alt={`${summary.title ?? 'Design'} front`} className="h-28 w-24 shrink-0 rounded-md border border-[var(--erp-border)] object-cover" />
              ) : (
                <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-[var(--erp-border)] text-xs text-erp-text-muted">No image</div>
              )}
              <div className="min-w-0 space-y-2 text-[13px]">
                <p className="font-medium text-erp-text-primary">{summary.title}{summary.subtitle ? <span className="font-normal text-erp-text-muted"> · {summary.subtitle}</span> : null}</p>
                {!!summary.preview.colors?.length && (
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {summary.preview.colors.map((c) => (
                      <span key={c.name} className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm border border-[var(--erp-border)]" style={{ background: c.hexCode || 'transparent' }} aria-hidden />
                        {c.name}
                      </span>
                    ))}
                  </p>
                )}
                {!!summary.preview.sizes?.length && <p className="text-erp-text-secondary">Sizes {summary.preview.sizes.join(', ')}</p>}
                {summary.preview.targetPrice != null && <p className="text-erp-text-secondary">Target price ₹{summary.preview.targetPrice.toLocaleString('en-IN')}</p>}
              </div>
            </div>
          )}

          <DescriptionList
            columns={2}
            items={[
              { label: 'Submitted by', value: submitterName(a.submittedBy) },
              { label: 'Submitted', value: a.submittedAt ? `${formatDateTime(a.submittedAt)} (${formatAge(a.submittedAt)})` : '—' },
              { label: 'Approval step', value: workflowLevelLabel(a) },
              { label: 'Approver', value: requiredApproverLabel(a), hidden: !pending },
              { label: 'Completed', value: formatDateTime(a.completedAt), hidden: pending },
              { label: 'Document status', value: summary?.status ? <StatusBadge status={summary.status} /> : '—' },
              { label: 'Workflow', value: typeof a.workflowId === 'object' ? a.workflowId?.name : '—' },
            ]}
          />

          {summary?.route && (
            <Button variant="secondary" size="sm" icon={<ExternalLink size={16} />} onClick={() => navigate(summary.route!)}>
              Open {documentTypeLabel(a.documentType).toLowerCase()}
            </Button>
          )}

          {feedback && (
            <div className="rounded-lg border border-[var(--erp-warning-border)] bg-[var(--erp-warning-bg)] px-3 py-2.5">
              <p className="mb-1 text-xs font-semibold text-erp-text-primary">Revision feedback</p>
              <RevisionFeedbackPreview comments={feedback} />
            </div>
          )}
          {rejected && (
            <div className="rounded-lg border border-[var(--erp-danger-border)] bg-[var(--erp-danger-bg)] px-3 py-2.5">
              <p className="mb-1 text-xs font-semibold text-erp-text-primary">Rejection reason</p>
              <RejectionFeedbackPreview comments={rejected} />
            </div>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold text-erp-text-primary">History</h3>
            <ol className="relative space-y-4 border-l border-[var(--erp-border)] pl-5">
              {a.submittedAt && (
                <li className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--erp-info-solid)] ring-4 ring-[var(--erp-surface)]" aria-hidden="true" />
                  <p className="text-[13px] font-medium text-erp-text-primary">Submitted for approval</p>
                  <p className="text-xs text-erp-text-muted">
                    {submitterName(a.submittedBy)} · {formatDateTime(a.submittedAt)}
                  </p>
                </li>
              )}
              {steps.map((step, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--erp-surface)] ${TONE_DOT[stepTone(step.action)]}`} aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-erp-text-primary">{stepActionLabel(step.action)}</p>
                    {step.level != null && <Badge dot={false} tone="neutral">Level {step.level}</Badge>}
                  </div>
                  <p className="text-xs text-erp-text-muted">
                    {personName(step.approverId)}{step.actionAt ? ` · ${formatDateTime(step.actionAt)}` : ''}
                  </p>
                  {step.comments && (
                    <p className="mt-1 whitespace-pre-wrap rounded-md bg-[var(--erp-surface-muted)] px-2.5 py-1.5 text-[13px] text-erp-text-secondary">
                      {step.comments}
                    </p>
                  )}
                </li>
              ))}
              {pending && (
                <li className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--erp-warning-solid)] bg-[var(--erp-surface)]" aria-hidden="true" />
                  <p className="text-[13px] font-medium text-erp-text-primary">Waiting for decision</p>
                  <p className="text-xs text-erp-text-muted">{workflowLevelLabel(a)} · {requiredApproverLabel(a)}</p>
                </li>
              )}
            </ol>
          </section>
        </div>
      )}
    </Drawer>
  );
}
