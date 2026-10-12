import { ArrowRight, Hourglass } from 'lucide-react';
import { Button, DropdownMenu, type DropdownMenuItem } from '../../../components/erp';
import type { SampleAction } from '../sampleNextActions';
import { lowerFirst } from '../sampleWorkflowUtils';

/**
 * "What do I do next" card for a sample: one primary action, a secondary or two,
 * and everything negative / rare in the "⋯" menu. When the user has nothing to do,
 * it says who the sample is waiting on.
 */
export function SampleNextActionBar({
  actions,
  loading,
  waiting,
  onAction,
}: {
  actions: SampleAction[];
  loading?: boolean;
  /** Shown when the user has no actions. */
  waiting?: { who: string; action: string } | null;
  onAction: (action: SampleAction) => void;
}) {
  const isMenuOnly = (a: SampleAction) => !!a.danger && a.id !== 'qc-fail';
  const candidates = actions.filter((a) => !isMenuOnly(a));

  // Nothing for this user to move forward — say who it is waiting on; rare actions stay in "⋯".
  if (!candidates.length) {
    if (!waiting && !actions.length) return null;
    const menuOnly: DropdownMenuItem[] = actions.map((a) => ({
      label: a.label, danger: a.danger, disabled: loading, onSelect: () => onAction(a),
    }));
    return (
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] px-4 py-3 shadow-erp-xs">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--erp-surface-muted)] text-erp-text-muted">
          <Hourglass size={16} />
        </span>
        <div className="min-w-0 flex-1">
          {waiting ? (
            <>
              <p className="text-sm font-medium text-erp-text-primary">Waiting on {lowerFirst(waiting.who)}</p>
              <p className="text-[13px] text-erp-text-secondary">{waiting.action}.</p>
            </>
          ) : <p className="text-sm text-erp-text-secondary">No action needed from you.</p>}
        </div>
        {menuOnly.length > 0 && <DropdownMenu items={menuOnly} label="More sample actions" align="end" />}
      </div>
    );
  }

  const primary = candidates.find((a) => a.kind !== 'comment' && !a.danger) ?? candidates[0];
  const secondary = candidates.filter((a) => a !== primary).slice(0, 2);
  const menu = actions.filter((a) => a !== primary && !secondary.includes(a));
  const who = primary.who;

  const menuItems: DropdownMenuItem[] = menu.map((a) => ({
    label: a.label,
    danger: a.danger,
    disabled: loading,
    onSelect: () => onAction(a),
  }));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--erp-accent)] bg-[var(--erp-accent-muted)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--erp-accent)]">Your next step · {who}</p>
        <p className="text-sm font-medium text-erp-text-primary">{waiting ? `${waiting.action}.` : primary.label}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {secondary.map((a) => (
          <Button
            key={a.id}
            variant={a.danger ? 'danger' : 'secondary'}
            disabled={loading}
            onClick={() => onAction(a)}
          >
            {a.label}
          </Button>
        ))}
        <Button iconRight={<ArrowRight size={16} />} loading={loading} onClick={() => onAction(primary)}>
          {primary.label}
        </Button>
        {menuItems.length > 0 && <DropdownMenu items={menuItems} label="More sample actions" align="end" />}
      </div>
    </div>
  );
}
