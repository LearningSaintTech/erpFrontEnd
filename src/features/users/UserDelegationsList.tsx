import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowRightLeft, X } from 'lucide-react';
import { usersApi } from '../../services/admin';
import type { Delegation, ErpUser } from '../../types/api';
import {
  Badge, EmptyState, IconButton, Skeleton, useConfirm,
} from '../../components/erp';
import { permissionLabel, userDisplayName } from './userUtils';
import { formatDateTime } from '../../utils/format';

export function delegationUser(u?: ErpUser | string) {
  if (!u) return { name: '—', email: '', user: undefined as ErpUser | undefined };
  if (typeof u === 'string') return { name: u, email: '', user: undefined };
  return { name: userDisplayName(u), email: u.email, user: u };
}

export function formatRange(start?: string, end?: string) {
  const f = (d?: string) => formatDateTime(d);
  return `${f(start)} → ${f(end)}`;
}

export function useRevokeDelegation(onRevoked?: () => void) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const revoke = useMutation({
    mutationFn: (id: string) => usersApi.revokeDelegation(id),
    meta: { successMessage: 'Delegation revoked' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-delegations'] });
      qc.invalidateQueries({ queryKey: ['delegations'] });
      onRevoked?.();
    },
  });
  const ask = async (d: Delegation) => {
    const ok = await confirm({
      title: 'Revoke this delegation?',
      message: `${delegationUser(d.delegateId).name} immediately loses the ${d.permissions?.length ?? 0} borrowed permissions.`,
      confirmLabel: 'Revoke',
      tone: 'danger',
    });
    if (ok) revoke.mutate(d._id);
  };
  return { ask, isPending: revoke.isPending };
}

/** Delegations given or received by one user (inside the user drawer). */
export function UserDelegationsList({
  userId,
  delegations,
  isLoading,
  canUpdate,
}: {
  userId: string;
  delegations: Delegation[];
  isLoading: boolean;
  canUpdate: boolean;
}) {
  const revoke = useRevokeDelegation();

  if (isLoading) {
    return <div className="space-y-2"><Skeleton height={48} /><Skeleton height={48} /></div>;
  }

  if (delegations.length === 0) {
    return <EmptyState compact icon={ArrowRightLeft} title="No active delegations" description="Permissions lent to or from this user at the selected factory appear here." />;
  }

  return (
    <ul className="divide-y divide-[var(--erp-border)] rounded-lg border border-[var(--erp-border)]">
      {delegations.map((d) => {
        const from = delegationUser(d.delegatorId);
        const to = delegationUser(d.delegateId);
        const isDelegator = (typeof d.delegatorId === 'string' ? d.delegatorId : d.delegatorId?._id) === userId;
        const perms = d.permissions ?? [];
        return (
          <li key={d._id} className="px-3 py-2.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                  <Badge tone={isDelegator ? 'info' : 'success'} dot={false}>{isDelegator ? 'Lent' : 'Received'}</Badge>
                  <span className="font-medium text-erp-text-primary">{from.name}</span>
                  <ArrowRight size={14} className="text-erp-text-muted" aria-hidden="true" />
                  <span className="font-medium text-erp-text-primary">{to.name}</span>
                </div>
                <p className="mt-1 text-xs text-erp-text-muted">{formatRange(d.startDate, d.endDate)}</p>
                <p className="mt-1 text-xs text-erp-text-secondary" title={perms.join(', ')}>
                  {perms.slice(0, 4).map(permissionLabel).join(', ')}
                  {perms.length > 4 && ` +${perms.length - 4} more`}
                </p>
              </div>
              {canUpdate && (
                <IconButton aria-label="Revoke delegation" size="sm" onClick={() => revoke.ask(d)} disabled={revoke.isPending}>
                  <X size={16} />
                </IconButton>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
