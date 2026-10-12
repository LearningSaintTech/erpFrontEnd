import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Ban, Factory, Plus } from 'lucide-react';
import { usersApi } from '../../services/admin';
import { useAuth } from '../../app/providers/AuthProvider';
import type { Delegation, ErpUser } from '../../types/api';
import {
  Button, Drawer, EmptyRow, EmptyState, ErpDataTable, ErpInput, ErpSelect, Field, RowActionsMenu,
  Section, StatusBadge, TableSkeleton,
} from '../../components/erp';
import { PermissionMatrix } from './PermissionMatrix';
import { UserAvatar } from './UserAvatar';
import { permissionLabel, userDisplayName } from './userUtils';
import { delegationUser, formatRange, useRevokeDelegation } from './UserDelegationsList';

export function DelegationsTab({
  factoryId,
  users,
  canUpdate,
  createOpen,
  onCreateOpenChange,
}: {
  factoryId: string | null;
  users: ErpUser[];
  canUpdate: boolean;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const { factories } = useAuth();
  const factory = factories.find((f) => f._id === factoryId);
  const revoke = useRevokeDelegation();

  const { data: delegations = [], isLoading } = useQuery({
    queryKey: ['delegations', factoryId],
    queryFn: usersApi.listDelegations,
    enabled: !!factoryId,
  });

  if (!factoryId) {
    return (
      <Section>
        <EmptyState icon={Factory} title="Select a factory" description="Delegations are per factory. Choose one from the switcher in the header." />
      </Section>
    );
  }

  return (
    <>
      <Section
        flush
        title={factory ? `Delegations at ${factory.name}` : 'Delegations'}
        description="Temporary permissions one person lends to another, for example during leave."
      >
        <ErpDataTable>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Permissions</th>
              <th>Period</th>
              <th>Status</th>
              {canUpdate && <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton asRows rows={3} columns={canUpdate ? 6 : 5} />
            ) : delegations.length === 0 ? (
              <EmptyRow
                colSpan={canUpdate ? 6 : 5}
                icon={ArrowRightLeft}
                title="No active delegations"
                action={canUpdate ? <Button size="sm" icon={<Plus size={16} />} onClick={() => onCreateOpenChange(true)}>New delegation</Button> : undefined}
              >
                Lend some of your permissions to a colleague for a fixed period.
              </EmptyRow>
            ) : delegations.map((d: Delegation) => {
              const from = delegationUser(d.delegatorId);
              const to = delegationUser(d.delegateId);
              const perms = d.permissions ?? [];
              return (
                <tr key={d._id}>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      {from.user && <UserAvatar user={from.user} />}
                      <span className="erp-cell-primary">{from.name}</span>
                    </span>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      {to.user && <UserAvatar user={to.user} />}
                      <span>{to.name}</span>
                    </span>
                  </td>
                  <td className="max-w-[18rem]">
                    <span className="block truncate text-erp-text-secondary" title={perms.map(permissionLabel).join('\n')}>
                      {perms.slice(0, 2).map(permissionLabel).join(', ')}
                      {perms.length > 2 && <span className="text-erp-text-muted"> +{perms.length - 2} more</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-erp-text-muted">{formatRange(d.startDate, d.endDate)}</td>
                  <td><StatusBadge status={d.status || 'ACTIVE'} /></td>
                  {canUpdate && (
                    <td className="erp-cell-actions">
                      <RowActionsMenu items={[
                        { label: 'Revoke', icon: Ban, danger: true, hidden: !!d.status && d.status !== 'ACTIVE', onSelect: () => revoke.ask(d) },
                      ]} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </ErpDataTable>
      </Section>

      {canUpdate && (
        <DelegationFormDrawer open={createOpen} onClose={() => onCreateOpenChange(false)} users={users} factoryId={factoryId} />
      )}
    </>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DelegationFormDrawer({
  open, onClose, users, factoryId,
}: { open: boolean; onClose: () => void; users: ErpUser[]; factoryId: string }) {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [delegateId, setDelegateId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: catalog = [] } = useQuery({
    queryKey: ['permission-catalog'],
    queryFn: usersApi.listPermissions,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      const now = new Date();
      const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setDelegateId('');
      setPermissions([]);
      setStartDate(toLocalInput(now));
      setEndDate(toLocalInput(week));
      setErrors({});
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () => usersApi.createDelegation({
      delegateId,
      permissions,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
    }),
    meta: { successMessage: 'Delegation created' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delegations', factoryId] });
      qc.invalidateQueries({ queryKey: ['user-delegations'] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!delegateId) next.delegateId = 'Choose who receives the permissions.';
    if (!startDate) next.startDate = 'Choose a start time.';
    if (!endDate) next.endDate = 'Choose an end time.';
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) next.endDate = 'End must be after the start.';
    if (permissions.length === 0) next.permissions = 'Select at least one permission to lend.';
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  };

  const candidates = users.filter((u) => u.status === 'ACTIVE' && u._id !== me?._id);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      closeOnOverlayClick={false}
      title="New delegation"
      description="Lend some of your own permissions to a colleague at this factory for a fixed period."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="delegation-form" loading={create.isPending}>Create delegation</Button>
        </>
      )}
    >
      <form id="delegation-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Delegate to" required error={errors.delegateId}>
            <ErpSelect value={delegateId} onChange={(e) => setDelegateId(e.target.value)}>
              <option value="">Select a person…</option>
              {candidates.map((u) => <option key={u._id} value={u._id}>{userDisplayName(u)}</option>)}
            </ErpSelect>
          </Field>
          <Field label="Starts" required error={errors.startDate}>
            <ErpInput type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Ends" required error={errors.endDate}>
            <ErpInput type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-erp-text-primary">Permissions to lend</h3>
          <p className="mb-3 text-[13px] text-erp-text-muted">You can only lend permissions you hold yourself.</p>
          {errors.permissions && <p className="mb-2 text-[13px] text-[var(--erp-danger-text)]" role="alert">{errors.permissions}</p>}
          <PermissionMatrix catalog={catalog} selected={permissions} onChange={setPermissions} />
        </div>
      </form>
    </Drawer>
  );
}
