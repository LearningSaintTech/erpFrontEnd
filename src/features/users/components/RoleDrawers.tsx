import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, MoreHorizontal, Trash2, Users } from 'lucide-react';
import { usersApi } from '../../../services/admin';
import type { ErpRole } from '../../../types/api';
import {
  Badge, Button, Drawer, DropdownMenu, EmptyState, ErpInput, Field, InfoBanner, Skeleton,
  StatusBadge, Tabs, useConfirm,
} from '../../../components/erp';
import { PermissionMatrix } from '../PermissionMatrix';
import { UserAvatar } from '../UserAvatar';
import { factoryLabel, userDisplayName } from '../userUtils';

/** View / edit one role: name, permission matrix, and who has it. */
export function RoleDrawer({
  role, onClose, canConfigure, canCreate, onDuplicate,
}: {
  role: ErpRole | null;
  onClose: () => void;
  canConfigure: boolean;
  canCreate: boolean;
  onDuplicate: (role: ErpRole) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [view, setView] = useState<'permissions' | 'members'>('permissions');
  const [name, setName] = useState('');
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    if (role) {
      setName(role.name);
      setPerms(role.permissions ?? []);
      setView('permissions');
    }
  }, [role?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: catalog = [] } = useQuery({
    queryKey: ['permission-catalog'],
    queryFn: usersApi.listPermissions,
    enabled: !!role,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['role-members', role?._id],
    queryFn: () => usersApi.listRoleMembers(role!._id),
    enabled: !!role,
  });

  const readOnly = !role || role.isSystem || !canConfigure;
  const original = role?.permissions ?? [];
  const permsDirty = !!role && (perms.length !== original.length || perms.some((p) => !original.includes(p)));
  const nameDirty = !!role && name.trim() !== role.name;
  const dirty = !readOnly && (permsDirty || nameDirty);

  const save = useMutation({
    mutationFn: () => {
      const body: { name?: string; permissions?: string[] } = {};
      if (nameDirty) body.name = name.trim();
      if (permsDirty) body.permissions = perms;
      return usersApi.updateRole(role!._id, body);
    },
    meta: { successMessage: 'Role saved', successDescription: 'People with this role get the new permissions at their next request.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => usersApi.deleteRole(role!._id),
    meta: { successMessage: 'Role deleted' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
  });

  const requestClose = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard changes?',
        message: 'Your edits to this role have not been saved.',
        confirmLabel: 'Discard',
        tone: 'danger',
      });
      if (!ok) return;
    }
    onClose();
  };

  const askDelete = async () => {
    if (!role) return;
    const ok = await confirm({
      title: `Delete ${role.name}?`,
      message: members.length > 0
        ? `${members.length} ${members.length === 1 ? 'person still has' : 'people still have'} this role. Remove it from them first, then delete.`
        : 'This custom role is removed permanently.',
      confirmLabel: 'Delete role',
      tone: 'danger',
    });
    if (ok) remove.mutate();
  };

  const footer = role ? (
    <>
      {(canCreate || (!role.isSystem && canConfigure)) && (
        <DropdownMenu
          label="Role actions"
          align="end"
          trigger={<Button variant="secondary" icon={<MoreHorizontal size={16} />} className="mr-auto">More</Button>}
          items={[
            { label: 'Duplicate as new role', icon: Copy, hidden: !canCreate, onSelect: () => onDuplicate({ ...role, permissions: perms }) },
            { type: 'separator' },
            { label: 'Delete role', icon: Trash2, danger: true, hidden: role.isSystem || !canConfigure, onSelect: askDelete },
          ]}
        />
      )}
      {readOnly ? (
        <Button variant="secondary" onClick={onClose}>Close</Button>
      ) : (
        <>
          <Button variant="secondary" onClick={requestClose}>Cancel</Button>
          <Button disabled={!dirty || !name.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            {dirty ? 'Save changes' : 'No changes'}
          </Button>
        </>
      )}
    </>
  ) : undefined;

  return (
    <Drawer
      open={!!role}
      onClose={requestClose}
      size="lg"
      title={role?.name ?? ''}
      description={role ? <span className="font-mono">{role.code}</span> : undefined}
      headerExtra={role ? <Badge tone={role.isSystem ? 'info' : 'neutral'} dot={false}>{role.isSystem ? 'System role' : 'Custom role'}</Badge> : undefined}
      footer={footer}
    >
      {role && (
        <div className="space-y-4">
          {role.isSystem && (
            <InfoBanner inset={false} tone="muted">
              System roles are maintained by the product and cannot be edited. Duplicate this role to make a custom version.
            </InfoBanner>
          )}
          {!readOnly && (
            <Field label="Role name" required error={!name.trim() ? 'Enter a role name.' : undefined}>
              <ErpInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
          {dirty && (
            <p className="text-[13px] font-medium text-[var(--erp-warning-text)]" role="status">Unsaved changes</p>
          )}

          <Tabs
            tabs={[
              { id: 'permissions', label: 'Permissions', count: perms.length },
              { id: 'members', label: 'People', count: membersLoading ? null : members.length },
            ]}
            active={view}
            onChange={(id) => setView(id as 'permissions' | 'members')}
            ariaLabel="Role details"
          />

          {view === 'permissions' ? (
            <PermissionMatrix catalog={catalog} selected={readOnly ? original : perms} readOnly={readOnly} onChange={setPerms} />
          ) : membersLoading ? (
            <div className="space-y-2"><Skeleton height={40} /><Skeleton height={40} /></div>
          ) : members.length === 0 ? (
            <EmptyState compact icon={Users} title="Nobody has this role yet" description="Assign it from a user's detail panel on the Users tab." />
          ) : (
            <ul className="divide-y divide-[var(--erp-border)] rounded-lg border border-[var(--erp-border)]">
              {members.map((m) => {
                const u = typeof m.userId === 'string' ? null : m.userId;
                if (!u) return null;
                return (
                  <li key={m._id} className="flex items-center gap-3 px-3 py-2.5">
                    <UserAvatar user={u} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-erp-text-primary">{userDisplayName(u)}</p>
                      <p className="truncate text-xs text-erp-text-muted">{u.email} · {factoryLabel(m.factoryId)}</p>
                    </div>
                    <StatusBadge status={u.status || 'ACTIVE'} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Drawer>
  );
}

/** Create a custom role, optionally pre-filled from an existing one ("Duplicate"). */
export function RoleFormDrawer({
  open, onClose, template,
}: { open: boolean; onClose: () => void; template?: ErpRole | null }) {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: catalog = [] } = useQuery({
    queryKey: ['permission-catalog'],
    queryFn: usersApi.listPermissions,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setCode(template ? `${template.code}_COPY` : '');
      setName(template ? `${template.name} (copy)` : '');
      setPermissions(template?.permissions ?? []);
      setErrors({});
    }
  }, [open, template]);

  const create = useMutation({
    mutationFn: () => usersApi.createRole({ code: code.trim().toUpperCase(), name: name.trim(), permissions }),
    meta: { successMessage: 'Role created', successDescription: 'Assign it to people from the Users tab.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[A-Za-z][A-Za-z0-9_]{1,39}$/.test(code.trim())) next.code = 'Use 2–40 letters, digits or underscores, starting with a letter (e.g. QC_LEAD).';
    if (!name.trim()) next.name = 'Enter a display name, e.g. "QC lead".';
    if (permissions.length === 0) next.permissions = 'Grant at least one permission.';
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      closeOnOverlayClick={false}
      title={template ? `Duplicate ${template.name}` : 'New role'}
      description="A role is a named set of permissions you can give to many people."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="role-form" loading={create.isPending}>Create role</Button>
        </>
      )}
    >
      <form id="role-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" required error={errors.name}>
            <ErpInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. QC lead" autoFocus />
          </Field>
          <Field label="Code" required hint="Short unique ID, saved in capitals." error={errors.code}>
            <ErpInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))} placeholder="QC_LEAD" className="font-mono" />
          </Field>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-erp-text-primary">Permissions</h3>
          {errors.permissions && <p className="mb-2 text-[13px] text-[var(--erp-danger-text)]" role="alert">{errors.permissions}</p>}
          <PermissionMatrix catalog={catalog} selected={permissions} onChange={setPermissions} />
        </div>
      </form>
    </Drawer>
  );
}
