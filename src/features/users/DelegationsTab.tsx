import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Calendar, Factory, Shield } from 'lucide-react';
import { usersApi } from '../../services/admin';
import { useAuth } from '../../app/providers/AuthProvider';
import type { Delegation, ErpUser } from '../../types/api';
import { ErpButton, ErpCard, ErpInput, ErpSelect } from '../../components/erp';
import { PermissionMatrix } from './PermissionMatrix';
import { UserAvatar } from './UserAvatar';
import { userDisplayName } from './userUtils';
import { ConfirmDialog } from './ConfirmDialog';

function delegationUser(u?: ErpUser | string) {
  if (!u) return { name: '—', email: '' };
  if (typeof u === 'string') return { name: u, email: '' };
  return { name: userDisplayName(u), email: u.email, user: u };
}

export function DelegationsTab({
  factoryId,
  users,
  canUpdate,
  onError,
  onSuccess,
}: {
  factoryId: string | null;
  users: ErpUser[];
  canUpdate: boolean;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}) {
  const { factories } = useAuth();
  const qc = useQueryClient();
  const [delegateId, setDelegateId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const factory = factories.find((f) => f._id === factoryId);

  const { data: delegations = [], isLoading } = useQuery({
    queryKey: ['delegations', factoryId],
    queryFn: usersApi.listDelegations,
    enabled: !!factoryId,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['permission-catalog'],
    queryFn: usersApi.listPermissions,
  });

  const create = useMutation({
    mutationFn: () => usersApi.createDelegation({
      delegateId,
      permissions,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delegations', factoryId] });
      setDelegateId('');
      setPermissions([]);
      setStartDate('');
      setEndDate('');
      onSuccess?.('Delegation created');
    },
    onError: (e: Error) => onError(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => usersApi.revokeDelegation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delegations', factoryId] });
      setRevokeId(null);
      onSuccess?.('Delegation revoked');
    },
    onError: (e: Error) => onError(e.message),
  });

  if (!factoryId) {
    return (
      <ErpCard className="!p-6 text-center">
        <Factory size={28} className="mx-auto mb-2 text-erp-text-muted opacity-50" />
        <p className="text-[11px] font-medium text-erp-text-secondary">No factory selected</p>
        <p className="mt-1 text-[10px] text-erp-text-muted">
          Choose a factory from the header switcher to view and manage delegations.
        </p>
      </ErpCard>
    );
  }

  return (
    <div className="space-y-3">
      {factory && (
        <div className="flex items-center gap-2 text-[10px] text-erp-text-muted">
          <Factory size={12} />
          <span>Factory: <strong className="text-erp-text-secondary">{factory.code} — {factory.name}</strong></span>
        </div>
      )}

      {canUpdate && (
        <ErpCard className="!p-3">
          <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-medium">
            <Shield size={14} className="text-[var(--erp-accent)]" />
            Delegate permissions
          </h3>
          <p className="mb-3 text-[10px] text-erp-text-muted">
            Temporarily lend a subset of your permissions to another active user at this factory.
          </p>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <label className="text-[10px] sm:col-span-1">
              <span className="mb-0.5 block text-erp-text-muted">Delegate to</span>
              <ErpSelect
                value={delegateId}
                onChange={(e) => setDelegateId(e.target.value)}
                className="!py-1 !text-[11px] w-full"
              >
                <option value="">Select user…</option>
                {users.filter((u) => u.status === 'ACTIVE').map((u) => (
                  <option key={u._id} value={u._id}>{userDisplayName(u)} — {u.email}</option>
                ))}
              </ErpSelect>
            </label>
            <label className="text-[10px]">
              <span className="mb-0.5 block text-erp-text-muted">Start</span>
              <ErpInput type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="!py-1 !text-[11px] w-full" />
            </label>
            <label className="text-[10px]">
              <span className="mb-0.5 block text-erp-text-muted">End</span>
              <ErpInput type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="!py-1 !text-[11px] w-full" />
            </label>
          </div>
          <PermissionMatrix catalog={catalog} selected={permissions} onChange={setPermissions} compact />
          <div className="mt-3">
            <ErpButton
              className="!px-3 !py-1.5 text-[11px]"
              disabled={!delegateId || !permissions.length || !startDate || !endDate || create.isPending}
              onClick={() => create.mutate()}
            >
              Create delegation
            </ErpButton>
          </div>
        </ErpCard>
      )}

      <ErpCard className="overflow-hidden !p-0">
        {isLoading ? (
          <p className="p-4 text-[11px] text-erp-text-muted">Loading delegations…</p>
        ) : delegations.length === 0 ? (
          <p className="p-6 text-center text-[11px] text-erp-text-muted">No active delegations for this factory.</p>
        ) : (
          <ul className="divide-y divide-[var(--erp-border)]">
            {delegations.map((d: Delegation) => {
              const from = delegationUser(d.delegatorId);
              const to = delegationUser(d.delegateId);
              return (
                <li key={d._id} className="px-3 py-3 text-[11px]">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {from.user && <UserAvatar user={from.user} />}
                    <span className="font-medium">{from.name}</span>
                    <ArrowRight size={12} className="text-erp-text-muted" />
                    {to.user && <UserAvatar user={to.user} />}
                    <span className="font-medium">{to.name}</span>
                    {canUpdate && (
                      <ErpButton
                        variant="secondary"
                        className="!ml-auto !px-2 !py-0.5 text-[10px]"
                        disabled={revoke.isPending}
                        onClick={() => setRevokeId(d._id)}
                      >
                        Revoke
                      </ErpButton>
                    )}
                  </div>
                  <div className="mb-1.5 flex items-center gap-1 text-[10px] text-erp-text-muted">
                    <Calendar size={10} />
                    {d.startDate ? new Date(d.startDate).toLocaleString() : '—'} — {d.endDate ? new Date(d.endDate).toLocaleString() : '—'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(d.permissions ?? []).slice(0, 12).map((p) => (
                      <span key={p} className="rounded bg-[var(--erp-accent)]/10 px-1.5 py-px font-mono text-[9px] text-[var(--erp-accent)]">
                        {p}
                      </span>
                    ))}
                    {(d.permissions?.length ?? 0) > 12 && (
                      <span className="text-[10px] text-erp-text-muted">+{(d.permissions?.length ?? 0) - 12} more</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ErpCard>

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
    </div>
  );
}
