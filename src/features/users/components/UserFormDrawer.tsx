import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../../services/admin';
import type { ErpRole } from '../../../types/api';
import {
  Button, Drawer, ErpInput, ErpSelect, Field, toast,
} from '../../../components/erp';

const EMPTY = { firstName: '', lastName: '', email: '', password: '', phone: '', factoryId: '', roleId: '' };

/** Create a user and (optionally) give them their first role in one step. */
export function UserFormDrawer({
  open, onClose, organizationId, factories, roles, defaultFactoryId, canAssign, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  factories: { _id: string; code: string; name: string }[];
  roles: ErpRole[];
  defaultFactoryId?: string | null;
  canAssign: boolean;
  onCreated?: (userId: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, factoryId: defaultFactoryId || factories[0]?._id || '' });
      setErrors({});
    }
  }, [open, defaultFactoryId, factories]);

  const create = useMutation({
    mutationFn: async () => {
      const created = await usersApi.create({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        organizationId,
      });
      let roleError: string | null = null;
      if (canAssign && form.roleId && form.factoryId && created?._id) {
        try {
          await usersApi.assignRole(created._id, { roleId: form.roleId, factoryId: form.factoryId, organizationId });
        } catch (e) {
          roleError = e instanceof Error ? e.message : 'Role could not be assigned';
        }
      }
      return { created, roleError };
    },
    onSuccess: ({ created, roleError }) => {
      qc.invalidateQueries({ queryKey: ['users-page'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['roles'] });
      if (roleError) {
        toast.warning('User created, but the role was not assigned', { description: roleError });
      } else {
        toast.success('User created', {
          description: form.roleId ? 'Their role is active — share the temporary password with them.' : 'Assign a role so they can start working.',
        });
      }
      onClose();
      if (created?._id) onCreated?.(created._id);
    },
  });

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = 'Enter a first name.';
    if (!form.lastName.trim()) next.lastName = 'Enter a last name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address, e.g. name@company.com.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters.';
    if (form.roleId && !form.factoryId) next.factoryId = 'Choose the factory this role applies to.';
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={false}
      title="New user"
      description="They sign in with this email and the temporary password you set."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" loading={create.isPending}>Create user</Button>
        </>
      )}
    >
      <form id="user-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName}>
            <ErpInput value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" autoFocus />
          </Field>
          <Field label="Last name" required error={errors.lastName}>
            <ErpInput value={form.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Work email" required error={errors.email} className="sm:col-span-2">
            <ErpInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Temporary password" required hint="At least 8 characters. Share it with them securely." error={errors.password}>
            <ErpInput type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Phone">
            <ErpInput type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
        </div>

        {canAssign && factories.length > 0 && (
          <fieldset className="space-y-3 rounded-lg border border-[var(--erp-border)] p-4">
            <legend className="px-1 text-sm font-semibold text-erp-text-primary">First role (optional)</legend>
            <p className="text-[13px] text-erp-text-muted">Roles decide what they can see and do at a factory. You can add more later.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Factory" error={errors.factoryId}>
                <ErpSelect value={form.factoryId} onChange={(e) => set('factoryId', e.target.value)}>
                  {factories.map((f) => <option key={f._id} value={f._id}>{f.code} — {f.name}</option>)}
                </ErpSelect>
              </Field>
              <Field label="Role">
                <ErpSelect value={form.roleId} onChange={(e) => set('roleId', e.target.value)}>
                  <option value="">No role yet</option>
                  {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                </ErpSelect>
              </Field>
            </div>
          </fieldset>
        )}
      </form>
    </Drawer>
  );
}
