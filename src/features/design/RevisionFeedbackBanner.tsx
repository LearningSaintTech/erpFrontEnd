import { useState } from 'react';
import { Info } from 'lucide-react';
import { ErpButton, ErpCard } from '../../components/erp';

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-erp-text-primary">{title}</h3>
        <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-[11px] text-erp-text-primary">
          {comments}
        </p>
        <div className="mt-4 flex justify-end">
          <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={onClose}>
            Close
          </ErpButton>
        </div>
      </div>
    </div>
  );
}

function RevisionFeedbackDialog(props: { comments: string; open: boolean; onClose: () => void }) {
  return <FeedbackDialog title="Revision feedback" {...props} />;
}

function RejectionFeedbackDialog(props: { comments: string; open: boolean; onClose: () => void }) {
  return <FeedbackDialog title="Rejection reason" {...props} />;
}

function InfoButton({
  onClick,
  label = 'View full feedback',
  tone = 'amber',
}: {
  onClick: () => void;
  label?: string;
  tone?: 'amber' | 'red';
}) {
  const toneClass = tone === 'red'
    ? 'text-red-600 hover:bg-red-500/10'
    : 'text-amber-600 hover:bg-amber-500/10';
  return (
    <button
      type="button"
      className={`mt-0.5 shrink-0 rounded p-0.5 ${toneClass}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Info size={12} />
    </button>
  );
}

export function RevisionFeedbackInline({ comments }: { comments: string }) {
  const [open, setOpen] = useState(false);
  const long = isLongRevisionFeedback(comments);

  return (
    <>
      <div className="mt-0.5 flex max-w-xs items-start gap-1">
        <p className={`text-[10px] text-amber-600 ${long ? 'line-clamp-2' : ''}`}>
          Revision: {comments}
        </p>
        {long && <InfoButton onClick={() => setOpen(true)} label="View full revision feedback" />}
      </div>
      <RevisionFeedbackDialog comments={comments} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RevisionFeedbackPreview({ comments }: { comments: string }) {
  const [open, setOpen] = useState(false);
  const long = isLongRevisionFeedback(comments);

  return (
    <>
      <div className="mt-0.5 flex items-start gap-1">
        <p className={`text-[11px] text-erp-text-primary ${long ? 'line-clamp-3' : 'whitespace-pre-wrap'}`}>
          {comments}
        </p>
        {long && <InfoButton onClick={() => setOpen(true)} label="View full revision feedback" />}
      </div>
      <RevisionFeedbackDialog comments={comments} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RevisionFeedbackBanner({ comments }: { comments: string }) {
  const [open, setOpen] = useState(false);
  const long = isLongRevisionFeedback(comments);

  return (
    <>
      <ErpCard className="mb-3 !border-amber-500/30 !bg-amber-500/5 !p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Revision feedback</p>
          {long && <InfoButton onClick={() => setOpen(true)} label="View full revision feedback" />}
        </div>
        <p
          className={`mt-1 text-[11px] ${long ? 'line-clamp-3' : 'whitespace-pre-wrap'}`}
          style={{ color: 'var(--erp-warning-text)' }}
        >
          {comments}
        </p>
      </ErpCard>
      <RevisionFeedbackDialog comments={comments} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RejectionFeedbackInline({ comments }: { comments: string }) {
  const [open, setOpen] = useState(false);
  const long = isLongRevisionFeedback(comments);

  return (
    <>
      <div className="mt-0.5 flex max-w-xs items-start gap-1">
        <p className={`text-[10px] text-red-600 ${long ? 'line-clamp-2' : ''}`}>
          Rejected: {comments}
        </p>
        {long && <InfoButton onClick={() => setOpen(true)} label="View full rejection reason" tone="red" />}
      </div>
      <RejectionFeedbackDialog comments={comments} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RejectionFeedbackBanner({ comments }: { comments: string }) {
  const [open, setOpen] = useState(false);
  const long = isLongRevisionFeedback(comments);

  return (
    <>
      <ErpCard className="mb-3 !border-red-500/30 !bg-red-500/5 !p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">Rejection reason</p>
          {long && <InfoButton onClick={() => setOpen(true)} label="View full rejection reason" tone="red" />}
        </div>
        <p className={`mt-1 text-[11px] text-red-700 ${long ? 'line-clamp-3' : 'whitespace-pre-wrap'}`}>
          {comments}
        </p>
      </ErpCard>
      <RejectionFeedbackDialog comments={comments} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RejectionFeedbackPreview({ comments }: { comments: string }) {
  const [open, setOpen] = useState(false);
  const long = isLongRevisionFeedback(comments);

  return (
    <>
      <div className="mt-0.5 flex items-start gap-1">
        <p className={`text-[11px] text-erp-text-primary ${long ? 'line-clamp-3' : 'whitespace-pre-wrap'}`}>
          {comments}
        </p>
        {long && <InfoButton onClick={() => setOpen(true)} label="View full rejection reason" tone="red" />}
      </div>
      <RejectionFeedbackDialog comments={comments} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
