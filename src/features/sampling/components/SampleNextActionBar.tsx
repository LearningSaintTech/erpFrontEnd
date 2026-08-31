import { ErpButton } from '../../../components/erp';
import type { SampleAction } from '../sampleNextActions';

export function SampleNextActionBar({
  actions,
  loading,
  onConfirm,
  onComment,
  onModal,
}: {
  actions: SampleAction[];
  loading?: boolean;
  onConfirm: (action: SampleAction) => void;
  onComment: (action: SampleAction) => void;
  onModal: (action: SampleAction) => void;
}) {
  if (!actions.length) return null;

  return (
    <div className="border-b border-[var(--erp-border)] bg-[var(--erp-surface-muted)]/40 px-3 py-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">
        Actions for this sample
      </p>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a) => (
          <ErpButton
            key={a.id}
            variant={a.kind === 'comment' || a.id.includes('reject') || a.id === 'qc-fail' ? 'secondary' : undefined}
            className="!px-2.5 !py-1 text-[10px]"
            disabled={loading}
            title={a.who}
            onClick={() => {
              if (a.kind === 'confirm') onConfirm(a);
              else if (a.kind === 'comment') onComment(a);
              else onModal(a);
            }}
          >
            {a.label}
          </ErpButton>
        ))}
      </div>
      <p className="mt-1 text-[9px] text-erp-text-muted">
        Role: {actions.map((a) => a.who).filter((v, i, arr) => arr.indexOf(v) === i).join(' · ')}
      </p>
    </div>
  );
}
