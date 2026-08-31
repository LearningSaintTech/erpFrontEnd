import { Link } from 'react-router-dom';
import { ErpButton, ErpCard } from '../../../components/erp';

export function PatternNotAssigned({
  designId,
  onClose,
  canAssign,
}: {
  designId: string;
  onClose: () => void;
  canAssign: boolean;
}) {
  return (
    <ErpCard className="!p-4">
      <h3 className="text-[11px] font-semibold text-erp-text-primary">Pattern not assigned yet</h3>
      <p className="mt-2 text-[11px] text-erp-text-muted">
        This released design does not have a pattern master assignment. Sampling stays blocked until pattern development is assigned and completed.
      </p>
      {canAssign ? (
        <p className="mt-2 text-[11px] text-erp-text-muted">
          Go back to the queue and use <strong>Assign pattern master</strong> — the design is pre-selected when you arrive from the design pipeline.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-amber-700">
          Ask a design manager to assign a pattern master to this design.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={onClose}>
          Back to queue
        </ErpButton>
        {canAssign && (
          <Link to={`/designs/${designId}/edit`} className="erp-btn-secondary inline-flex px-3 py-1.5 text-[11px]">
            View tech pack
          </Link>
        )}
      </div>
    </ErpCard>
  );
}
