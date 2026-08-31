import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ErpButton, ErpSearchSelect } from '../../../components/erp';
import { patternApi } from '../../../services/manufacturing';
import type { ErpUser } from '../../../types/api';

function masterOptionLabel(u: ErpUser) {
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  if (name && u.email) return `${name} (${u.email})`;
  return name || u.email || 'Pattern master';
}

type Props = {
  open: boolean;
  designLabel?: string;
  loading?: boolean;
  onConfirm: (patternMasterId: string) => void;
  onCancel: () => void;
};

export function ReleasePatternMasterModal({
  open,
  designLabel,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const [patternMasterId, setPatternMasterId] = useState('');

  const { data: masters = [], isLoading, isError } = useQuery({
    queryKey: ['pattern-masters'],
    queryFn: patternApi.listMasters,
    enabled: open,
  });

  useEffect(() => {
    if (open) setPatternMasterId('');
  }, [open]);

  if (!open) return null;

  const canConfirm = !!patternMasterId && !loading && !isLoading && masters.length > 0;

  return createPortal(
    <div
      className="erp-modal-overlay fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/45 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="my-auto w-full max-w-md rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface,var(--erp-header-bg,#fff))] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="release-pattern-master-title"
      >
        <h3 id="release-pattern-master-title" className="text-sm font-semibold text-erp-text-primary">
          Release design
        </h3>
        <p className="mt-1.5 text-[11px] leading-snug text-erp-text-muted">
          {designLabel
            ? `Assign a pattern master for ${designLabel} so pattern, marker, and sampling can start.`
            : 'Choose the next pattern master. They will own pattern, marker, grading, and the rest of development.'}
        </p>

        <label className="mt-3 mb-1 block text-[10px] font-medium text-erp-text-muted" htmlFor="release-pattern-master">
          Pattern master
        </label>
        <ErpSearchSelect
          id="release-pattern-master"
          className="w-full !py-1.5 text-[11px]"
          value={patternMasterId}
          disabled={loading || isLoading}
          loading={isLoading}
          placeholder={isLoading ? 'Loading pattern masters…' : 'Select pattern master…'}
          searchPlaceholder="Search master…"
          emptyText="No pattern masters match"
          onChange={(id) => setPatternMasterId(id)}
          options={masters.map((u) => ({
            value: u._id,
            label: masterOptionLabel(u),
            keywords: `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`,
          }))}
        />

        {!isLoading && masters.length === 0 && (
          <p className="mt-2 text-[11px] text-amber-700">
            No pattern masters for this factory. Assign the Pattern Master role in Users first.
          </p>
        )}
        {isError && (
          <p className="mt-2 text-[11px] text-red-600">Could not load pattern masters.</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <ErpButton variant="secondary" className="!px-3 !py-1.5 text-[11px]" onClick={onCancel} disabled={loading}>
            Cancel
          </ErpButton>
          <ErpButton
            className="!px-3 !py-1.5 text-[11px]"
            disabled={!canConfirm}
            onClick={() => onConfirm(patternMasterId)}
          >
            {loading ? 'Releasing…' : 'Release & assign'}
          </ErpButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
