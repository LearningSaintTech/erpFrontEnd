import { useState } from 'react';
import { Button, InfoBanner, Modal } from '../../components/erp';

const PREVIEW_MAX_CHARS = 80;

export function isLongRevisionFeedback(comments: string) {
  return comments.length > PREVIEW_MAX_CHARS || comments.split('\n').length > 2;
}

function FeedbackDialog({
  title,
  comments,
  open,
  onClose,
}: {
  title: string;
  comments: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-erp-text-primary">{comments}</p>
    </Modal>
  );
}

function MoreLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="shrink-0 text-xs font-medium text-[var(--erp-accent)] hover:underline"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={label}
    >
      More
    </button>
  );
}

function InlineFeedback({ prefix, comments, tone, dialogTitle }: {
  prefix: string;
  comments: string;
  tone: 'warning' | 'danger';
  dialogTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const long = isLongRevisionFeedback(comments);
  return (
    <>
      <div className="mt-0.5 flex max-w-xs items-start gap-1.5">
        <p className={`text-xs ${tone === 'danger' ? 'text-[var(--erp-danger-text)]' : 'text-[var(--erp-warning-text)]'} ${long ? 'line-clamp-2' : ''}`}>
          <span className="font-medium">{prefix}:</span> {comments}
        </p>
        {long && <MoreLink onClick={() => setOpen(true)} label={`View full ${dialogTitle.toLowerCase()}`} />}
      </div>
      <FeedbackDialog title={dialogTitle} comments={comments} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PreviewFeedback({ comments, dialogTitle }: { comments: string; dialogTitle: string }) {
  const [open, setOpen] = useState(false);
  const long = isLongRevisionFeedback(comments);
  return (
    <>
      <div className="mt-0.5 flex items-start gap-1.5">
        <p className={`text-[13px] text-erp-text-primary ${long ? 'line-clamp-3' : 'whitespace-pre-wrap'}`}>{comments}</p>
        {long && <MoreLink onClick={() => setOpen(true)} label={`View full ${dialogTitle.toLowerCase()}`} />}
      </div>
      <FeedbackDialog title={dialogTitle} comments={comments} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RevisionFeedbackInline({ comments }: { comments: string }) {
  return <InlineFeedback prefix="Revision" comments={comments} tone="warning" dialogTitle="Revision feedback" />;
}

export function RejectionFeedbackInline({ comments }: { comments: string }) {
  return <InlineFeedback prefix="Rejected" comments={comments} tone="danger" dialogTitle="Rejection reason" />;
}

export function RevisionFeedbackPreview({ comments }: { comments: string }) {
  return <PreviewFeedback comments={comments} dialogTitle="Revision feedback" />;
}

export function RejectionFeedbackPreview({ comments }: { comments: string }) {
  return <PreviewFeedback comments={comments} dialogTitle="Rejection reason" />;
}

/** Page-level banner on the design record — full text, never truncated. */
export function RevisionFeedbackBanner({ comments }: { comments: string }) {
  return (
    <InfoBanner inset={false} tone="warn" title="Revision requested" className="mb-4">
      <p className="whitespace-pre-wrap">{comments}</p>
    </InfoBanner>
  );
}

export function RejectionFeedbackBanner({ comments }: { comments: string }) {
  return (
    <InfoBanner inset={false} tone="danger" title="Design rejected" className="mb-4">
      <p className="whitespace-pre-wrap">{comments}</p>
    </InfoBanner>
  );
}
