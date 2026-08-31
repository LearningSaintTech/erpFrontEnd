import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Calendar } from 'lucide-react';
import { usersApi } from '../../services/admin';
import type { Delegation, ErpUser } from '../../types/api';
import { ErpButton } from '../../components/erp';
import { UserAvatar } from './UserAvatar';
import { userDisplayName } from './userUtils';
import { ConfirmDialog } from './ConfirmDialog';

function delegationUser(u?: ErpUser | string) {
  if (!u) return { name: '—', email: '', user: undefined as ErpUser | undefined };
  if (typeof u === 'string') return { name: u, email: '', user: undefined };
  return { name: userDisplayName(u), email: u.email, user: u };
}

export function UserDelegationsList({
  userId,
  delegations,
  isLoading,
  canUpdate,
  onError,
  onSuccess,
}: {
  userId: string;
  delegations: Delegation[];
  isLoading: boolean;
  canUpdate: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const revoke = useMutation({
    mutationFn: (id: string) => usersApi.revokeDelegation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-delegations', userId] });
      qc.invalidateQueries({ queryKey: ['delegations'] });
      setRevokeId(null);
      onSuccess('Delegation revoked');
    },
    onError: (e: Error) => onError(e.message),
  });

  if (isLoading) {
    return <p className="text-erp-text-muted">Loading delegations…</p>;
  }

  if (delegations.length === 0) {
    return <p className="text-erp-text-muted">No active delegations for this user at the selected factory.</p>;
  }

  return (
    <>
      <ul className="space-y-1.5">
        {delegations.map((d) => {
          const from = delegationUser(d.delegatorId);
          const to = delegationUser(d.delegateId);
          const isDelegator = (typeof d.delegatorId === 'string' ? d.delegatorId : d.delegatorId?._id) === userId;
          const isDelegate = (typeof d.delegateId === 'string' ? d.delegateId : d.delegateId?._id) === userId;

          return (
            <li
              key={d._id}
              className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] px-2.5 py-2"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded bg-[var(--erp-accent)]/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-[var(--erp-accent)]">
                  {isDelegator ? 'Delegated out' : isDelegate ? 'Received' : 'Delegation'}
                </span>
                {from.user && <UserAvatar user={from.user} />}
                <span className="font-medium">{from.name}</span>
                <ArrowRight size={11} className="text-erp-text-muted" />
                {to.user && <UserAvatar user={to.user} />}
                <span className="font-medium">{to.name}</span>
                {canUpdate && (
                  <ErpButton
                    variant="secondary"
                    className="!ml-auto !px-1.5 !py-0.5 text-[10px]"
                    disabled={revoke.isPending}
                    onClick={(e) => { e.stopPropagation(); setRevokeId(d._id); }}
                  >
                    Revoke
                  </ErpButton>
                )}
              </div>
              <div className="mb-1 flex items-center gap-1 text-[10px] text-erp-text-muted">
                <Calendar size={10} />
                {d.startDate ? new Date(d.startDate).toLocaleString() : '—'}
                {' — '}
                {d.endDate ? new Date(d.endDate).toLocaleString() : '—'}
              </div>
              <div className="flex flex-wrap gap-1">
                {(d.permissions ?? []).slice(0, 8).map((p) => (
                  <span
                    key={p}
                    className="rounded bg-[var(--erp-accent)]/10 px-1.5 py-px font-mono text-[9px] text-[var(--erp-accent)]"
                  >
                    {p}
                  </span>
                ))}
                {(d.permissions?.length ?? 0) > 8 && (
                  <span className="text-[10px] text-erp-text-muted">+{(d.permissions?.length ?? 0) - 8} more</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={!!revokeId}
        title="Revoke delegation"
        message="The delegate will immediately lose these temporary permissions."
        confirmLabel="Revoke"
        danger
        loading={revoke.isPending}
        onConfirm={() => revokeId && revoke.mutate(revokeId)}
        onCancel={() => setRevokeId(null)}
      />
    </>
  );
}
