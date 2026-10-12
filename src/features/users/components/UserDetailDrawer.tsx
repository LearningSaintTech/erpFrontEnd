import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Pencil, Plus, Shield, X } from 'lucide-react';
import { usersApi } from '../../../services/admin';
import type { ErpRole, ErpUser, UserRoleAssignment } from '../../../types/api';
import {
  Badge, Button, DescriptionList, Drawer, DropdownMenu, EmptyState, ErpInput, Field, IconButton,
  Skeleton, StatusBadge, useConfirm,
} from '../../../components/erp';
import {
  factoryLabel, formatExpiresAt, formatLastLogin, isExpired, roleLabel, userDisplayName,
} from '../userUtils';
import { UserAvatar } from '../UserAvatar';
import { UserDelegationsList } from '../UserDelegationsList';
import { AssignRoleModal } from './AssignRoleModal';
import { useUserActions } from '../useUserActions';

export function UserDetailDrawer({
  user, onClose, canUpdate, canDelete, factories, roles, organizationId, factoryId,
}: {
  user: ErpUser | null;
  onClose: () => void;
  canUpdate: boolean;
  canDelete: boolean;
  factories: { _id: string; code: string; name: string }[];
  roles: ErpRole[];
  organizationId?: string;
  factoryId: string | null;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const actions = useUserActions({ canUpdate, canDelete, onDeleted: onClose });

  useEffect(() => {
    setEditing(false);
    setErrors({});
    if (user) setForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '' });
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['user-assignments', user?._id],
    queryFn: () => usersApi.getAssignments(user!._id),
    enabled: !!user,
  });

  const { data: userDelegations = [], isLoading: delegationsLoading } = useQuery({
    queryKey: ['user-delegations', user?._id, factoryId],
    queryFn: () => usersApi.getUserDelegations(user!._id),
    enabled: !!user && !!factoryId,
  });

  const saveProfile = useMutation({
    mutationFn: () => usersApi.update(user!._id, {
      firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim(),
    }),
    meta: { successMessage: 'Profile updated' },
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const revokeAssignment = useMutation({
    mutationFn: (assignmentId: string) => usersApi.revokeAssignment(user!._id, assignmentId),
    meta: { successMessage: 'Role removed' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-assignments', user?._id] });
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['role-members'] });
    },
  });

  const revoke = async (a: UserRoleAssignment) => {
    const ok = await confirm({
      title: `Remove ${roleLabel(a.roleId as ErpRole)}?`,
      message: `${user ? userDisplayName(user) : 'This user'} loses this role at ${factoryLabel(a.factoryId)} immediately. Delegations they gave from it are revoked too.`,
      confirmLabel: 'Remove role',
      tone: 'danger',
    });
    if (ok) revokeAssignment.mutate(a._id);
  };

  const save = () => {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = 'Enter a first name.';
    if (!form.lastName.trim()) next.lastName = 'Enter a last name.';
    setErrors(next);
    if (Object.keys(next).length === 0) saveProfile.mutate();
  };

  const canAssign = canUpdate && !!organizationId && factories.length > 0;

  const footer = user ? (
    editing ? (
      <>
        <Button variant="secondary" onClick={() => { setEditing(false); setErrors({}); setForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '' }); }}>
          Cancel
        </Button>
        <Button loading={saveProfile.isPending} onClick={save}>Save profile</Button>
      </>
    ) : (
      <>
        {(canUpdate || canDelete) && (
          <DropdownMenu
            label="Account actions"
            align="end"
            items={actions.menuItems(user)}
            trigger={<Button variant="secondary" icon={<MoreHorizontal size={16} />} className="mr-auto">More</Button>}
          />
        )}
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {canUpdate && <Button icon={<Pencil size={16} />} onClick={() => setEditing(true)}>Edit profile</Button>}
      </>
    )
  ) : undefined;

  return (
    <>
      <Drawer
        open={!!user}
        onClose={onClose}
        size="md"
        title={user ? (
          <span className="flex items-center gap-2.5">
            <UserAvatar user={user} size="md" />
            <span className="min-w-0">
              <span className="block truncate">{userDisplayName(user)}</span>
              <span className="block truncate text-[13px] font-normal text-erp-text-muted">{user.email}</span>
            </span>
          </span>
        ) : ''}
        headerExtra={user ? (
          <span className="flex items-center gap-1.5">
            {user.isSuperAdmin && <Badge tone="info" dot={false}>Super admin</Badge>}
            <StatusBadge status={user.status || 'ACTIVE'} />
          </span>
        ) : undefined}
        footer={footer}
      >
        {user && (
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-erp-text-primary">Profile</h3>
              {editing ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" required error={errors.firstName}>
                    <ErpInput value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} autoFocus />
                  </Field>
                  <Field label="Last name" required error={errors.lastName}>
                    <ErpInput value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </Field>
                  <Field label="Phone">
                    <ErpInput type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </Field>
                </div>
              ) : (
                <DescriptionList
                  columns={2}
                  items={[
                    { label: 'Phone', value: user.phone },
                    { label: 'Employee ID', value: user.employeeId ? <span className="font-mono">{user.employeeId}</span> : undefined },
                    { label: 'Last sign-in', value: formatLastLogin(user.lastLoginAt) },
                    { label: 'Status', value: <StatusBadge status={user.status || 'ACTIVE'} /> },
                  ]}
                />
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-erp-text-primary">
                  <Shield size={16} className="text-erp-text-muted" aria-hidden="true" /> Roles by factory
                </h3>
                {canAssign && (
                  <Button size="sm" variant="secondary" icon={<Plus size={16} />} onClick={() => setAssignOpen(true)}>Assign role</Button>
                )}
              </div>
              {isLoading ? (
                <div className="space-y-2"><Skeleton height={36} /><Skeleton height={36} /></div>
              ) : assignments.length === 0 ? (
                <EmptyState
                  compact
                  icon={Shield}
                  title={user.isSuperAdmin ? 'Super admins have full access' : 'No roles yet'}
                  description={user.isSuperAdmin ? undefined : 'Without a role this user cannot see any module.'}
                  action={canAssign && !user.isSuperAdmin ? <Button size="sm" onClick={() => setAssignOpen(true)}>Assign a role</Button> : undefined}
                />
              ) : (
                <ul className="divide-y divide-[var(--erp-border)] rounded-lg border border-[var(--erp-border)]">
                  {assignments.map((a) => {
                    const expired = isExpired(a.expiresAt);
                    const expires = formatExpiresAt(a.expiresAt);
                    return (
                      <li key={a._id} className={`flex items-center gap-3 px-3 py-2.5 ${expired ? 'opacity-60' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-erp-text-primary">{roleLabel(a.roleId as ErpRole)}</p>
                          <p className="truncate text-xs text-erp-text-muted">
                            {factoryLabel(a.factoryId)}
                            {expires && <span className={expired ? 'text-[var(--erp-danger-text)]' : ''}> · {expired ? 'Expired' : 'Expires'} {expires}</span>}
                          </p>
                        </div>
                        {canUpdate && (
                          <IconButton aria-label={`Remove ${roleLabel(a.roleId as ErpRole)}`} size="sm" onClick={() => revoke(a)} disabled={revokeAssignment.isPending}>
                            <X size={16} />
                          </IconButton>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-erp-text-primary">Delegations</h3>
              {!factoryId ? (
                <p className="text-[13px] text-erp-text-muted">Select a factory in the header to see delegations.</p>
              ) : (
                <UserDelegationsList
                  userId={user._id}
                  delegations={userDelegations}
                  isLoading={delegationsLoading}
                  canUpdate={canUpdate}
                />
              )}
            </section>
          </div>
        )}
      </Drawer>

      {user && canAssign && organizationId && (
        <AssignRoleModal
          user={user}
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          factories={factories}
          roles={roles}
          organizationId={organizationId}
          defaultFactoryId={factoryId}
        />
      )}
    </>
  );
}
