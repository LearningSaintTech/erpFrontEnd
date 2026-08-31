import { useState } from 'react';
import { ErpSelect, ErpButton } from '../../../components/erp';

export type ApproverDecision = 'approve' | 'revision' | 'reject' | 'release';

type Props = {
  status: string;
  /** Must be true — never render for designers */
  allowed: boolean;
  disabled?: boolean;
  loading?: boolean;
  onDecide: (decision: ApproverDecision) => void;
  className?: string;
  compact?: boolean;
};

const IN_REVIEW_OPTIONS: { value: ApproverDecision; label: string }[] = [
  { value: 'approve', label: 'Approve' },
  { value: 'revision', label: 'Request revision' },
  { value: 'reject', label: 'Reject' },
];

export function ApproverActionDropdown({
  status,
  allowed,
  disabled,
  loading,
  onDecide,
  className = '',
  compact,
}: Props) {
  const [choice, setChoice] = useState<ApproverDecision | ''>('');

  if (!allowed) return null;

  if (status === 'APPROVED') {
    return (
      <ErpButton
        className={compact ? '!px-2 !py-1 text-[10px]' : '!px-3 !py-1.5 text-[11px]'}
        disabled={disabled || loading}
        onClick={() => onDecide('release')}
      >
        Release design
      </ErpButton>
    );
  }

  if (status !== 'IN_REVIEW') return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <ErpSelect
        className={compact ? '!py-1 text-[10px] min-w-[140px]' : '!py-1.5 text-[11px] min-w-[180px]'}
        value={choice}
        disabled={disabled || loading}
        onChange={(e) => setChoice(e.target.value as ApproverDecision | '')}
        aria-label="Admin review decision"
      >
        <option value="">Admin decision…</option>
        {IN_REVIEW_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </ErpSelect>
      <ErpButton
        className={compact ? '!px-2 !py-1 text-[10px]' : '!px-3 !py-1.5 text-[11px]'}
        disabled={disabled || loading || !choice}
        onClick={() => {
          if (!choice) return;
          onDecide(choice);
          setChoice('');
        }}
      >
        Apply
      </ErpButton>
    </div>
  );
}
