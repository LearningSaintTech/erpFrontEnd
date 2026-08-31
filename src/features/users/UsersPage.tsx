import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown, ChevronRight, KeyRound, Lock, Pencil, RefreshCw, Search,
  Shield, Trash2, UserPlus, UserX, ArrowRightLeft,
} from 'lucide-react';
import { usersApi } from '../../services/admin';
import { useAuth } from '../../app/providers/AuthProvider';
import type { ErpRole, ErpUser, UserRoleAssignment } from '../../types/api';
import {
  ErpPageHeader, ErpDataTable, ErpButton, ErpInput, ErpSelect, ErpCard,
  ErpTabs, ErpStatusBadge,
} from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import {
  factoryLabel, formatExpiresAt, formatLastLogin, isExpired, roleLabel, userDisplayName, userRolesLabel,
} from './userUtils';
import { PermissionMatrix } from './PermissionMatrix';
import { DelegationsTab } from './DelegationsTab';
import { UserDelegationsList } from './UserDelegationsList';
import { ConfirmDialog, PromptDialog } from './ConfirmDialog';
import { UserAvatar } from './UserAvatar';
import { RbacInfoCard } from './RbacInfoCard';
import { SuccessBanner } from './SuccessBanner';

const PAGE_SIZE = 20;
const USER_STATUSES = ['', 'ACTIVE', 'INACTIVE', 'LOCKED'];

type View = 'users' | 'roles' | 'delegations';
type RoleFilter = 'all' | 'system' | 'custom';

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-erp-text-muted">
      {children}
    </h4>
  );
}

function UserDetailPanel({
  user,
  canUpdate,
  canDelete,
  factories,
  roles,
  organizationId,
  factoryId,
  onDeleted,
  onError,
  onSuccess,
}: {
  user: ErpUser;
  canUpdate: boolean;
  canDelete: boolean;
  factories: { _id: string; code: string; name: string }[];
  roles: ErpRole[];
  organizationId?: string;
  factoryId: string | null;
  onDeleted: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignFactoryId, setAssignFactoryId] = useState(factories[0]?._id || '');
  const [assignExpiresAt, setAssignExpiresAt] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || '',
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['user-assignments', user._id],
    queryFn: () => usersApi.getAssignments(user._id),
  });

  const { data: userDelegations = [], isLoading: delegationsLoading } = useQuery({
    queryKey: ['user-delegations', user._id, factoryId],
    queryFn: () => usersApi.getUserDelegations(user._id),
    enabled: !!factoryId,
  });

  const revokeAssignment = useMutation({
    mutationFn: (assignmentId: string) => usersApi.revokeAssignment(user._id, assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-assignments', user._id] });
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (e: Error) => onError(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => usersApi.update(user._id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => onError(e.message),
  });

  const assignRole = useMutation({
    mutationFn: () => usersApi.assignRole(user._id, {
      roleId: assignRoleId,
      factoryId: assignFactoryId,
      organizationId: organizationId!,
      expiresAt: assignExpiresAt ? new Date(assignExpiresAt).toISOString() : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-assignments', user._id] });
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      setAssignRoleId('');
      setAssignExpiresAt('');
      onSuccess('Role assigned successfully');
    },
    onError: (e: Error) => onError(e.message),
  });

  const saveProfile = useMutation({
    mutationFn: () => usersApi.update(user._id, editForm),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      onSuccess('Profile updated');
    },
    onError: (e: Error) => onError(e.message),
  });

  const resetPassword = useMutation({
    mutationFn: (newPassword: string) => usersApi.resetPassword(user._id, newPassword),
    onSuccess: () => {
      setResetPwdOpen(false);
      onSuccess('Password reset — user must change on next login');
    },
    onError: (e: Error) => onError(e.message),
  });

  const unlock = useMutation({
    mutationFn: () => usersApi.unlock(user._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      onSuccess('Account unlocked');
    },
    onError: (e: Error) => onError(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: () => usersApi.delete(user._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      setConfirmDelete(false);
      onDeleted();
      onSuccess('User deleted');
    },
    onError: (e: Error) => onError(e.message),
  });

  return (
    <div className="border-t border-[var(--erp-border)] bg-[var(--erp-surface-muted)] px-3 py-3 text-[11px] leading-snug">
      <div className="mb-3 flex items-start gap-2">
        <UserAvatar user={user} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-erp-text-primary">{userDisplayName(user)}</p>
          <p className="truncate text-[10px] text-erp-text-muted">{user.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ErpStatusBadge status={user.status} />
            {user.isSuperAdmin && (
              <span className="rounded bg-violet-500/15 px-1.5 py-px text-[10px] font-medium text-violet-600">Super admin</span>
            )}
          </div>
        </div>
      </div>

      <SectionTitle>Profile</SectionTitle>
      <div className="mb-3 grid gap-2 md:grid-cols-3">
        {editing ? (
          <>
            <label className="text-[10px]">
              <span className="mb-0.5 block text-erp-text-muted">First name</span>
              <ErpInput value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className="!py-1 !text-[11px] w-full" />
            </label>
            <label className="text-[10px]">
              <span className="mb-0.5 block text-erp-text-muted">Last name</span>
              <ErpInput value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className="!py-1 !text-[11px] w-full" />
            </label>
            <label className="text-[10px]">
              <span className="mb-0.5 block text-erp-text-muted">Phone</span>
              <ErpInput value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="!py-1 !text-[11px] w-full" />
            </label>
          </>
        ) : (
          <>
            <div>
              <span className="text-[10px] text-erp-text-muted">Phone</span>
              <p>{user.phone || '—'}</p>
            </div>
            <div>
              <span className="text-[10px] text-erp-text-muted">Employee ID</span>
              <p className="font-mono">{user.employeeId || '—'}</p>
            </div>
            <div>
              <span className="text-[10px] text-erp-text-muted">Last login</span>
              <p>{formatLastLogin(user.lastLoginAt)}</p>
            </div>
          </>
        )}
      </div>

      {canUpdate && (
        <div className="mb-3 flex flex-wrap gap-1">
          {editing ? (
            <>
              <ErpButton className="!px-2 !py-1 text-[10px]" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>Save</ErpButton>
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" onClick={() => { setEditing(false); setEditForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '' }); }}>Cancel</ErpButton>
            </>
          ) : (
            <ErpButton variant="secondary" className="!inline-flex !items-center !gap-1 !px-2 !py-1 text-[10px]" onClick={() => setEditing(true)}>
              <Pencil size={10} /> Edit
            </ErpButton>
          )}
          <ErpButton variant="secondary" className="!inline-flex !items-center !gap-1 !px-2 !py-1 text-[10px]" disabled={resetPassword.isPending} onClick={() => setResetPwdOpen(true)}>
            <KeyRound size={10} /> Reset password
          </ErpButton>
          {user.status === 'LOCKED' && (
            <ErpButton variant="secondary" className="!inline-flex !items-center !gap-1 !px-2 !py-1 text-[10px]" disabled={unlock.isPending} onClick={() => unlock.mutate()}>
              <Lock size={10} /> Unlock
            </ErpButton>
          )}
          {user.status !== 'LOCKED' && (
            user.status === 'ACTIVE' ? (
              <ErpButton variant="secondary" className="!inline-flex !items-center !gap-1 !px-2 !py-1 text-[10px]" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate('INACTIVE')}>
                <UserX size={10} /> Deactivate
              </ErpButton>
            ) : (
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate('ACTIVE')}>Activate</ErpButton>
            )
          )}
          {canDelete && !user.isSuperAdmin && (
            <ErpButton variant="secondary" className="!inline-flex !items-center !gap-1 !px-2 !py-1 text-[10px] text-red-600" disabled={deleteUser.isPending} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={10} /> Delete
            </ErpButton>
          )}
        </div>
      )}

      <SectionTitle><Shield size={10} /> Factory role assignments</SectionTitle>
      {isLoading ? (
        <p className="text-erp-text-muted">Loading assignments…</p>
      ) : assignments.length === 0 ? (
        <p className="mb-2 text-erp-text-muted">No roles assigned yet.</p>
      ) : (
        <ul className="mb-2 space-y-1.5">
          {assignments.map((a: UserRoleAssignment) => {
            const expired = isExpired(a.expiresAt);
            const expiresLabel = formatExpiresAt(a.expiresAt);
            return (
            <li key={a._id} className={`flex flex-wrap items-center gap-2 rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] px-2.5 py-1.5 ${expired ? 'opacity-60' : ''}`}>
              <span className="font-medium">{roleLabel(a.roleId as ErpRole)}</span>
              <span className="font-mono text-[10px] text-erp-text-muted">
                {typeof a.roleId !== 'string' && a.roleId ? a.roleId.code : ''}
              </span>
              <span className="text-erp-text-muted">@</span>
              <span>{factoryLabel(a.factoryId)}</span>
              {expiresLabel && (
                <span className={`text-[10px] ${expired ? 'text-red-500' : 'text-erp-text-muted'}`}>
                  {expired ? 'Expired' : 'Expires'} {expiresLabel}
                </span>
              )}
              {canUpdate && (
                <ErpButton
                  variant="secondary"
                  className="!ml-auto !px-1.5 !py-0.5 text-[10px]"
                  disabled={revokeAssignment.isPending}
                  onClick={(e) => { e.stopPropagation(); revokeAssignment.mutate(a._id); }}
                >
                  Revoke
                </ErpButton>
              )}
            </li>
          );})}
        </ul>
      )}

      {canUpdate && organizationId && factories.length > 0 && (
        <div className="rounded-lg border border-dashed border-[var(--erp-border)] bg-[var(--erp-surface)] p-2.5">
          <p className="mb-2 text-[10px] font-medium text-erp-text-secondary">Assign a role</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[10px]">
              <span className="mb-0.5 block text-erp-text-muted">Factory</span>
              <ErpSelect
                value={assignFactoryId}
                onChange={(e) => setAssignFactoryId(e.target.value)}
                className="!py-1 !text-[11px]"
              >
                {factories.map((f) => (
                  <option key={f._id} value={f._id}>{f.code} — {f.name}</option>
                ))}
              </ErpSelect>
            </label>
            <label className="text-[10px]">
              <span className="mb-0.5 block text-erp-text-muted">Role</span>
              <ErpSelect
                value={assignRoleId}
                onChange={(e) => setAssignRoleId(e.target.value)}
                className="!py-1 !text-[11px] min-w-[10rem]"
              >
                <option value="">Select role…</option>
                {roles.map((r) => (
                  <option key={r._id} value={r._id}>{r.code} — {r.name}</option>
                ))}
              </ErpSelect>
            </label>
            <label className="text-[10px]">
              <span className="mb-0.5 block text-erp-text-muted">Expires (optional)</span>
              <ErpInput type="datetime-local" value={assignExpiresAt} onChange={(e) => setAssignExpiresAt(e.target.value)} className="!py-1 !text-[11px]" />
            </label>
            <ErpButton
              className="!px-2 !py-1 text-[10px]"
              disabled={!assignRoleId || !assignFactoryId || assignRole.isPending}
              onClick={() => assignRole.mutate()}
            >
              Assign role
            </ErpButton>
          </div>
        </div>
      )}

      <SectionTitle><ArrowRightLeft size={10} /> Delegation access</SectionTitle>
      {!factoryId ? (
        <p className="mb-3 text-erp-text-muted">
          Select a factory from the header switcher to view delegations for this user.
        </p>
      ) : (
        <div className="mb-3">
          <UserDelegationsList
            userId={user._id}
            delegations={userDelegations}
            isLoading={delegationsLoading}
            canUpdate={canUpdate}
            onError={onError}
            onSuccess={onSuccess}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete user"
        message={`Permanently remove ${user.email}? All role assignments and sessions will be revoked.`}
        confirmLabel="Delete user"
        danger
        loading={deleteUser.isPending}
        onConfirm={() => deleteUser.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
      <PromptDialog
        open={resetPwdOpen}
        title="Reset password"
        message="Set a temporary password. The user will be required to change it on next login."
        label="New password"
        type="password"
        minLength={8}
        confirmLabel="Reset"
        loading={resetPassword.isPending}
        onConfirm={(pwd) => resetPassword.mutate(pwd)}
        onCancel={() => setResetPwdOpen(false)}
      />
    </div>
  );
}

function RoleDetailPanel({
  role,
  canConfigure,
  onDeleted,
  onError,
  onSuccess,
}: {
  role: ErpRole;
  canConfigure: boolean;
  onDeleted: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [editPerms, setEditPerms] = useState(role.permissions ?? []);
  const [editName, setEditName] = useState(role.name);
  const [dirty, setDirty] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: catalog = [] } = useQuery({
    queryKey: ['permission-catalog'],
    queryFn: usersApi.listPermissions,
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['role-members', role._id],
    queryFn: () => usersApi.listRoleMembers(role._id),
  });

  const savePerms = useMutation({
    mutationFn: () => {
      const body: { name?: string; permissions?: string[] } = {};
      if (nameDirty) body.name = editName;
      if (dirty) body.permissions = editPerms;
      return usersApi.updateRole(role._id, body);
    },
    onSuccess: () => {
      setDirty(false);
      setNameDirty(false);
      qc.invalidateQueries({ queryKey: ['roles'] });
      onSuccess('Role updated');
    },
    onError: (e: Error) => onError(e.message),
  });

  const deleteRole = useMutation({
    mutationFn: () => usersApi.deleteRole(role._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      setConfirmDelete(false);
      onDeleted();
      onSuccess('Role deleted');
    },
    onError: (e: Error) => onError(e.message),
  });

  const readOnly = role.isSystem || !canConfigure;
  const hasChanges = dirty || nameDirty;

  return (
    <div className="border-t border-[var(--erp-border)] bg-[var(--erp-surface-muted)] px-3 py-3 text-[11px] leading-snug">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] text-erp-text-muted">{role.code}</p>
          {readOnly ? (
            <p className="text-sm font-medium">{role.name}</p>
          ) : (
            <ErpInput
              value={editName}
              onChange={(e) => { setEditName(e.target.value); setNameDirty(e.target.value !== role.name); }}
              className="!mt-0.5 !py-1 !text-[12px] font-medium w-full max-w-xs"
            />
          )}
          <p className="mt-1 text-[10px] text-erp-text-muted">
            {role.isSystem ? 'System role — permissions are read-only' : 'Custom role — editable'}
          </p>
        </div>
        <div className="flex gap-1">
          {!readOnly && hasChanges && (
            <ErpButton className="!px-2 !py-1 text-[10px]" disabled={savePerms.isPending} onClick={() => savePerms.mutate()}>
              Save changes
            </ErpButton>
          )}
          {!role.isSystem && canConfigure && (
            <ErpButton variant="secondary" className="!inline-flex !items-center !gap-1 !px-2 !py-1 text-[10px] text-red-600" disabled={deleteRole.isPending} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={10} /> Delete
            </ErpButton>
          )}
        </div>
      </div>

      <SectionTitle>Users with this role ({members.length})</SectionTitle>
      {isLoading ? (
        <p className="mb-2 text-erp-text-muted">Loading members…</p>
      ) : members.length === 0 ? (
        <p className="mb-2 text-erp-text-muted">No users assigned yet. Assign from the Users tab.</p>
      ) : (
        <ul className="mb-3 max-h-28 space-y-1 overflow-y-auto">
          {members.map((m) => {
            const u = typeof m.userId === 'string' ? null : m.userId;
            if (!u) return null;
            return (
              <li key={m._id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] px-2.5 py-1.5">
                <UserAvatar user={u} />
                <span>{userDisplayName(u)}</span>
                <span className="text-[10px] text-erp-text-muted">{u.email}</span>
                <span className="text-erp-text-muted">@ {factoryLabel(m.factoryId)}</span>
                <ErpStatusBadge status={u.status} />
              </li>
            );
          })}
        </ul>
      )}

      <SectionTitle>Module permissions</SectionTitle>
      <PermissionMatrix
        catalog={catalog}
        selected={readOnly ? (role.permissions ?? []) : editPerms}
        readOnly={readOnly}
        searchable={!readOnly}
        onChange={(perms) => { setEditPerms(perms); setDirty(true); }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete role"
        message={`Remove role ${role.code}? All assignments must be revoked first.`}
        confirmLabel="Delete role"
        danger
        loading={deleteRole.isPending}
        onConfirm={() => deleteRole.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function CreateUserForm({
  organizationId,
  onSuccess,
  onError,
}: {
  organizationId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', phone: '',
  });

  const create = useMutation({
    mutationFn: () => usersApi.create({ ...form, organizationId }),
    onSuccess: () => {
      setForm({ email: '', password: '', firstName: '', lastName: '', phone: '' });
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      onSuccess();
    },
    onError: (e: Error) => onError(e.message),
  });

  return (
    <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
      {(['firstName', 'lastName', 'email', 'password', 'phone'] as const).map((field) => (
        <label key={field} className="text-[10px]">
          <span className="mb-0.5 block capitalize text-erp-text-muted">
            {field === 'password' ? 'Password' : field.replace(/([A-Z])/, ' $1')}
          </span>
          <ErpInput
            type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
            value={form[field]}
            onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
            className="!py-1 !text-[11px] w-full"
            required={field !== 'phone'}
          />
        </label>
      ))}
      <div className="flex items-end">
        <ErpButton
          className="!px-2 !py-1 text-[11px] w-full"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          Create user
        </ErpButton>
      </div>
    </div>
  );
}

function CreateRoleForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);

  const { data: catalog = [] } = useQuery({
    queryKey: ['permission-catalog'],
    queryFn: usersApi.listPermissions,
  });

  const create = useMutation({
    mutationFn: () => usersApi.createRole({ code: code.trim().toUpperCase(), name, permissions }),
    onSuccess: () => {
      setCode('');
      setName('');
      setPermissions([]);
      qc.invalidateQueries({ queryKey: ['roles'] });
      onSuccess();
    },
    onError: (e: Error) => onError(e.message),
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <label className="text-[10px]">
          <span className="mb-0.5 block text-erp-text-muted">Code</span>
          <ErpInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="CUSTOM_ROLE" className="!py-1 !text-[11px] font-mono" />
        </label>
        <label className="text-[10px] flex-1 min-w-[8rem]">
          <span className="mb-0.5 block text-erp-text-muted">Name</span>
          <ErpInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" className="!py-1 !text-[11px] w-full" />
        </label>
        <div className="flex items-end">
          <ErpButton className="!px-2 !py-1 text-[11px]" disabled={!code || !name || create.isPending} onClick={() => create.mutate()}>
            Create role
          </ErpButton>
        </div>
      </div>
      <PermissionMatrix catalog={catalog} selected={permissions} onChange={setPermissions} />
    </div>
  );
}

export function UsersPage() {
  const { user, factories, permissions, factoryId } = useAuth();
  const canUpdate = permissions.includes('*') || permissions.includes('user.update');
  const canCreate = permissions.includes('*') || permissions.includes('user.create');
  const canDelete = permissions.includes('*') || permissions.includes('user.delete');
  const canCreateRole = permissions.includes('*') || permissions.includes('role.create');
  const canConfigureRole = permissions.includes('*') || permissions.includes('role.configure');

  const [view, setView] = useState<View>('users');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rbacInfoCollapsed, setRbacInfoCollapsed] = useState(false);
  const [roleTypeFilter, setRoleTypeFilter] = useState<RoleFilter>('all');

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const userFilters = { page, limit: PAGE_SIZE, status: statusFilter || undefined, search: search || undefined };

  const { data: userData, isLoading: usersLoading, isFetching, refetch } = useQuery({
    queryKey: ['users-page', userFilters],
    queryFn: () => usersApi.listPage(userFilters),
    enabled: view === 'users',
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: usersApi.listRoles,
  });

  const { data: allUsersData } = useQuery({
    queryKey: ['users', 'all-for-delegations'],
    queryFn: () => usersApi.list({ limit: 200 }),
    enabled: view === 'delegations',
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ['delegations', factoryId],
    queryFn: usersApi.listDelegations,
    enabled: !!factoryId,
  });

  const users = userData?.items ?? [];
  const meta = userData?.meta;

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    return roles.filter((r) => {
      if (roleTypeFilter === 'system' && !r.isSystem) return false;
      if (roleTypeFilter === 'custom' && r.isSystem) return false;
      if (!q) return true;
      return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    });
  }, [roles, roleSearch, roleTypeFilter]);

  const summary = useMemo(() => {
    const active = users.filter((u) => u.status === 'ACTIVE').length;
    const inactive = users.filter((u) => u.status === 'INACTIVE').length;
    const locked = users.filter((u) => u.status === 'LOCKED').length;
    return { active, inactive, locked };
  }, [users]);

  const applySearch = () => {
    setSearch(searchDraft.trim());
    setPage(1);
    setExpandedUserId(null);
  };

  return (
    <div className="users-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px] [&_.erp-page-subtitle]:mt-0">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />
      <RbacInfoCard collapsed={rbacInfoCollapsed} onToggle={() => setRbacInfoCollapsed((v) => !v)} />
      <ErpPageHeader
        title="Users & Roles"
        subtitle="Users get roles per factory. Roles define module permissions — one role, many users."
        actions={(
          <>
            {view === 'users' && canCreate && user?.organizationId && (
              <ErpButton
                className="!px-2 !py-1 text-[11px] inline-flex items-center gap-1"
                onClick={() => setShowCreateUser((v) => !v)}
              >
                <UserPlus size={12} />
                New user
              </ErpButton>
            )}
            {view === 'roles' && canCreateRole && (
              <ErpButton
                className="!px-2 !py-1 text-[11px]"
                onClick={() => setShowCreateRole((v) => !v)}
              >
                New role
              </ErpButton>
            )}
            <ErpButton
              variant="secondary"
              onClick={() => refetch()}
              disabled={isFetching}
              className="!px-2 !py-1 text-[11px] inline-flex items-center gap-1"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </ErpButton>
          </>
        )}
      />

      <div className="mb-3">
        <ErpTabs
          tabs={[
            { id: 'users', label: `Users (${meta?.total ?? users.length})` },
            { id: 'roles', label: `Roles (${roles.length})` },
            { id: 'delegations', label: factoryId ? `Delegations (${delegations.length})` : 'Delegations' },
          ]}
          active={view}
          onChange={(id) => setView(id as View)}
        />
      </div>

      {view === 'users' && (
        <>
          {showCreateUser && user?.organizationId && (
            <ErpCard className="mb-3 !p-2.5">
              <h3 className="mb-2 text-[11px] font-medium">Create user</h3>
              <CreateUserForm
                organizationId={user.organizationId}
                onSuccess={() => setShowCreateUser(false)}
                onError={setError}
              />
            </ErpCard>
          )}

          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <ErpCard className="!p-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Total users</p>
              <p className="mt-0.5 text-lg font-semibold leading-tight">{meta?.total ?? '—'}</p>
            </ErpCard>
            <ErpCard className="!p-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Active (page)</p>
              <p className="mt-0.5 text-lg font-semibold leading-tight text-emerald-600">{summary.active}</p>
            </ErpCard>
            <ErpCard className="!p-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Inactive (page)</p>
              <p className="mt-0.5 text-lg font-semibold leading-tight text-erp-text-muted">{summary.inactive}</p>
            </ErpCard>
            <ErpCard className="!p-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-erp-text-muted">Locked (page)</p>
              <p className="mt-0.5 text-lg font-semibold leading-tight text-amber-600">{summary.locked}</p>
            </ErpCard>
          </div>

          <ErpCard className="mb-3 !p-2.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-erp-text-secondary">
              <Search size={12} />
              Find users
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpInput
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Name, email, employee ID…"
                className="!py-1 !text-[11px] min-w-[12rem] flex-1"
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              />
              <ErpSelect
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setExpandedUserId(null); }}
                className="!py-1 !text-[11px]"
              >
                {USER_STATUSES.map((s) => (
                  <option key={s || 'all'} value={s}>{s || 'All statuses'}</option>
                ))}
              </ErpSelect>
              <ErpButton onClick={applySearch} className="!px-2 !py-1 text-[11px]">Search</ErpButton>
              {(search || statusFilter) && (
                <ErpButton
                  variant="secondary"
                  className="!px-2 !py-1 text-[11px]"
                  onClick={() => {
                    setSearch('');
                    setSearchDraft('');
                    setStatusFilter('');
                    setPage(1);
                    setExpandedUserId(null);
                  }}
                >
                  Clear
                </ErpButton>
              )}
            </div>
          </ErpCard>

          {usersLoading ? (
            <p className="text-[11px] text-erp-text-muted">Loading users…</p>
          ) : (
            <ErpCard className="overflow-hidden !p-0">
              <div className="overflow-x-auto">
                <ErpDataTable className="text-[11px]">
                  <thead>
                    <tr>
                      <th className="w-6 px-1 py-1.5" />
                      <th className="px-2 py-1.5 font-medium">Name</th>
                      <th className="px-2 py-1.5 font-medium">Email</th>
                      <th className="px-2 py-1.5 font-medium">Role</th>
                      <th className="px-2 py-1.5 font-medium">Status</th>
                      <th className="hidden px-2 py-1.5 font-medium md:table-cell">Last login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const expanded = expandedUserId === u._id;
                      return (
                        <Fragment key={u._id}>
                          <tr
                            className="cursor-pointer border-b border-[var(--erp-border)] hover:bg-[var(--erp-surface-muted)]"
                            onClick={() => setExpandedUserId(expanded ? null : u._id)}
                          >
                            <td className="px-1 py-1 text-erp-text-muted">
                              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </td>
                            <td className="px-2 py-1.5 font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                <UserAvatar user={u} />
                                {userDisplayName(u)}
                              </span>
                              {u.isSuperAdmin && (
                                <span className="ml-1 rounded bg-violet-500/15 px-1 text-[10px] text-violet-600">SA</span>
                              )}
                            </td>
                            <td className="max-w-[10rem] truncate px-2 py-1 text-erp-text-muted" title={u.email}>
                              {u.email}
                            </td>
                            <td className="max-w-[12rem] truncate px-2 py-1 text-erp-text-secondary" title={userRolesLabel(u)}>
                              {userRolesLabel(u)}
                            </td>
                            <td className="px-2 py-1">
                              <ErpStatusBadge status={u.status} />
                            </td>
                            <td className="hidden whitespace-nowrap px-2 py-1 text-[10px] text-erp-text-muted md:table-cell">
                              {formatLastLogin(u.lastLoginAt)}
                            </td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={6} className="p-0">
                                <UserDetailPanel
                                  user={u}
                                  canUpdate={canUpdate}
                                  canDelete={canDelete}
                                  factories={factories}
                                  roles={roles}
                                  organizationId={user?.organizationId}
                                  factoryId={factoryId}
                                  onDeleted={() => setExpandedUserId(null)}
                                  onError={setError}
                                  onSuccess={showSuccess}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-6 text-center text-[11px] text-erp-text-muted">
                          <UserPlus size={20} className="mx-auto mb-1 opacity-40" />
                          No users match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </ErpDataTable>
              </div>
              {meta && meta.totalPages > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--erp-border)] px-2 py-1.5 text-[11px]">
                  <p className="text-erp-text-muted">{meta.page}/{meta.totalPages} · {meta.total} total</p>
                  <div className="flex gap-1">
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[11px]" disabled={page <= 1} onClick={() => { setPage((p) => p - 1); setExpandedUserId(null); }}>Prev</ErpButton>
                    <ErpButton variant="secondary" className="!px-2 !py-1 text-[11px]" disabled={page >= meta.totalPages} onClick={() => { setPage((p) => p + 1); setExpandedUserId(null); }}>Next</ErpButton>
                  </div>
                </div>
              )}
            </ErpCard>
          )}
        </>
      )}

      {view === 'roles' && (
        <>
          {showCreateRole && (
            <ErpCard className="mb-3 !p-2.5">
              <h3 className="mb-2 text-[11px] font-medium">Create custom role</h3>
              <CreateRoleForm onSuccess={() => setShowCreateRole(false)} onError={setError} />
            </ErpCard>
          )}

          <ErpCard className="mb-3 !p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Search size={12} className="text-erp-text-muted" />
              <ErpInput
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Filter roles by code or name…"
                className="!py-1 !text-[11px] min-w-[12rem] flex-1"
              />
              <div className="flex rounded border border-[var(--erp-border)] p-0.5 text-[10px]">
                {(['all', 'system', 'custom'] as RoleFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRoleTypeFilter(f)}
                    className={`rounded px-2 py-0.5 capitalize ${roleTypeFilter === f ? 'bg-[var(--erp-accent)]/15 font-medium text-[var(--erp-accent)]' : 'text-erp-text-muted hover:text-erp-text-secondary'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </ErpCard>

          {rolesLoading ? (
            <p className="text-[11px] text-erp-text-muted">Loading roles…</p>
          ) : (
            <ErpCard className="overflow-hidden !p-0">
              <div className="overflow-x-auto">
                <ErpDataTable className="text-[11px]">
                  <thead>
                    <tr>
                      <th className="w-6 px-1 py-1.5" />
                      <th className="px-2 py-1.5 font-medium">Code</th>
                      <th className="px-2 py-1.5 font-medium">Name</th>
                      <th className="px-2 py-1.5 font-medium">Perms</th>
                      <th className="px-2 py-1.5 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoles.map((r) => {
                      const expanded = expandedRoleId === r._id;
                      return (
                        <Fragment key={r._id}>
                          <tr
                            className="cursor-pointer border-b border-[var(--erp-border)] hover:bg-[var(--erp-surface-muted)]"
                            onClick={() => setExpandedRoleId(expanded ? null : r._id)}
                          >
                            <td className="px-1 py-1 text-erp-text-muted">
                              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </td>
                            <td className="px-2 py-1 font-mono text-[10px]">{r.code}</td>
                            <td className="px-2 py-1">{r.name}</td>
                            <td className="px-2 py-1 text-erp-text-muted">{r.permissions?.length ?? 0}</td>
                            <td className="px-2 py-1">
                              {r.isSystem ? (
                                <span className="rounded bg-sky-500/10 px-1 text-[10px] text-sky-600">System</span>
                              ) : (
                                <span className="text-[10px] text-erp-text-muted">Custom</span>
                              )}
                            </td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={5} className="p-0">
                                <RoleDetailPanel
                                  role={r}
                                  canConfigure={canConfigureRole}
                                  onDeleted={() => setExpandedRoleId(null)}
                                  onError={setError}
                                  onSuccess={showSuccess}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {filteredRoles.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-2 py-6 text-center text-[11px] text-erp-text-muted">No roles found.</td>
                      </tr>
                    )}
                  </tbody>
                </ErpDataTable>
              </div>
            </ErpCard>
          )}
        </>
      )}

      {view === 'delegations' && (
        <DelegationsTab
          factoryId={factoryId}
          users={allUsersData ?? []}
          canUpdate={canUpdate}
          onError={setError}
          onSuccess={showSuccess}
        />
      )}
    </div>
  );
}
