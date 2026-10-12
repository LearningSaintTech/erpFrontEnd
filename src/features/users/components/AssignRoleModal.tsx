import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../../services/admin';
import type { ErpRole, ErpUser } from '../../../types/api';
import {
  Button, ErpInput, ErpSelect, Field, Modal,
} from '../../../components/erp';
import { userDisplayName } from '../userUtils';

export function AssignRoleModal({
  user, open, onClose, factories, roles, organizationId, defaultFactoryId,
}: {
  user: ErpUser;
  open: boolean;
  onClose: () => void;
  factories: { _id: string; code: string; name: string }[];
  roles: ErpRole[];
  organizationId: string;
  defaultFactoryId?: string | null;
}) {
  const qc = useQueryClient();
  const [factoryId, setFactoryId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setFactoryId(defaultFactoryId || factories[0]?._id || '');
      setRoleId('');
      setExpiresAt('');
      setError('');
    }
  }, [open, defaultFactoryId, factories]);

  const assign = useMutation({
    mutationFn: () => usersApi.assignRole(user._id, {
      roleId,
      factoryId,
      organizationId,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    }),
    meta: { successMessage: 'Role assigned' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-assignments', user._id] });
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['role-members'] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!roleId) { setError('Choose a role to assign.'); return; }
    setError('');
    assign.mutate();
  };

  const selectedRole = roles.find((r) => r._id === roleId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign a role to ${userDisplayName(user)}`}
      description="The role applies only at the factory you choose."
      size="sm"
      closeOnOverlayClick={false}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="assign-role-form" loading={assign.isPending}>Assign role</Button>
        </>
      )}
    >
      <form id="assign-role-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Factory" required>
          <ErpSelect value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
            {factories.map((f) => <option key={f._id} value={f._id}>{f.code} — {f.name}</option>)}
          </ErpSelect>
        </Field>
        <Field
          label="Role"
          required
          error={error}
          hint={selectedRole ? `${selectedRole.permissions?.length ?? 0} permissions${selectedRole.isSystem ? ' · system role' : ''}` : undefined}
        >
          <ErpSelect value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">Select a role…</option>
            {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
          </ErpSelect>
        </Field>
        <Field label="Expires" hint="Leave empty for a permanent assignment.">
          <ErpInput type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
