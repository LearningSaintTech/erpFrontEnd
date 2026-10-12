import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Shield, UserPlus, Users } from 'lucide-react';
import { usersApi } from '../../services/admin';
import { useAuth } from '../../app/providers/AuthProvider';
import type { ErpRole } from '../../types/api';
import {
  Badge, Button, EmptyRow, ErpDataTable, ErpSelect, FilterBar, InfoBanner, PageHeader,
  RowActionsMenu, SearchInput, Section, StatusBadge, TablePager, TableSkeleton, Tabs,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';
import { formatLastLogin, userDisplayName, userRolesLabel } from './userUtils';
import { DelegationsTab } from './DelegationsTab';
import { UserAvatar } from './UserAvatar';
import { useDebouncedValue } from './useDebouncedValue';
import { useUserActions } from './useUserActions';
import { UserFormDrawer } from './components/UserFormDrawer';
import { UserDetailDrawer } from './components/UserDetailDrawer';
import { RoleDrawer, RoleFormDrawer } from './components/RoleDrawers';

const PAGE_SIZE = 20;
const USER_STATUSES = [
  { id: '', label: 'All statuses' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'INACTIVE', label: 'Inactive' },
  { id: 'LOCKED', label: 'Locked' },
];

type View = 'users' | 'roles' | 'delegations';
type RoleFilter = 'all' | 'system' | 'custom';

function parseView(v: string | null): View {
  return v === 'roles' || v === 'delegations' ? v : 'users';
}

export function UsersPage() {
  const { user, factories: allFactories, permissions, factoryId } = useAuth();
  // A super admin has no organization of their own: manage the selected factory's organization,
  // and only offer that organization's factories when assigning roles.
  const orgId = user?.organizationId || allFactories.find((f) => f._id === factoryId)?.organizationId;
  const factories = useMemo(
    () => allFactories.filter((f) => !f.organizationId || !orgId || f.organizationId === orgId),
    [allFactories, orgId],
  );
  const canUpdate = permissions.includes('*') || permissions.includes('user.update');
  const canCreate = permissions.includes('*') || permissions.includes('user.create');
  const canDelete = permissions.includes('*') || permissions.includes('user.delete');
  const canCreateRole = permissions.includes('*') || permissions.includes('role.create');
  const canConfigureRole = permissions.includes('*') || permissions.includes('role.configure');

  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<View>(parseView(searchParams.get('tab')));
  useEffect(() => { setView(parseView(searchParams.get('tab'))); }, [searchParams]);
  const selectView = (v: View) => {
    setView(v);
    setSearchParams(v === 'users' ? {} : { tab: v }, { replace: true });
  };

  // Users list state
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  // Roles state
  const [roleSearch, setRoleSearch] = useState('');
  const [roleTypeFilter, setRoleTypeFilter] = useState<RoleFilter>('all');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState<{ open: boolean; template: ErpRole | null }>({ open: false, template: null });

  // Delegations state
  const [creatingDelegation, setCreatingDelegation] = useState(false);

  const userFilters = { page, limit: PAGE_SIZE, status: statusFilter || undefined, search: search || undefined };

  const usersQuery = useQuery({
    queryKey: ['users-page', userFilters],
    queryFn: () => usersApi.listPage(userFilters),
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

  const users = usersQuery.data?.items ?? [];
  const meta = usersQuery.data?.meta;
  const selectedUser = users.find((u) => u._id === selectedUserId) ?? null;
  const selectedRole = roles.find((r) => r._id === selectedRoleId) ?? null;
  const hasUserFilters = !!(search || statusFilter);
  const clearUserFilters = () => { setSearchInput(''); setStatusFilter(''); setPage(1); };

  const actions = useUserActions({ canUpdate, canDelete, onDeleted: (id) => { if (id === selectedUserId) setSelectedUserId(null); } });

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    return roles.filter((r) => {
      if (roleTypeFilter === 'system' && !r.isSystem) return false;
      if (roleTypeFilter === 'custom' && r.isSystem) return false;
      if (!q) return true;
      return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    });
  }, [roles, roleSearch, roleTypeFilter]);

  const primaryAction = view === 'users' && canCreate && orgId ? (
    <Button size="sm" icon={<UserPlus size={16} />} onClick={() => setCreatingUser(true)}>New user</Button>
  ) : view === 'roles' && canCreateRole ? (
    <Button size="sm" icon={<Plus size={16} />} onClick={() => setRoleForm({ open: true, template: null })}>New role</Button>
  ) : view === 'delegations' && canUpdate && factoryId ? (
    <Button size="sm" icon={<Plus size={16} />} onClick={() => setCreatingDelegation(true)}>New delegation</Button>
  ) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users & roles"
        description="Invite people, give them roles per factory, and control what each role can do."
        primaryAction={primaryAction}
      />

      <InfoBanner inset={false} tone="info" title="How access works" dismissKey="users-rbac-how-it-works">
        A role is a set of permissions (for example Designer). People get one or more roles at each factory.
        System roles are fixed; create custom roles when you need a different mix. Delegations lend permissions temporarily.
      </InfoBanner>

      <Tabs
        tabs={[
          { id: 'users', label: 'Users', count: meta?.total ?? null },
          { id: 'roles', label: 'Roles', count: rolesLoading ? null : roles.length },
          { id: 'delegations', label: 'Delegations', count: factoryId ? delegations.length : null },
        ]}
        active={view}
        onChange={(id) => selectView(id as View)}
        ariaLabel="Users and roles"
      />

      {view === 'users' && (
        <Section flush>
          <FilterBar
            search={(
              <SearchInput
                value={searchInput}
                onChange={(v) => { setSearchInput(v); setPage(1); }}
                placeholder="Search name, email or employee ID…"
                inputSize="sm"
              />
            )}
            filters={(
              <ErpSelect
                inputSize="sm"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                aria-label="Status"
              >
                {USER_STATUSES.map((s) => <option key={s.id || 'all'} value={s.id}>{s.label}</option>)}
              </ErpSelect>
            )}
            onClear={hasUserFilters ? clearUserFilters : undefined}
          />
          <QueryState isError={usersQuery.isError} error={usersQuery.error} onRetry={usersQuery.refetch}>
            <ErpDataTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roles (this factory)</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Last sign-in</th>
                  <th className="erp-cell-actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.isLoading ? (
                  <TableSkeleton asRows rows={6} columns={5} />
                ) : users.length === 0 ? (
                  <EmptyRow
                    colSpan={5}
                    icon={Users}
                    title={hasUserFilters ? 'No users match these filters' : 'No users yet'}
                    action={hasUserFilters
                      ? <Button size="sm" variant="secondary" onClick={clearUserFilters}>Clear filters</Button>
                      : canCreate && orgId ? <Button size="sm" onClick={() => setCreatingUser(true)}>New user</Button> : undefined}
                  >
                    {hasUserFilters ? undefined : 'Add the people who work in your factories.'}
                  </EmptyRow>
                ) : users.map((u) => {
                  const roleText = userRolesLabel(u);
                  return (
                    <tr
                      key={u._id}
                      className={`erp-row-clickable${selectedUserId === u._id ? ' erp-row-selected' : ''}`}
                      onClick={() => setSelectedUserId(u._id)}
                    >
                      <td>
                        <span className="flex items-center gap-2.5">
                          <UserAvatar user={u} size="md" />
                          <span className="min-w-0">
                            <span className="erp-cell-primary flex items-center gap-1.5">
                              <span className="truncate">{userDisplayName(u)}</span>
                              {u.isSuperAdmin && <Badge tone="info" dot={false}>Super admin</Badge>}
                            </span>
                            <span className="block max-w-[16rem] truncate text-xs text-erp-text-muted">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="max-w-[14rem]">
                        {roleText === '—'
                          ? <span className="text-erp-text-muted">No role</span>
                          : <span className="block truncate" title={roleText}>{roleText}</span>}
                      </td>
                      <td><StatusBadge status={u.status || 'ACTIVE'} /></td>
                      <td className="hidden whitespace-nowrap text-erp-text-muted md:table-cell">{formatLastLogin(u.lastLoginAt)}</td>
                      <td className="erp-cell-actions">
                        <RowActionsMenu label={`Actions for ${userDisplayName(u)}`} items={actions.menuItems(u)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ErpDataTable>
            {meta && (
              <TablePager
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                pageSize={PAGE_SIZE}
                itemLabel="users"
                onPrev={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
              />
            )}
          </QueryState>
        </Section>
      )}

      {view === 'roles' && (
        <Section flush>
          <FilterBar
            search={<SearchInput value={roleSearch} onChange={setRoleSearch} placeholder="Search roles…" inputSize="sm" />}
            filters={(
              <ErpSelect inputSize="sm" value={roleTypeFilter} onChange={(e) => setRoleTypeFilter(e.target.value as RoleFilter)} aria-label="Role type">
                <option value="all">All roles</option>
                <option value="system">System roles</option>
                <option value="custom">Custom roles</option>
              </ErpSelect>
            )}
            onClear={roleSearch || roleTypeFilter !== 'all' ? () => { setRoleSearch(''); setRoleTypeFilter('all'); } : undefined}
          />
          <ErpDataTable>
            <thead>
              <tr>
                <th>Role</th>
                <th>Code</th>
                <th className="erp-num">Permissions</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {rolesLoading ? (
                <TableSkeleton asRows rows={6} columns={4} />
              ) : filteredRoles.length === 0 ? (
                <EmptyRow colSpan={4} icon={Shield} title="No roles match">Try a different search or role type.</EmptyRow>
              ) : filteredRoles.map((r) => (
                <tr
                  key={r._id}
                  className={`erp-row-clickable${selectedRoleId === r._id ? ' erp-row-selected' : ''}`}
                  onClick={() => setSelectedRoleId(r._id)}
                >
                  <td className="erp-cell-primary">{r.name}</td>
                  <td className="font-mono text-erp-text-secondary">{r.code}</td>
                  <td className="erp-num">{r.permissions?.includes('*') ? 'All' : (r.permissions?.length ?? 0)}</td>
                  <td><Badge tone={r.isSystem ? 'info' : 'neutral'} dot={false}>{r.isSystem ? 'System' : 'Custom'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        </Section>
      )}

      {view === 'delegations' && (
        <DelegationsTab
          factoryId={factoryId}
          users={allUsersData ?? []}
          canUpdate={canUpdate}
          createOpen={creatingDelegation}
          onCreateOpenChange={setCreatingDelegation}
        />
      )}

      {orgId && canCreate && (
        <UserFormDrawer
          open={creatingUser}
          onClose={() => setCreatingUser(false)}
          organizationId={orgId}
          factories={factories}
          roles={roles}
          defaultFactoryId={factoryId}
          canAssign={canUpdate}
          onCreated={(id) => setSelectedUserId(id)}
        />
      )}
      <UserDetailDrawer
        user={selectedUser}
        onClose={() => setSelectedUserId(null)}
        canUpdate={canUpdate}
        canDelete={canDelete}
        factories={factories}
        roles={roles}
        organizationId={orgId}
        factoryId={factoryId}
      />
      <RoleDrawer
        role={selectedRole}
        onClose={() => setSelectedRoleId(null)}
        canConfigure={canConfigureRole}
        canCreate={canCreateRole}
        onDuplicate={(r) => { setSelectedRoleId(null); setRoleForm({ open: true, template: r }); }}
      />
      {canCreateRole && (
        <RoleFormDrawer
          open={roleForm.open}
          template={roleForm.template}
          onClose={() => setRoleForm({ open: false, template: null })}
        />
      )}
    </div>
  );
}
